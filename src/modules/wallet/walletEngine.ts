import { getMaltaIsoString } from "../../lib/timeUtils";
import { logger } from "../../middleware/logger";

export interface WalletTransactionRecord {
  txn_id: string;
  ref_txn_id?: string;
  user_id: string;
  type: "DEBIT" | "CREDIT" | "ROLLBACK" | "LOSS_CASHBACK" | "DEPOSIT";
  amount: number;
  gross_amount?: number;
  fee?: number;
  cashback?: number;
  currency: string;
  balance_before: number;
  balance_after: number;
  status: "SUCCESS" | "FAILED" | "REJECTED";
  created_at: string;
  game_id?: string;
  idempotency_hash?: string;
}

export interface UserWalletRecord {
  user_id: string;
  currency: string;
  balance: number;
  total_deposited: number;
  total_debited: number;
  total_won: number;
  total_cashback_received: number;
  total_fee_collected: number;
  last_activity: string;
}

class UserConcurrencyMutex {
  private userLocks: Map<string, Promise<void>> = new Map();

  public async acquire<T>(userId: string, task: () => Promise<T>): Promise<T> {
    while (this.userLocks.has(userId)) {
      await this.userLocks.get(userId);
    }

    let release: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.userLocks.set(userId, lockPromise);

    try {
      return await task();
    } finally {
      this.userLocks.delete(userId);
      release();
    }
  }
}

export class ModularWalletEngine {
  private static instance: ModularWalletEngine;
  private users: Map<string, UserWalletRecord> = new Map();
  private transactions: Map<string, WalletTransactionRecord> = new Map();
  private userLocks = new UserConcurrencyMutex();

  private constructor() {
    this.seedDefaultUser("USER_TH_001", 50000.0);
    this.seedDefaultUser("PLAYER_VIP_888", 120000.0);
  }

  public static getInstance(): ModularWalletEngine {
    if (!ModularWalletEngine.instance) {
      ModularWalletEngine.instance = new ModularWalletEngine();
    }
    return ModularWalletEngine.instance;
  }

  private seedDefaultUser(userId: string, initialBalance: number) {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        user_id: userId,
        currency: "THB",
        balance: initialBalance,
        total_deposited: initialBalance,
        total_debited: 0,
        total_won: 0,
        total_cashback_received: 0,
        total_fee_collected: 0,
        last_activity: getMaltaIsoString()
      });
    }
  }

  public async getBalance(userId: string): Promise<{ status: "SUCCESS" | "FAILED"; currency: string; balance: number; user_id: string; error?: string }> {
    return await this.userLocks.acquire(userId, async () => {
      let user = this.users.get(userId);
      if (!user) {
        this.seedDefaultUser(userId, 50000.0);
        user = this.users.get(userId)!;
      }

      return {
        status: "SUCCESS",
        currency: user.currency,
        balance: parseFloat(user.balance.toFixed(2)),
        user_id: user.user_id
      };
    });
  }

  public async processDebit(params: {
    txn_id: string;
    user_id: string;
    amount: number;
    game_id?: string;
    ip?: string;
    trace_id?: string;
  }): Promise<{ status: "SUCCESS" | "FAILED"; currency: string; txn_id: string; amount_debited: number; balance: number; already_processed?: boolean; error?: string }> {
    const { txn_id, user_id, amount, game_id = "SKY_RUSH", ip = "127.0.0.1", trace_id = logger.generateTraceId() } = params;

    return await this.userLocks.acquire(user_id, async () => {
      // Idempotency Check
      const existing = this.transactions.get(txn_id);
      if (existing) {
        const user = this.users.get(user_id)!;
        return {
          status: "SUCCESS",
          currency: existing.currency,
          txn_id: existing.txn_id,
          amount_debited: existing.amount,
          balance: parseFloat(user.balance.toFixed(2)),
          already_processed: true
        };
      }

      let user = this.users.get(user_id);
      if (!user) {
        this.seedDefaultUser(user_id, 50000.0);
        user = this.users.get(user_id)!;
      }

      const balanceBefore = user.balance;

      // Atomic Balance Check
      if (user.balance < amount) {
        logger.logFinancialAudit({
          timestamp: getMaltaIsoString(),
          trace_id,
          user_id,
          transaction_id: txn_id,
          amount,
          action_type: "BET",
          http_status: 400,
          currency: user.currency,
          game_id,
          ip,
          status: "REJECTED",
          error_message: "INSUFFICIENT_FUNDS"
        });

        return {
          status: "FAILED",
          currency: user.currency,
          txn_id,
          amount_debited: 0,
          balance: parseFloat(user.balance.toFixed(2)),
          error: "INSUFFICIENT_FUNDS"
        };
      }

      // Execute Atomic Debit
      const balanceAfter = parseFloat((balanceBefore - amount).toFixed(2));
      user.balance = balanceAfter;
      user.total_debited = parseFloat((user.total_debited + amount).toFixed(2));
      user.last_activity = getMaltaIsoString();

      const record: WalletTransactionRecord = {
        txn_id,
        user_id,
        type: "DEBIT",
        amount,
        currency: user.currency,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "SUCCESS",
        created_at: getMaltaIsoString(),
        game_id
      };
      this.transactions.set(txn_id, record);

      logger.logFinancialAudit({
        timestamp: getMaltaIsoString(),
        trace_id,
        user_id,
        transaction_id: txn_id,
        amount,
        action_type: "BET",
        http_status: 200,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        currency: user.currency,
        game_id,
        ip,
        status: "SUCCESS"
      });

      return {
        status: "SUCCESS",
        currency: user.currency,
        txn_id,
        amount_debited: amount,
        balance: balanceAfter
      };
    });
  }

  public async processCredit(params: {
    txn_id: string;
    user_id: string;
    amount: number; // gross win
    game_id?: string;
    ip?: string;
    trace_id?: string;
  }): Promise<{ status: "SUCCESS" | "FAILED"; currency: string; txn_id: string; gross_win: number; fee_deducted_3percent: number; net_win_added: number; balance: number; already_processed?: boolean; error?: string }> {
    const { txn_id, user_id, amount, game_id = "SKY_RUSH", ip = "127.0.0.1", trace_id = logger.generateTraceId() } = params;

    return await this.userLocks.acquire(user_id, async () => {
      const existing = this.transactions.get(txn_id);
      if (existing) {
        const user = this.users.get(user_id)!;
        return {
          status: "SUCCESS",
          currency: existing.currency,
          txn_id: existing.txn_id,
          gross_win: existing.gross_amount || existing.amount,
          fee_deducted_3percent: existing.fee || 0,
          net_win_added: existing.amount,
          balance: parseFloat(user.balance.toFixed(2)),
          already_processed: true
        };
      }

      let user = this.users.get(user_id);
      if (!user) {
        this.seedDefaultUser(user_id, 50000.0);
        user = this.users.get(user_id)!;
      }

      const balanceBefore = user.balance;
      const fee3Percent = parseFloat((amount * 0.03).toFixed(2));
      const netWin = parseFloat((amount - fee3Percent).toFixed(2));
      const balanceAfter = parseFloat((balanceBefore + netWin).toFixed(2));

      user.balance = balanceAfter;
      user.total_won = parseFloat((user.total_won + netWin).toFixed(2));
      user.total_fee_collected = parseFloat((user.total_fee_collected + fee3Percent).toFixed(2));
      user.last_activity = getMaltaIsoString();

      const record: WalletTransactionRecord = {
        txn_id,
        user_id,
        type: "CREDIT",
        amount: netWin,
        gross_amount: amount,
        fee: fee3Percent,
        currency: user.currency,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "SUCCESS",
        created_at: getMaltaIsoString(),
        game_id
      };
      this.transactions.set(txn_id, record);

      logger.logFinancialAudit({
        timestamp: getMaltaIsoString(),
        trace_id,
        user_id,
        transaction_id: txn_id,
        amount: netWin,
        gross_amount: amount,
        fee: fee3Percent,
        action_type: "WIN",
        http_status: 200,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        currency: user.currency,
        game_id,
        ip,
        status: "SUCCESS"
      });

      return {
        status: "SUCCESS",
        currency: user.currency,
        txn_id,
        gross_win: amount,
        fee_deducted_3percent: fee3Percent,
        net_win_added: netWin,
        balance: balanceAfter
      };
    });
  }

  public async processRollback(params: {
    txn_id: string;
    ref_txn_id: string;
    user_id: string;
    ip?: string;
    trace_id?: string;
  }): Promise<{ status: "SUCCESS" | "FAILED"; currency: string; txn_id: string; ref_txn_id: string; refunded_amount: number; balance: number; error?: string }> {
    const { txn_id, ref_txn_id, user_id, ip = "127.0.0.1", trace_id = logger.generateTraceId() } = params;

    return await this.userLocks.acquire(user_id, async () => {
      const orig = this.transactions.get(ref_txn_id);
      if (!orig || orig.type !== "DEBIT") {
        return {
          status: "FAILED",
          currency: "THB",
          txn_id,
          ref_txn_id,
          refunded_amount: 0,
          balance: 0,
          error: "ORIGINAL_TXN_NOT_FOUND"
        };
      }

      let user = this.users.get(user_id);
      if (!user) {
        return {
          status: "FAILED",
          currency: "THB",
          txn_id,
          ref_txn_id,
          refunded_amount: 0,
          balance: 0,
          error: "USER_NOT_FOUND"
        };
      }

      const balanceBefore = user.balance;
      const refundAmount = orig.amount;
      const balanceAfter = parseFloat((balanceBefore + refundAmount).toFixed(2));

      user.balance = balanceAfter;
      user.total_debited = Math.max(0, parseFloat((user.total_debited - refundAmount).toFixed(2)));
      user.last_activity = getMaltaIsoString();

      const record: WalletTransactionRecord = {
        txn_id,
        ref_txn_id,
        user_id,
        type: "ROLLBACK",
        amount: refundAmount,
        currency: user.currency,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "SUCCESS",
        created_at: getMaltaIsoString()
      };
      this.transactions.set(txn_id, record);

      logger.logFinancialAudit({
        timestamp: getMaltaIsoString(),
        trace_id,
        user_id,
        transaction_id: txn_id,
        ref_transaction_id: ref_txn_id,
        amount: refundAmount,
        action_type: "ROLLBACK",
        http_status: 200,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        currency: user.currency,
        ip,
        status: "SUCCESS"
      });

      return {
        status: "SUCCESS",
        currency: user.currency,
        txn_id,
        ref_txn_id,
        refunded_amount: refundAmount,
        balance: balanceAfter
      };
    });
  }

  public async processLossCashback(params: {
    txn_id: string;
    bet_txn_id: string;
    user_id: string;
    loss_amount: number;
    game_id?: string;
    ip?: string;
    trace_id?: string;
  }): Promise<{ status: "SUCCESS" | "FAILED"; currency: string; txn_id: string; loss_amount: number; cashback_added_10percent: number; balance: number; error?: string }> {
    const { txn_id, bet_txn_id, user_id, loss_amount, game_id = "SKY_RUSH", ip = "127.0.0.1", trace_id = logger.generateTraceId() } = params;

    return await this.userLocks.acquire(user_id, async () => {
      let user = this.users.get(user_id);
      if (!user) {
        this.seedDefaultUser(user_id, 50000.0);
        user = this.users.get(user_id)!;
      }

      const balanceBefore = user.balance;
      const cashback10Percent = parseFloat((loss_amount * 0.10).toFixed(2));
      const balanceAfter = parseFloat((balanceBefore + cashback10Percent).toFixed(2));

      user.balance = balanceAfter;
      user.total_cashback_received = parseFloat((user.total_cashback_received + cashback10Percent).toFixed(2));
      user.last_activity = getMaltaIsoString();

      const record: WalletTransactionRecord = {
        txn_id,
        ref_txn_id: bet_txn_id,
        user_id,
        type: "LOSS_CASHBACK",
        amount: cashback10Percent,
        cashback: cashback10Percent,
        currency: user.currency,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "SUCCESS",
        created_at: getMaltaIsoString(),
        game_id
      };
      this.transactions.set(txn_id, record);

      logger.logFinancialAudit({
        timestamp: getMaltaIsoString(),
        trace_id,
        user_id,
        transaction_id: txn_id,
        ref_transaction_id: bet_txn_id,
        amount: cashback10Percent,
        cashback: cashback10Percent,
        action_type: "CASHBACK_10%",
        http_status: 200,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        currency: user.currency,
        game_id,
        ip,
        status: "SUCCESS"
      });

      return {
        status: "SUCCESS",
        currency: user.currency,
        txn_id,
        loss_amount,
        cashback_added_10percent: cashback10Percent,
        balance: balanceAfter
      };
    });
  }

  public async processDeposit(params: {
    txn_id: string;
    user_id: string;
    amount: number;
    ip?: string;
    trace_id?: string;
  }): Promise<{ status: "SUCCESS" | "FAILED"; currency: string; txn_id: string; amount_credited: number; balance: number; error?: string }> {
    const { txn_id, user_id, amount, ip = "127.0.0.1", trace_id = logger.generateTraceId() } = params;

    return await this.userLocks.acquire(user_id, async () => {
      let user = this.users.get(user_id);
      if (!user) {
        this.seedDefaultUser(user_id, 0);
        user = this.users.get(user_id)!;
      }

      const balanceBefore = user.balance;
      const balanceAfter = parseFloat((balanceBefore + amount).toFixed(2));

      user.balance = balanceAfter;
      user.total_deposited = parseFloat((user.total_deposited + amount).toFixed(2));
      user.last_activity = getMaltaIsoString();

      const record: WalletTransactionRecord = {
        txn_id,
        user_id,
        type: "DEPOSIT",
        amount,
        currency: user.currency,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "SUCCESS",
        created_at: getMaltaIsoString()
      };
      this.transactions.set(txn_id, record);

      logger.logFinancialAudit({
        timestamp: getMaltaIsoString(),
        trace_id,
        user_id,
        transaction_id: txn_id,
        amount,
        action_type: "DEPOSIT_BANKING",
        http_status: 200,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        currency: user.currency,
        ip,
        status: "SUCCESS"
      });

      return {
        status: "SUCCESS",
        currency: user.currency,
        txn_id,
        amount_credited: amount,
        balance: balanceAfter
      };
    });
  }

  public getLedgerTransactions(limit: number = 100): WalletTransactionRecord[] {
    return Array.from(this.transactions.values()).slice(-limit).reverse();
  }

  public getOverviewStats() {
    let totalBal = 0;
    let totalDep = 0;
    let totalDeb = 0;
    let totalWon = 0;
    let totalCb = 0;
    let totalFee = 0;

    for (const u of this.users.values()) {
      totalBal += u.balance;
      totalDep += u.total_deposited;
      totalDeb += u.total_debited;
      totalWon += u.total_won;
      totalCb += u.total_cashback_received;
      totalFee += u.total_fee_collected;
    }

    return {
      active_users_count: this.users.size,
      total_balance_held: parseFloat(totalBal.toFixed(2)),
      total_deposited: parseFloat(totalDep.toFixed(2)),
      total_debited: parseFloat(totalDeb.toFixed(2)),
      total_won: parseFloat(totalWon.toFixed(2)),
      total_cashback_paid: parseFloat(totalCb.toFixed(2)),
      total_house_fees_collected: parseFloat(totalFee.toFixed(2)),
      currency: "THB",
      timezone: "Europe/Malta"
    };
  }
}

export const modularWalletEngine = ModularWalletEngine.getInstance();
