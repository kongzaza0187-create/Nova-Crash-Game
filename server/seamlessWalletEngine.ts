import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { b2bPostgresLogs, b2bRedis } from "./b2bArchitectureEngine.js";

// Secret Key for HMAC-SHA256 Digital Signatures (Shared between Operator & Master Franchise)
export const API_SECRET_KEY = process.env.SEAMLESS_WALLET_SECRET_KEY || "YOUR_SUPER_SECRET_HMAC_KEY";

export interface WalletUser {
  id: string;
  username: string;
  balance: number; // THB
  currency: string;
  status: "ACTIVE" | "SUSPENDED" | "BLOCKED";
  createdAt: string;
}

export interface OperatorProfile {
  operator_id: string;
  operator_name: string;
  platform_url: string;
  api_secret: string;
  status: "ACTIVE" | "SUSPENDED";
  currency: string;
  total_debit_volume: number;
  total_credit_volume: number;
  total_loss_cashback: number;
  total_commission_paid: number;
  active_players_count: number;
  registered_at: string;
}

export interface WalletTransaction {
  id: number;
  txn_id: string;
  ref_txn_id?: string | null;
  user_id: string;
  operator_id?: string;
  amount: number; // Net amount transacted in THB
  gross_amount?: number;
  fee?: number; // House fee (3% for WIN)
  cashback?: number; // Cashback (10% for LOSS)
  balance_after: number; // User balance after transaction
  type: "DEPOSIT_BANKING" | "BET" | "WIN" | "CASHBACK_10%" | "ROLLBACK";
  game_id?: string;
  status: "SUCCESS" | "FAILED" | "REJECTED";
  created_at: string;
}

// In-Memory Database with Row-Level Lock (FOR UPDATE) Simulation
class SeamlessWalletStore {
  private users: Map<string, WalletUser> = new Map();
  private operators: Map<string, OperatorProfile> = new Map();
  private transactions: Map<string, WalletTransaction> = new Map(); // Keyed by txn_id for O(1) Idempotency
  private txList: WalletTransaction[] = [];
  private userLocks: Map<string, Promise<void>> = new Map();
  private autoIncrementId: number = 1;

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    this.createUser("USER_TH_001", "KongZaza_Master", 50000.00);
    this.createUser("USER_TH_002", "LuckyPilot88", 12500.00);
    this.createUser("USER_TH_003", "SlotKing_VIP", 25000.00);

    // Seed Multi-Tenant iGaming Operators
    this.registerOperator("OP_BOLLY_MAIN", "BollyGaming Pilot Hub", "https://bollygaming.com", API_SECRET_KEY);
    this.registerOperator("OP_BETHUB_99", "BetHub99 International", "https://bethub99.net", API_SECRET_KEY);
    this.registerOperator("OP_ROYAL_VIP", "RoyalVIP88 Casino", "https://royalvip88.com", API_SECRET_KEY);
    this.registerOperator("OP_SLOTX_ASIA", "SlotX Gaming Network", "https://slotx.asia", API_SECRET_KEY);
  }

  public registerOperator(
    operatorId: string,
    name: string,
    platformUrl: string = "https://example.com",
    apiSecret: string = API_SECRET_KEY
  ): OperatorProfile {
    const op: OperatorProfile = {
      operator_id: operatorId,
      operator_name: name,
      platform_url: platformUrl,
      api_secret: apiSecret,
      status: "ACTIVE",
      currency: "THB",
      total_debit_volume: 0,
      total_credit_volume: 0,
      total_loss_cashback: 0,
      total_commission_paid: 0,
      active_players_count: 0,
      registered_at: new Date().toISOString()
    };
    this.operators.set(operatorId, op);
    return op;
  }

  public getOperator(operatorId: string): OperatorProfile | undefined {
    return this.operators.get(operatorId);
  }

  public getAllOperators(): OperatorProfile[] {
    return Array.from(this.operators.values());
  }

  // Row-Level Lock Mechanism: Simulates `SELECT ... FOR UPDATE` in Node.js Event Loop
  private async acquireUserLock(userId: string): Promise<() => void> {
    while (this.userLocks.has(userId)) {
      await this.userLocks.get(userId);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.userLocks.set(userId, lockPromise);

    return () => {
      this.userLocks.delete(userId);
      resolveLock();
    };
  }

  public createUser(id: string, username: string, initialBalance: number = 0): WalletUser {
    const user: WalletUser = {
      id,
      username,
      balance: parseFloat(Number(initialBalance).toFixed(2)),
      currency: "THB",
      status: "ACTIVE",
      createdAt: new Date().toISOString()
    };
    this.users.set(id, user);
    return user;
  }

  public getUser(userId: string): WalletUser | undefined {
    return this.users.get(userId);
  }

  public getAllUsers(): WalletUser[] {
    return Array.from(this.users.values());
  }

  public getTransactionByTxnId(txnId: string): WalletTransaction | undefined {
    return this.transactions.get(txnId);
  }

  public getTransactions(limit: number = 100): WalletTransaction[] {
    return this.txList.slice(-limit).reverse();
  }

  public resetDemoData() {
    this.users.clear();
    this.transactions.clear();
    this.txList = [];
    this.autoIncrementId = 1;
    this.seedInitialData();
  }

  // 1. MOBILE BANKING DEPOSIT (PromptPay / Thai Bank Webhook)
  public async processBankingDeposit(
    txnId: string,
    userId: string,
    amountThb: number,
    status: string
  ): Promise<{ status: string; currency?: string; balance?: number; error?: string; alreadyProcessed?: boolean }> {
    if (status !== "SUCCESS") {
      return { status: "FAILED", error: "TRANSACTION_NOT_SUCCESS" };
    }

    const unlock = await this.acquireUserLock(userId);
    try {
      // 1. Idempotency Check (Prevent duplicate deposits)
      const existingTx = this.transactions.get(txnId);
      if (existingTx) {
        return { status: "ALREADY_PROCESSED", currency: "THB", balance: existingTx.balance_after, alreadyProcessed: true };
      }

      // 2. Lock Row & Check User
      const user = this.users.get(userId);
      if (!user) {
        return { status: "FAILED", error: "USER_NOT_FOUND" };
      }

      const depositAmount = parseFloat(Number(amountThb).toFixed(2));
      if (isNaN(depositAmount) || depositAmount <= 0) {
        return { status: "FAILED", error: "INVALID_AMOUNT" };
      }

      const newBalance = parseFloat((user.balance + depositAmount).toFixed(2));
      user.balance = newBalance;

      // 3. Record Transaction
      const txRecord: WalletTransaction = {
        id: this.autoIncrementId++,
        txn_id: txnId,
        user_id: userId,
        amount: depositAmount,
        gross_amount: depositAmount,
        fee: 0.00,
        cashback: 0.00,
        balance_after: newBalance,
        type: "DEPOSIT_BANKING",
        status: "SUCCESS",
        created_at: new Date().toISOString()
      };

      this.transactions.set(txnId, txRecord);
      this.txList.push(txRecord);

      return { status: "SUCCESS", currency: "THB", balance: newBalance };
    } finally {
      unlock();
    }
  }

  // 2. BALANCE LOOKUP
  public getBalance(userId: string): { status: string; currency?: string; username?: string; balance?: number; error?: string } {
    const user = this.users.get(userId);
    if (!user) {
      return { status: "FAILED", error: "USER_NOT_FOUND" };
    }
    return { status: "SUCCESS", currency: "THB", username: user.username, balance: user.balance };
  }

  // 3. DEBIT (PLACE BET)
  public async processDebit(
    txnId: string,
    userId: string,
    amount: number,
    gameId: string = "SKY_RUSH",
    operatorId: string = "OP_BOLLY_MAIN"
  ): Promise<{ status: string; currency?: string; balance?: number; error?: string; alreadyProcessed?: boolean }> {
    const unlock = await this.acquireUserLock(userId);
    try {
      // Idempotency Check
      const existingTx = this.transactions.get(txnId);
      if (existingTx) {
        return { status: "SUCCESS", currency: "THB", balance: existingTx.balance_after, alreadyProcessed: true };
      }

      const user = this.users.get(userId);
      if (!user) {
        return { status: "FAILED", error: "USER_NOT_FOUND" };
      }

      const betAmount = parseFloat(Number(amount).toFixed(2));
      if (isNaN(betAmount) || betAmount <= 0) {
        return { status: "FAILED", error: "INVALID_AMOUNT" };
      }

      if (user.balance < betAmount) {
        return { status: "FAILED", error: "INSUFFICIENT_FUNDS" };
      }

      const newBalance = parseFloat((user.balance - betAmount).toFixed(2));
      user.balance = newBalance;

      // Update operator volume stats
      const op = this.operators.get(operatorId);
      if (op) {
        op.total_debit_volume = parseFloat((op.total_debit_volume + betAmount).toFixed(2));
      }

      const txRecord: WalletTransaction = {
        id: this.autoIncrementId++,
        txn_id: txnId,
        user_id: userId,
        operator_id: operatorId,
        amount: betAmount,
        gross_amount: betAmount,
        fee: 0.00,
        cashback: 0.00,
        balance_after: newBalance,
        type: "BET",
        game_id: gameId,
        status: "SUCCESS",
        created_at: new Date().toISOString()
      };

      this.transactions.set(txnId, txRecord);
      this.txList.push(txRecord);

      // Record to Partitioned PostgreSQL Transactional Logs
      b2bPostgresLogs.insertLog({
        merchant_id: operatorId,
        ext_user_id: userId,
        game_id: gameId,
        round_id: `rnd_${txnId.replace(/\D/g, "") || Math.floor(Math.random() * 9000000 + 1000000)}`,
        transaction_type: "BET",
        amount: betAmount,
        created_at: txRecord.created_at
      });

      return { status: "SUCCESS", currency: "THB", balance: newBalance };
    } finally {
      unlock();
    }
  }

  // 4. CREDIT (WIN) -> 3% House Fee (Commission) Deduction
  public async processCredit(
    txnId: string,
    userId: string,
    winAmount: number,
    gameId: string = "SKY_RUSH",
    operatorId: string = "OP_BOLLY_MAIN"
  ): Promise<{
    status: string;
    currency?: string;
    gross_win?: number;
    fee_deducted_3percent?: number;
    net_win_added?: number;
    balance?: number;
    error?: string;
    alreadyProcessed?: boolean;
  }> {
    const unlock = await this.acquireUserLock(userId);
    try {
      // Idempotency Check
      const existingTx = this.transactions.get(txnId);
      if (existingTx) {
        return {
          status: "SUCCESS",
          currency: "THB",
          gross_win: existingTx.gross_amount,
          fee_deducted_3percent: existingTx.fee,
          net_win_added: existingTx.amount,
          balance: existingTx.balance_after,
          alreadyProcessed: true
        };
      }

      const user = this.users.get(userId);
      if (!user) {
        return { status: "FAILED", error: "USER_NOT_FOUND" };
      }

      const grossWin = parseFloat(Number(winAmount).toFixed(2));
      if (isNaN(grossWin) || grossWin <= 0) {
        return { status: "FAILED", error: "INVALID_AMOUNT" };
      }

      // Exact 3% House Fee calculation
      const houseFee = parseFloat((grossWin * 0.03).toFixed(2));
      const netWin = parseFloat((grossWin - houseFee).toFixed(2));

      const newBalance = parseFloat((user.balance + netWin).toFixed(2));
      user.balance = newBalance;

      // Update operator stats
      const op = this.operators.get(operatorId);
      if (op) {
        op.total_credit_volume = parseFloat((op.total_credit_volume + netWin).toFixed(2));
        op.total_commission_paid = parseFloat((op.total_commission_paid + houseFee).toFixed(2));
      }

      const txRecord: WalletTransaction = {
        id: this.autoIncrementId++,
        txn_id: txnId,
        user_id: userId,
        operator_id: operatorId,
        amount: netWin,
        gross_amount: grossWin,
        fee: houseFee,
        cashback: 0.00,
        balance_after: newBalance,
        type: "WIN",
        game_id: gameId,
        status: "SUCCESS",
        created_at: new Date().toISOString()
      };

      this.transactions.set(txnId, txRecord);
      this.txList.push(txRecord);

      // Record to Partitioned PostgreSQL Transactional Logs
      b2bPostgresLogs.insertLog({
        merchant_id: operatorId,
        ext_user_id: userId,
        game_id: gameId,
        round_id: `rnd_${txnId.replace(/\D/g, "") || Math.floor(Math.random() * 9000000 + 1000000)}`,
        transaction_type: "WIN",
        amount: netWin,
        created_at: txRecord.created_at
      });

      return {
        status: "SUCCESS",
        currency: "THB",
        gross_win: grossWin,
        fee_deducted_3percent: houseFee,
        net_win_added: netWin,
        balance: newBalance
      };
    } finally {
      unlock();
    }
  }

  // 5. LOSS -> 10% Instant Cashback into Player Wallet
  public async processLoss(
    txnId: string,
    betTxnId: string,
    userId: string,
    lossAmount: number,
    gameId: string = "SKY_RUSH",
    operatorId: string = "OP_BOLLY_MAIN"
  ): Promise<{
    status: string;
    currency?: string;
    loss_amount?: number;
    cashback_added_10percent?: number;
    balance?: number;
    error?: string;
    alreadyProcessed?: boolean;
  }> {
    const unlock = await this.acquireUserLock(userId);
    try {
      // Idempotency Check
      const existingTx = this.transactions.get(txnId);
      if (existingTx) {
        return {
          status: "SUCCESS",
          currency: "THB",
          loss_amount: existingTx.gross_amount,
          cashback_added_10percent: existingTx.cashback,
          balance: existingTx.balance_after,
          alreadyProcessed: true
        };
      }

      const user = this.users.get(userId);
      if (!user) {
        return { status: "FAILED", error: "USER_NOT_FOUND" };
      }

      const lossVal = parseFloat(Number(lossAmount).toFixed(2));
      if (isNaN(lossVal) || lossVal <= 0) {
        return { status: "FAILED", error: "INVALID_AMOUNT" };
      }

      // Exact 10% Cashback calculation
      const cashbackAmount = parseFloat((lossVal * 0.10).toFixed(2));
      const newBalance = parseFloat((user.balance + cashbackAmount).toFixed(2));
      user.balance = newBalance;

      // Update operator stats
      const op = this.operators.get(operatorId);
      if (op) {
        op.total_loss_cashback = parseFloat((op.total_loss_cashback + cashbackAmount).toFixed(2));
      }

      const txRecord: WalletTransaction = {
        id: this.autoIncrementId++,
        txn_id: txnId,
        ref_txn_id: betTxnId,
        user_id: userId,
        operator_id: operatorId,
        amount: cashbackAmount,
        gross_amount: lossVal,
        fee: 0.00,
        cashback: cashbackAmount,
        balance_after: newBalance,
        type: "CASHBACK_10%",
        game_id: gameId,
        status: "SUCCESS",
        created_at: new Date().toISOString()
      };

      this.transactions.set(txnId, txRecord);
      this.txList.push(txRecord);

      return {
        status: "SUCCESS",
        currency: "THB",
        loss_amount: lossVal,
        cashback_added_10percent: cashbackAmount,
        balance: newBalance
      };
    } finally {
      unlock();
    }
  }

  // 6. ROLLBACK (CANCELLED BET REFUND)
  public async processRollback(
    txnId: string,
    refTxnId: string,
    userId: string,
    operatorId: string = "OP_BOLLY_MAIN"
  ): Promise<{ status: string; currency?: string; refunded_amount?: number; balance?: number; error?: string; alreadyProcessed?: boolean }> {
    const unlock = await this.acquireUserLock(userId);
    try {
      // Idempotency Check
      const existingTx = this.transactions.get(txnId);
      if (existingTx) {
        return { status: "SUCCESS", currency: "THB", balance: existingTx.balance_after, alreadyProcessed: true };
      }

      // Check original BET transaction
      const origTx = this.transactions.get(refTxnId);
      if (!origTx || origTx.type !== "BET") {
        return { status: "FAILED", error: "ORIGINAL_TXN_NOT_FOUND" };
      }

      const user = this.users.get(userId);
      if (!user) {
        return { status: "FAILED", error: "USER_NOT_FOUND" };
      }

      const refundAmount = origTx.amount;
      const newBalance = parseFloat((user.balance + refundAmount).toFixed(2));
      user.balance = newBalance;

      // Adjust operator debit volume
      const op = this.operators.get(operatorId);
      if (op) {
        op.total_debit_volume = Math.max(0, parseFloat((op.total_debit_volume - refundAmount).toFixed(2)));
      }

      const txRecord: WalletTransaction = {
        id: this.autoIncrementId++,
        txn_id: txnId,
        ref_txn_id: refTxnId,
        user_id: userId,
        operator_id: operatorId,
        amount: refundAmount,
        gross_amount: refundAmount,
        fee: 0.00,
        cashback: 0.00,
        balance_after: newBalance,
        type: "ROLLBACK",
        status: "SUCCESS",
        created_at: new Date().toISOString()
      };

      this.transactions.set(txnId, txRecord);
      this.txList.push(txRecord);

      // Record to Partitioned PostgreSQL Transactional Logs
      b2bPostgresLogs.insertLog({
        merchant_id: operatorId,
        ext_user_id: userId,
        game_id: origTx.game_id || "SKY_RUSH",
        round_id: `rnd_${refTxnId.replace(/\D/g, "") || Math.floor(Math.random() * 9000000 + 1000000)}`,
        transaction_type: "ROLLBACK",
        amount: refundAmount,
        created_at: txRecord.created_at
      });

      return { status: "SUCCESS", currency: "THB", refunded_amount: refundAmount, balance: newBalance };
    } finally {
      unlock();
    }
  }
}

export const seamlessWalletStore = new SeamlessWalletStore();

// ==========================================
// HMAC-SHA256 SIGNATURE GENERATOR & VERIFIER
// ==========================================
export function generateHmacSignature(payload: any, secretKey: string = API_SECRET_KEY): string {
  const hmac = crypto.createHmac("sha256", secretKey);
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  return hmac.update(data).digest("hex");
}

export function verifySignatureMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow signature bypass if dev-bypass header is explicitly enabled for live in-app testing console
  const devBypass = req.headers["x-dev-test-mode"] === "true";
  const signature = req.headers["x-signature"] as string | undefined;

  if (devBypass) {
    return next();
  }

  if (!signature) {
    return res.status(401).json({ error: "MISSING_SIGNATURE", message: "Header 'x-signature' is required." });
  }

  const expectedSignature = generateHmacSignature(req.body, API_SECRET_KEY);

  if (signature !== expectedSignature) {
    return res.status(403).json({
      error: "INVALID_SIGNATURE",
      message: "Provided HMAC-SHA256 signature does not match expected signature."
    });
  }

  next();
}
