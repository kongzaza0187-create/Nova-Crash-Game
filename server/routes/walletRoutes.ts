/**
 * ============================================================================
 * SUPERNOVA — SEAMLESS WALLET & BANKING ROUTER
 * File: /server/routes/walletRoutes.ts
 * ============================================================================
 * 
 * คู่มือสำหรับผู้พัฒนา (Developer Guide):
 * ไฟล์นี้เป็นศูนย์กลางของ API ที่เกี่ยวข้องกับกระเป๋าเงิน (Seamless Wallet),
 * การฝากเงินอัตโนมัติผ่านธนาคาร (Mobile Banking / PromptPay Webhook), 
 * การตัดเงินเดิมพัน (Debit/Bet), และการจ่ายเงินรางวัล (Credit/Win)
 * 
 * กฎสำคัญในการพัฒนาต่อยอด (Development Rules):
 * 1. ทุกธุรกรรมการเงินต้องมี `txn_id` ที่ไม่ซ้ำกัน (Idempotency Key)
 * 2. บัญชีผู้เล่นใช้ Row-Level Locking (`acquireUserLock`) เพื่อป้องกัน Race Condition
 * 3. มี Signature Middleware ตรวจสอบ `x-signature` (HMAC-SHA256) หรือใช้ `x-dev-test-mode: true` ใน Dev
 * 4. หากต้องการเพิ่ม Endpoint กระเป๋าเงินใหม่ ให้เขียนเพิ่มใน Router นี้
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { 
  seamlessWalletStore, 
  verifySignatureMiddleware, 
  generateHmacSignature, 
  API_SECRET_KEY 
} from "../seamlessWalletEngine.js";

export const walletRouter = Router();

// ----------------------------------------------------------------------------
// 1. AUTHENTICATE PLAYER
// POST /api/v1/wallet/authenticate
// ----------------------------------------------------------------------------
walletRouter.post("/authenticate", verifySignatureMiddleware, (req: Request, res: Response) => {
  try {
    const { operator_id, user_id, token } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: "MISSING_USER_ID", message: "user_id is required." });
    }

    let user = seamlessWalletStore.getUser(user_id);
    if (!user) {
      user = seamlessWalletStore.createUser(user_id, `Player_${user_id.slice(-4)}`, 10000.00);
    }

    return res.json({
      status: "SUCCESS",
      operator_id: operator_id || "OP_BOLLY_MAIN",
      user_id: user.id,
      username: user.username,
      balance: user.balance,
      currency: "THB",
      session_token: "sess_" + crypto.randomBytes(16).toString("hex"),
      authenticated_at: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

// ----------------------------------------------------------------------------
// 2. QUERY WALLET BALANCE (GET & POST)
// GET  /api/v1/wallet/balance/:userId
// GET  /api/v1/wallet/balance?user_id=...
// POST /api/v1/wallet/balance
// ----------------------------------------------------------------------------
const handleBalance = async (req: Request, res: Response) => {
  try {
    const userId = (req.params.userId || req.query.user_id || req.body?.user_id) as string;
    if (!userId) {
      return res.status(400).json({ error: "MISSING_USER_ID", message: "user_id is required in path, query, or body." });
    }

    const result = seamlessWalletStore.getBalance(userId);
    if (result.error === "USER_NOT_FOUND") {
      return res.status(404).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
};

walletRouter.get("/balance/:userId", verifySignatureMiddleware, handleBalance);
walletRouter.get("/balance", verifySignatureMiddleware, handleBalance);
walletRouter.post("/balance", verifySignatureMiddleware, handleBalance);

// ----------------------------------------------------------------------------
// 3. DEBIT / PLACE BET (หักเงินเดิมพัน / Idempotent Debit)
// POST /api/v1/wallet/debit (และ /bet)
// ----------------------------------------------------------------------------
const handleDebit = async (req: Request, res: Response) => {
  try {
    const { txn_id, user_id, amount, bet_amount, game_id, operator_id } = req.body;
    const betAmt = amount !== undefined ? amount : bet_amount;
    if (!txn_id || !user_id || betAmt === undefined) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", message: "txn_id, user_id, and amount are required." });
    }

    const result = await seamlessWalletStore.processDebit(
      txn_id, 
      user_id, 
      Number(betAmt), 
      game_id || "SUPERNOVA",
      operator_id || "OP_BOLLY_MAIN"
    );

    if (result.error === "INSUFFICIENT_FUNDS") return res.status(400).json(result);
    if (result.error === "USER_NOT_FOUND") return res.status(404).json(result);
    if (result.error) return res.status(400).json(result);

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
};

walletRouter.post("/debit", verifySignatureMiddleware, handleDebit);
walletRouter.post("/bet", verifySignatureMiddleware, handleDebit);

// ----------------------------------------------------------------------------
// 4. CREDIT / WIN (จ่ายเงินรางวัล / Cashout Settlement)
// POST /api/v1/wallet/credit (และ /win)
// ----------------------------------------------------------------------------
const handleCredit = async (req: Request, res: Response) => {
  try {
    const { txn_id, user_id, win_amount, amount, game_id, operator_id } = req.body;
    const winAmt = win_amount !== undefined ? win_amount : amount;
    if (!txn_id || !user_id || winAmt === undefined) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", message: "txn_id, user_id, and win_amount are required." });
    }

    const result = await seamlessWalletStore.processCredit(
      txn_id, 
      user_id, 
      Number(winAmt), 
      game_id || "SUPERNOVA",
      operator_id || "OP_BOLLY_MAIN"
    );

    if (result.error === "USER_NOT_FOUND") return res.status(404).json(result);
    if (result.error) return res.status(400).json(result);

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
};

walletRouter.post("/credit", verifySignatureMiddleware, handleCredit);
walletRouter.post("/win", verifySignatureMiddleware, handleCredit);

// ----------------------------------------------------------------------------
// 5. LOSS SETTLEMENT (บันทึกผลแพ้เมื่อยานตกก่อนกดถอน)
// POST /api/v1/wallet/loss
// ----------------------------------------------------------------------------
walletRouter.post("/loss", verifySignatureMiddleware, async (req: Request, res: Response) => {
  try {
    const { txn_id, bet_txn_id, user_id, loss_amount, amount, game_id, operator_id } = req.body;
    const lossAmt = loss_amount !== undefined ? loss_amount : amount;
    if (!txn_id || !user_id || lossAmt === undefined) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", message: "txn_id, user_id, and loss_amount are required." });
    }

    const result = await seamlessWalletStore.processLoss(
      txn_id, 
      bet_txn_id || `BET_${txn_id}`, 
      user_id, 
      Number(lossAmt), 
      game_id || "SUPERNOVA",
      operator_id || "OP_BOLLY_MAIN"
    );

    if (result.error === "USER_NOT_FOUND") return res.status(404).json(result);
    if (result.error) return res.status(400).json(result);

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

// ----------------------------------------------------------------------------
// 6. ROLLBACK / REFUND (คืนเงินบิลเดิมพันที่ยกเลิก)
// POST /api/v1/wallet/rollback (และ /refund)
// ----------------------------------------------------------------------------
const handleRollback = async (req: Request, res: Response) => {
  try {
    const { txn_id, ref_txn_id, user_id, operator_id } = req.body;
    if (!txn_id || !ref_txn_id || !user_id) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", message: "txn_id, ref_txn_id, and user_id are required." });
    }

    const result = await seamlessWalletStore.processRollback(
      txn_id, 
      ref_txn_id, 
      user_id,
      operator_id || "OP_BOLLY_MAIN"
    );

    if (result.error === "ORIGINAL_TXN_NOT_FOUND" || result.error === "USER_NOT_FOUND") {
      return res.status(404).json(result);
    }
    if (result.error) return res.status(400).json(result);

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
};

walletRouter.post("/rollback", verifySignatureMiddleware, handleRollback);
walletRouter.post("/refund", verifySignatureMiddleware, handleRollback);

// ----------------------------------------------------------------------------
// 7. MOBILE BANKING AUTOMATIC DEPOSIT WEBHOOK (PromptPay / Thai Banks)
// POST /api/v1/payment/webhook
// ----------------------------------------------------------------------------
walletRouter.post("/webhook", verifySignatureMiddleware, async (req: Request, res: Response) => {
  try {
    const { txn_id, user_id, amount_thb, amount, status } = req.body;
    const depositAmt = amount_thb !== undefined ? amount_thb : amount;
    if (!txn_id || !user_id || depositAmt === undefined) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", message: "txn_id, user_id, and amount are required." });
    }

    const result = await seamlessWalletStore.processBankingDeposit(txn_id, user_id, Number(depositAmt), status || "SUCCESS");
    if (result.error) return res.status(400).json(result);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

// ----------------------------------------------------------------------------
// 8. USER MANAGEMENT & QUERY (GET & POST)
// GET  /api/v1/wallet/users
// GET  /api/v1/wallet/users/:userId
// POST /api/v1/wallet/create-user
// ----------------------------------------------------------------------------
walletRouter.get("/users", (req: Request, res: Response) => {
  const users = seamlessWalletStore.getAllUsers();
  res.json({ total: users.length, users });
});

walletRouter.get("/users/:userId", (req: Request, res: Response) => {
  const user = seamlessWalletStore.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: "USER_NOT_FOUND", message: `User '${req.params.userId}' not found.` });
  }
  res.json(user);
});

walletRouter.post("/create-user", (req: Request, res: Response) => {
  const { id, username, balance } = req.body;
  if (!id || !username) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "id and username are required." });
  }
  const user = seamlessWalletStore.createUser(id, username, Number(balance || 0));
  res.json({ status: "SUCCESS", user });
});

// ----------------------------------------------------------------------------
// 9. TRANSACTION AUDIT LEDGER (GET)
// GET /api/v1/wallet/transactions?limit=50&user_id=...&type=...
// GET /api/v1/wallet/transactions/:txnId
// ----------------------------------------------------------------------------
walletRouter.get("/transactions", (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const userId = req.query.user_id as string | undefined;
  const type = req.query.type as string | undefined;

  let transactions = seamlessWalletStore.getTransactions(limit);
  if (userId) {
    transactions = transactions.filter(t => t.user_id === userId);
  }
  if (type) {
    transactions = transactions.filter(t => t.type === type);
  }

  res.json({ total: transactions.length, transactions });
});

walletRouter.get("/transactions/:txnId", (req: Request, res: Response) => {
  const txn = seamlessWalletStore.getTransactionByTxnId(req.params.txnId);
  if (!txn) {
    return res.status(404).json({ error: "TRANSACTION_NOT_FOUND", message: `Transaction '${req.params.txnId}' not found.` });
  }
  res.json(txn);
});

// ----------------------------------------------------------------------------
// 10. HMAC SIGNATURE GENERATOR & DEMO RESET
// POST /api/v1/wallet/sign
// POST /api/v1/wallet/reset-demo
// ----------------------------------------------------------------------------
walletRouter.post("/sign", (req: Request, res: Response) => {
  const { payload, secretKey } = req.body;
  const key = secretKey || API_SECRET_KEY;
  const signature = generateHmacSignature(payload, key);
  res.json({ signature, algorithm: "HMAC-SHA256" });
});

walletRouter.post("/reset-demo", (req: Request, res: Response) => {
  seamlessWalletStore.resetDemoData();
  res.json({ status: "SUCCESS", message: "Demo data reset successfully." });
});

// ----------------------------------------------------------------------------
// 11. B2B OPERATORS (GET & POST)
// GET  /api/wallet/v1/operators
// POST /api/wallet/v1/operators/register
// ----------------------------------------------------------------------------
walletRouter.get("/operators", (req: Request, res: Response) => {
  const operators = seamlessWalletStore.getAllOperators();
  res.json({ total: operators.length, operators });
});

walletRouter.post("/operators/register", (req: Request, res: Response) => {
  const { operator_id, operator_name, platform_url, api_secret } = req.body;
  if (!operator_id || !operator_name) {
    return res.status(400).json({ error: "operator_id and operator_name are required." });
  }
  const op = seamlessWalletStore.registerOperator(
    operator_id,
    operator_name,
    platform_url || "https://example.com",
    api_secret || API_SECRET_KEY
  );
  res.json({ status: "SUCCESS", operator: op });
});
