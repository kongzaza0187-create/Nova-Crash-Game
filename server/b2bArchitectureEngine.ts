import crypto from "crypto";

// ============================================================================
// 1. IN-MEMORY REDIS EMULATOR (B2B Multi-Merchant & Dynamic Session)
// ============================================================================
export interface RedisSessionData {
  merchant_id: string;
  ext_user_id: string;
  currency?: string;
  created_at: string;
}

export interface RedisLeaderboardEntry {
  rank: number;
  member: string; // "merchant_id:ext_user_id"
  merchant_id: string;
  ext_user_id: string;
  score: number; // Win amount
  timestamp: string;
}

export class B2BRedisEngine {
  // Key-Value Store with TTL expiration
  private kvStore: Map<string, { value: string; expireAt?: number }> = new Map();
  // Sorted Sets for Leaderboard: key -> Array of { member, score, timestamp }
  private sortedSets: Map<string, Array<{ member: string; score: number; timestamp: string }>> = new Map();

  /**
   * INCR key and set EXPIRE seconds (Composite Key: "ratelimit:<merchant_id>:<ext_user_id>")
   */
  public incrWithExpire(key: string, ttlSeconds: number = 1): { count: number; ttl: number } {
    this.cleanExpired();
    const now = Date.now();
    const existing = this.kvStore.get(key);

    let count = 1;
    if (existing && (!existing.expireAt || existing.expireAt > now)) {
      count = parseInt(existing.value, 10) + 1;
      this.kvStore.set(key, { value: count.toString(), expireAt: existing.expireAt });
    } else {
      this.kvStore.set(key, { value: "1", expireAt: now + ttlSeconds * 1000 });
    }

    return { count, ttl: ttlSeconds };
  }

  /**
   * SETEX key seconds value (e.g. "b2b:session:token_abc123xyz")
   */
  public setEx(key: string, ttlSeconds: number, value: string): boolean {
    const expireAt = Date.now() + ttlSeconds * 1000;
    this.kvStore.set(key, { value, expireAt });
    return true;
  }

  /**
   * GET key
   */
  public get(key: string): string | null {
    this.cleanExpired();
    const item = this.kvStore.get(key);
    if (!item) return null;
    if (item.expireAt && item.expireAt < Date.now()) {
      this.kvStore.delete(key);
      return null;
    }
    return item.value;
  }

  /**
   * ZADD key score member (e.g. "leaderboard:global_wins" 4500.50 "mch_alpha:ext_usr_998877")
   */
  public zAdd(key: string, score: number, member: string): boolean {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, []);
    }
    const set = this.sortedSets.get(key)!;
    const existingIdx = set.findIndex(item => item.member === member);

    if (existingIdx >= 0) {
      if (score > set[existingIdx].score) {
        set[existingIdx].score = score;
        set[existingIdx].timestamp = new Date().toISOString();
      }
    } else {
      set.push({ member, score, timestamp: new Date().toISOString() });
    }

    // Sort descending by score
    set.sort((a, b) => b.score - a.score);
    // Keep top 100
    if (set.length > 100) {
      set.splice(100);
    }
    return true;
  }

  /**
   * ZREVRANGE key start stop WITHSCORES
   */
  public zRevRangeWithScores(key: string, start: number = 0, stop: number = 9): RedisLeaderboardEntry[] {
    const set = this.sortedSets.get(key) || [];
    const sliced = set.slice(start, stop + 1);

    return sliced.map((item, idx) => {
      const parts = item.member.split(":");
      return {
        rank: start + idx + 1,
        member: item.member,
        merchant_id: parts[0] || "unknown",
        ext_user_id: parts[1] || "anonymous",
        score: item.score,
        timestamp: item.timestamp
      };
    });
  }

  private cleanExpired() {
    const now = Date.now();
    for (const [key, item] of this.kvStore.entries()) {
      if (item.expireAt && item.expireAt < now) {
        this.kvStore.delete(key);
      }
    }
  }

  public getStats() {
    this.cleanExpired();
    return {
      totalKeys: this.kvStore.size,
      totalSortedSets: this.sortedSets.size,
      leaderboardSize: (this.sortedSets.get("leaderboard:global_wins") || []).length
    };
  }
}

export const b2bRedis = new B2BRedisEngine();

// ============================================================================
// 2. POSTGRESQL TRANSACTIONAL LOGS & PARTITIONING ENGINE (B2B Seamless API)
// ============================================================================
export interface B2BTransactionLog {
  log_id: number;
  merchant_id: string; // Operator ID (e.g., 'mch_alpha')
  ext_user_id: string; // User ID sent from Operator (e.g., 'ext_usr_998877')
  game_id: string; // Game played (e.g., 'SKY_RUSH')
  round_id: string; // Game Round Identifier (e.g., 'rnd_9999999')
  transaction_type: "BET" | "WIN" | "ROLLBACK";
  amount: number;
  created_at: string;
  partition_name: string; // e.g., 'b2b_transaction_logs_2026_08'
}

export class B2BPostgresLogsEngine {
  private logs: B2BTransactionLog[] = [];
  private autoIncrementId: number = 1;
  // Composite Idempotency Map: "merchant_id:round_id:transaction_type"
  private idempotencyLocks: Map<string, B2BTransactionLog> = new Map();

  constructor() {
    this.seedRealisticData();
  }

  /**
   * Determine partition table name by timestamp (e.g. b2b_transaction_logs_2026_08)
   */
  public getPartitionName(date: Date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `b2b_transaction_logs_${y}_${m}`;
  }

  /**
   * Idempotent INSERT into b2b_transaction_logs with Partition routing
   */
  public insertLog(record: {
    merchant_id: string;
    ext_user_id: string;
    game_id: string;
    round_id: string;
    transaction_type: "BET" | "WIN" | "ROLLBACK";
    amount: number;
    created_at?: string;
  }): { success: boolean; log?: B2BTransactionLog; alreadyExists?: boolean } {
    const lockKey = `${record.merchant_id}:${record.round_id}:${record.transaction_type}`;
    
    // Idempotency lock check
    const existing = this.idempotencyLocks.get(lockKey);
    if (existing) {
      return { success: true, log: existing, alreadyExists: true };
    }

    const createdAtDate = record.created_at ? new Date(record.created_at) : new Date();
    const partitionName = this.getPartitionName(createdAtDate);

    const newLog: B2BTransactionLog = {
      log_id: this.autoIncrementId++,
      merchant_id: record.merchant_id,
      ext_user_id: record.ext_user_id,
      game_id: record.game_id,
      round_id: record.round_id,
      transaction_type: record.transaction_type,
      amount: parseFloat(Number(record.amount).toFixed(2)),
      created_at: createdAtDate.toISOString(),
      partition_name: partitionName
    };

    this.logs.push(newLog);
    this.idempotencyLocks.set(lockKey, newLog);

    // Sync to Redis Real-time High Win Feed if WIN > 500
    if (newLog.transaction_type === "WIN" && newLog.amount >= 500) {
      b2bRedis.zAdd("leaderboard:global_wins", newLog.amount, `${newLog.merchant_id}:${newLog.ext_user_id}`);
    }

    return { success: true, log: newLog, alreadyExists: false };
  }

  // ============================================================================
  // 3. B2B ANALYTICS & MERCHANT REVENUE METRICS (Simulating SQL Queries)
  // ============================================================================

  /**
   * QUERY 1: RTP Calculation per Game Across All Merchants
   * SELECT game_id, COUNT(DISTINCT round_id), SUM(BET), SUM(WIN), actual_rtp_percentage
   */
  public queryRtpPerGame(hours: number = 24): Array<{
    game_id: string;
    total_rounds: number;
    total_bets: number;
    total_wins: number;
    actual_rtp_percentage: number;
    target_rtp: number;
    house_margin_percentage: number;
  }> {
    const cutoff = new Date(Date.now() - hours * 3600 * 1000);
    const gameMap: Map<string, { rounds: Set<string>; totalBets: number; totalWins: number }> = new Map();

    for (const log of this.logs) {
      if (new Date(log.created_at) >= cutoff) {
        if (!gameMap.has(log.game_id)) {
          gameMap.set(log.game_id, { rounds: new Set(), totalBets: 0, totalWins: 0 });
        }
        const entry = gameMap.get(log.game_id)!;
        entry.rounds.add(log.round_id);

        if (log.transaction_type === "BET") {
          entry.totalBets += log.amount;
        } else if (log.transaction_type === "WIN") {
          entry.totalWins += log.amount;
        }
      }
    }

    return Array.from(gameMap.entries()).map(([game_id, data]) => {
      const rtp = data.totalBets > 0 ? parseFloat(((data.totalWins / data.totalBets) * 100).toFixed(2)) : 75.0;
      return {
        game_id,
        total_rounds: data.rounds.size,
        total_bets: parseFloat(data.totalBets.toFixed(2)),
        total_wins: parseFloat(data.totalWins.toFixed(2)),
        actual_rtp_percentage: rtp,
        target_rtp: 75.0,
        house_margin_percentage: parseFloat((100 - rtp).toFixed(2))
      };
    });
  }

  /**
   * QUERY 2: Account-Level Frequency Analysis (Cross-Merchant Bot / Anomaly Detection)
   * SELECT merchant_id, ext_user_id, COUNT(*) HAVING COUNT(*) > 30 in 5 min
   */
  public queryAccountFrequencyAnomalies(threshold: number = 25, windowMinutes: number = 5): Array<{
    merchant_id: string;
    ext_user_id: string;
    action_count: number;
    start_time: string;
    end_time: string;
    avg_speed_actions_per_sec: number;
    flag_level: "SUSPICIOUS_BOT" | "HIGH_FREQUENCY";
  }> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const userActions: Map<string, { merchant_id: string; ext_user_id: string; times: string[] }> = new Map();

    for (const log of this.logs) {
      if (new Date(log.created_at) >= cutoff) {
        const key = `${log.merchant_id}:${log.ext_user_id}`;
        if (!userActions.has(key)) {
          userActions.set(key, { merchant_id: log.merchant_id, ext_user_id: log.ext_user_id, times: [] });
        }
        userActions.get(key)!.times.push(log.created_at);
      }
    }

    const anomalies: Array<{
      merchant_id: string;
      ext_user_id: string;
      action_count: number;
      start_time: string;
      end_time: string;
      avg_speed_actions_per_sec: number;
      flag_level: "SUSPICIOUS_BOT" | "HIGH_FREQUENCY";
    }> = [];

    for (const data of userActions.values()) {
      if (data.times.length >= threshold) {
        data.times.sort();
        const start = data.times[0];
        const end = data.times[data.times.length - 1];
        const spanSec = Math.max(1, (new Date(end).getTime() - new Date(start).getTime()) / 1000);
        const speed = parseFloat((data.times.length / spanSec).toFixed(2));

        anomalies.push({
          merchant_id: data.merchant_id,
          ext_user_id: data.ext_user_id,
          action_count: data.times.length,
          start_time: start,
          end_time: end,
          avg_speed_actions_per_sec: speed,
          flag_level: data.times.length > 50 ? "SUSPICIOUS_BOT" : "HIGH_FREQUENCY"
        });
      }
    }

    return anomalies.sort((a, b) => b.action_count - a.action_count);
  }

  /**
   * QUERY 3: Revenue Settlement Breakdown by Merchant (GGR per Operator over 30 days)
   * SELECT merchant_id, DATE(created_at), SUM(BET) - SUM(WIN) AS merchant_ggr
   */
  public queryMerchantRevenueGgr(days: number = 30): Array<{
    merchant_id: string;
    report_date: string;
    total_bets: number;
    total_wins: number;
    merchant_ggr: number;
    ggr_margin_percent: number;
  }> {
    const cutoff = new Date(Date.now() - days * 86400 * 1000);
    const aggregation: Map<string, { merchant_id: string; report_date: string; bets: number; wins: number }> = new Map();

    for (const log of this.logs) {
      if (new Date(log.created_at) >= cutoff) {
        const dateStr = log.created_at.split("T")[0];
        const aggKey = `${log.merchant_id}_${dateStr}`;
        if (!aggregation.has(aggKey)) {
          aggregation.set(aggKey, { merchant_id: log.merchant_id, report_date: dateStr, bets: 0, wins: 0 });
        }
        const item = aggregation.get(aggKey)!;
        if (log.transaction_type === "BET") {
          item.bets += log.amount;
        } else if (log.transaction_type === "WIN") {
          item.wins += log.amount;
        }
      }
    }

    return Array.from(aggregation.values())
      .map(item => {
        const ggr = parseFloat((item.bets - item.wins).toFixed(2));
        const margin = item.bets > 0 ? parseFloat(((ggr / item.bets) * 100).toFixed(2)) : 25.0;
        return {
          merchant_id: item.merchant_id,
          report_date: item.report_date,
          total_bets: parseFloat(item.bets.toFixed(2)),
          total_wins: parseFloat(item.wins.toFixed(2)),
          merchant_ggr: ggr,
          ggr_margin_percent: margin
        };
      })
      .sort((a, b) => b.report_date.localeCompare(a.report_date) || b.merchant_ggr - a.merchant_ggr);
  }

  /**
   * Get all active partition table summaries
   */
  public getPartitionSummaries(): Array<{
    partition_name: string;
    record_count: number;
    total_volume: number;
    date_range: string;
  }> {
    const partitions: Map<string, { count: number; volume: number }> = new Map();
    for (const l of this.logs) {
      if (!partitions.has(l.partition_name)) {
        partitions.set(l.partition_name, { count: 0, volume: 0 });
      }
      const p = partitions.get(l.partition_name)!;
      p.count++;
      p.volume += l.amount;
    }

    return Array.from(partitions.entries()).map(([name, data]) => ({
      partition_name: name,
      record_count: data.count,
      total_volume: parseFloat(data.volume.toFixed(2)),
      date_range: "Monthly Partition Range (00:00:00 UTC -> Next Month 00:00:00 UTC)"
    }));
  }

  /**
   * Fetch recent transaction logs
   */
  public getRecentLogs(limit: number = 50): B2BTransactionLog[] {
    return this.logs.slice(-limit).reverse();
  }

  /**
   * Seed realistic multi-merchant logs for testing and simulation
   */
  public seedRealisticData(count: number = 300) {
    const merchants = ["mch_alpha", "mch_beta", "mch_gamma", "mch_delta"];
    const games = ["SKY_RUSH", "game_slot_01", "game_crash_02"];
    const now = Date.now();

    for (let i = 1; i <= count; i++) {
      const merchant_id = merchants[Math.floor(Math.random() * merchants.length)];
      const ext_user_id = `ext_usr_${100000 + Math.floor(Math.random() * 900000)}`;
      const game_id = games[Math.floor(Math.random() * games.length)];
      const round_id = `rnd_${10000000 + i}`;
      const timeOffset = Math.floor(Math.random() * (12 * 3600 * 1000)); // Within last 12 hours
      const timestamp = new Date(now - timeOffset).toISOString();

      const betAmount = Math.floor(50 + Math.random() * 450); // 50 - 500

      // Insert BET
      this.insertLog({
        merchant_id,
        ext_user_id,
        game_id,
        round_id,
        transaction_type: "BET",
        amount: betAmount,
        created_at: timestamp
      });

      // 75% RTP probability simulation
      const isWinner = Math.random() < 0.48; // ~48% win frequency
      if (isWinner) {
        const mult = 1.30 + Math.random() * 2.20; // 1.30x - 3.50x
        const grossWin = betAmount * mult;
        const netWin = grossWin * 0.97; // 3% fee
        this.insertLog({
          merchant_id,
          ext_user_id,
          game_id,
          round_id,
          transaction_type: "WIN",
          amount: parseFloat(netWin.toFixed(2)),
          created_at: new Date(new Date(timestamp).getTime() + 15000).toISOString()
        });
      }
    }

    // Seed one high-frequency bot anomaly for testing query 2
    const botMerchant = "mch_alpha";
    const botUser = "ext_usr_bot_sim99";
    for (let b = 1; b <= 35; b++) {
      const rId = `rnd_bot_${b}`;
      this.insertLog({
        merchant_id: botMerchant,
        ext_user_id: botUser,
        game_id: "SKY_RUSH",
        round_id: rId,
        transaction_type: "BET",
        amount: 100.00,
        created_at: new Date(now - (35 - b) * 3000).toISOString() // 1 bet every 3 seconds in last 2 minutes
      });
    }

    // Seed Redis leaderboards
    b2bRedis.zAdd("leaderboard:global_wins", 14500.50, "mch_alpha:ext_usr_998877");
    b2bRedis.zAdd("leaderboard:global_wins", 9820.00, "mch_beta:ext_usr_445566");
    b2bRedis.zAdd("leaderboard:global_wins", 7350.25, "mch_gamma:ext_usr_112233");
    b2bRedis.zAdd("leaderboard:global_wins", 5120.00, "mch_delta:ext_usr_778899");
    b2bRedis.zAdd("leaderboard:global_wins", 4500.50, "mch_alpha:ext_usr_883311");

    // Seed session token
    b2bRedis.setEx(
      "b2b:session:token_abc123xyz",
      3600,
      JSON.stringify({ merchant_id: "mch_alpha", ext_user_id: "ext_usr_998877", currency: "THB" })
    );
  }
}

export const b2bPostgresLogs = new B2BPostgresLogsEngine();
