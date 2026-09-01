import { createClient, RedisClientType } from "redis";
import { Server as SocketIOServer, Socket } from "socket.io";
import crypto from "crypto";

// ============================================================================
// DATA MODELS & PROTOCOL SCHEMAS
// ============================================================================
export interface HistoryRecord {
  id: string;
  roundId: number;
  crashMultiplier: number;
  val: number; // Backward-compatible alias
  seedHash: string;
  hash: string; // Backward-compatible alias
  serverSeed: string;
  timestamp: string;
  tierId: number;
  tierLabel: string;
  tier?: string;
}

export interface GameHistoryConfig {
  redisKey: string;
  maxHistoryLength: number;
  gameRoomName: string;
}

export const DEFAULT_HISTORY_CONFIG: GameHistoryConfig = {
  redisKey: "skyrush:history:global",
  maxHistoryLength: 100,
  gameRoomName: "skyrush_live_room"
};

// ============================================================================
// 1. CENTRAL REDIS HISTORY REPOSITORY (SINGLE SOURCE OF TRUTH)
// ============================================================================
export class CentralGameHistoryService {
  private redisClient: RedisClientType | null = null;
  private isConnected: boolean = false;
  private inMemoryFallback: HistoryRecord[] = [];
  private config: GameHistoryConfig;

  constructor(
    redisUrl: string = process.env.REDIS_URL || "redis://127.0.0.1:6379",
    config: GameHistoryConfig = DEFAULT_HISTORY_CONFIG
  ) {
    this.config = config;

    try {
      this.redisClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              return false; // Fall back gracefully to memory
            }
            return Math.min(retries * 500, 3000);
          }
        }
      });

      this.redisClient.on("error", (err) => {
        // Degrade silently to in-memory fallback without crashing the engine
        this.isConnected = false;
      });

      this.redisClient.on("connect", () => {
        console.log("[Redis Connected] Central In-Memory Game History Buffer is Active.");
        this.isConnected = true;
      });
    } catch {
      this.redisClient = null;
      this.isConnected = false;
    }
  }

  public async initialize(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.connect();
        await this.seedInitialHistoryIfEmpty();
      } catch (err) {
        console.warn("[Redis Notice] Redis standalone instance unavailable. Operating on in-memory authoritative ring buffer.");
      }
    }

    if (this.inMemoryFallback.length === 0) {
      this.seedInMemoryFallback();
    }
  }

  /**
   * Records a completed round to Redis atomically (LPUSH + LTRIM)
   */
  public async pushHistory(record: HistoryRecord): Promise<void> {
    const serialized = JSON.stringify(record);

    if (this.isConnected && this.redisClient) {
      try {
        const multi = this.redisClient.multi();
        multi.lPush(this.config.redisKey, serialized);
        multi.lTrim(this.config.redisKey, 0, this.config.maxHistoryLength - 1);
        await multi.exec();
      } catch (err) {
        console.error("[Redis Error] Failed to execute LPUSH/LTRIM transaction:", err);
      }
    }

    // Always maintain in-memory buffer as synchronized mirror
    this.inMemoryFallback.unshift(record);
    if (this.inMemoryFallback.length > this.config.maxHistoryLength) {
      this.inMemoryFallback.pop();
    }
  }

  /**
   * Retrieves the most recent N history records (Ordered Newest -> Oldest)
   */
  public async getRecentHistory(limit: number = 50): Promise<HistoryRecord[]> {
    if (this.isConnected && this.redisClient) {
      try {
        const rawList = await this.redisClient.lRange(this.config.redisKey, 0, limit - 1);
        if (rawList && rawList.length > 0) {
          return rawList.map((item) => JSON.parse(item) as HistoryRecord);
        }
      } catch (err) {
        console.error("[Redis Error] Failed to execute LRANGE history query:", err);
      }
    }

    return this.inMemoryFallback.slice(0, limit);
  }

  private async seedInitialHistoryIfEmpty(): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;

    try {
      const count = await this.redisClient.lLen(this.config.redisKey);
      if (count === 0) {
        const initialSeeds = this.generateHistoricalSeedArray(40);
        const multi = this.redisClient.multi();
        for (const item of initialSeeds) {
          multi.lPush(this.config.redisKey, JSON.stringify(item));
        }
        multi.lTrim(this.config.redisKey, 0, this.config.maxHistoryLength - 1);
        await multi.exec();
      }
    } catch (err) {
      console.warn("[Redis Seed] Could not seed Redis buffer:", err);
    }
  }

  private seedInMemoryFallback(): void {
    this.inMemoryFallback = this.generateHistoricalSeedArray(40);
  }

  private generateHistoricalSeedArray(count: number): HistoryRecord[] {
    const now = Date.now();
    const results: HistoryRecord[] = [];

    for (let i = count; i >= 1; i--) {
      const roundId = 1000 + (count - i);
      const serverSeed = crypto.randomBytes(16).toString("hex");
      const seedHash = crypto.createHash("sha256").update(serverSeed).digest("hex");
      const r = Math.random();

      let val = 1.00;
      let tier = "Instant Bust";
      let tierId = 1;

      if (r < 0.155) {
        val = 1.00;
        tier = "1.00x (Instant Bust)";
        tierId = 1;
      } else if (r < 0.35) {
        val = parseFloat((1.01 + Math.random() * 0.49).toFixed(2));
        tier = "1.01x – 1.50x (Safe Zone)";
        tierId = 2;
      } else if (r < 0.70) {
        val = parseFloat((1.51 + Math.random() * 1.99).toFixed(2));
        tier = "1.51x – 3.50x (Circulation Zone)";
        tierId = 5;
      } else if (r < 0.90) {
        val = parseFloat((3.51 + Math.random() * 5.49).toFixed(2));
        tier = "3.51x – 9.00x (Mid-Profit Zone)";
        tierId = 7;
      } else {
        val = parseFloat((9.01 + Math.random() * 40.99).toFixed(2));
        tier = "9.01x – 50.00x (Jackpot Flight)";
        tierId = 11;
      }

      results.push({
        id: String(roundId),
        roundId,
        crashMultiplier: val,
        val,
        seedHash,
        hash: seedHash,
        serverSeed,
        timestamp: new Date(now - i * 14500).toISOString(),
        tier,
        tierId,
        tierLabel: tier
      });
    }

    return results;
  }
}

// ============================================================================
// 2. SOCKET.IO REAL-TIME SYNCHRONIZATION CONTROLLER
// ============================================================================
export class LiveGameSyncController {
  private io: SocketIOServer;
  private historyService: CentralGameHistoryService;
  private gameRoom: string;

  constructor(
    io: SocketIOServer,
    historyService: CentralGameHistoryService,
    gameRoom: string = DEFAULT_HISTORY_CONFIG.gameRoomName
  ) {
    this.io = io;
    this.historyService = historyService;
    this.gameRoom = gameRoom;
    this.registerSocketHandlers();
  }

  private registerSocketHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      // 1. New user arrives / Room entry
      socket.on("JOIN_GAME_ROOM", async (payload: { userId?: string; token?: string }) => {
        socket.join(this.gameRoom);

        // Fetch authoritative history snapshot from Redis
        const recentHistory = await this.historyService.getRecentHistory(50);

        // Emit exclusively to the newly connected user
        socket.emit("INIT_HISTORY", {
          event: "INIT_HISTORY",
          data: {
            serverTime: new Date().toISOString(),
            room: this.gameRoom,
            totalRoundsLogged: recentHistory.length,
            history: recentHistory
          }
        });
      });

      // Handle ping/keepalive for WebSocket health monitoring
      socket.on("PING_SYNC", () => {
        socket.emit("PONG_SYNC", { serverTime: new Date().toISOString() });
      });
    });
  }

  /**
   * Invoked by the 24/7 central flight loop when a rocket crashes
   */
  public async handleRoundCrash(record: HistoryRecord): Promise<void> {
    // 1. Commit atomically to Redis
    await this.historyService.pushHistory(record);

    // 2. Broadcast event to all players across all websites in the room
    this.io.to(this.gameRoom).emit("NEW_HISTORY_ENTRY", {
      event: "NEW_HISTORY_ENTRY",
      data: record
    });
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}
