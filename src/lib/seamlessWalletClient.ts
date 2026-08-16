/**
 * Seamless Wallet Client Interface & RPC Bridge
 * Direct integration with iGaming Master Franchise Seamless Wallet API (THB)
 */

export interface WalletBalanceResponse {
  status: "SUCCESS" | "FAILED" | "ALREADY_PROCESSED";
  currency?: string;
  balance?: number;
  error?: string;
}

export interface WalletDebitResponse {
  status: "SUCCESS" | "FAILED" | "ALREADY_PROCESSED";
  currency?: string;
  balance?: number;
  error?: string;
  txn_id?: string;
}

export interface WalletCreditResponse {
  status: "SUCCESS" | "FAILED" | "ALREADY_PROCESSED";
  currency?: string;
  gross_win?: number;
  fee_deducted_3percent?: number;
  net_win_added?: number;
  balance?: number;
  error?: string;
  txn_id?: string;
}

export interface WalletLossResponse {
  status: "SUCCESS" | "FAILED" | "ALREADY_PROCESSED";
  currency?: string;
  loss_amount?: number;
  cashback_added_10percent?: number;
  balance?: number;
  error?: string;
  txn_id?: string;
}

export interface WalletRollbackResponse {
  status: "SUCCESS" | "FAILED" | "ALREADY_PROCESSED";
  currency?: string;
  refunded_amount?: number;
  balance?: number;
  error?: string;
  txn_id?: string;
}

export class SeamlessWalletClient {
  private static instance: SeamlessWalletClient;
  public defaultUserId: string = "USER_TH_001"; // KongZaza_Master

  private constructor() {}

  public static getInstance(): SeamlessWalletClient {
    if (!SeamlessWalletClient.instance) {
      SeamlessWalletClient.instance = new SeamlessWalletClient();
    }
    return SeamlessWalletClient.instance;
  }

  private getHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      "x-dev-test-mode": "true", // Internal trusted game-client channel
    };
  }

  /**
   * 1. Check Real Wallet Balance (THB)
   */
  public async getBalance(userId: string = this.defaultUserId): Promise<WalletBalanceResponse> {
    try {
      const res = await fetch("/api/v1/wallet/balance", {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { status: "FAILED", error: err.message || "Network Error" };
    }
  }

  /**
   * 2. Debit Real Wallet (Place Bet)
   */
  public async debitBet(
    txnId: string,
    amount: number,
    userId: string = this.defaultUserId,
    gameId: string = "SKY_RUSH"
  ): Promise<WalletDebitResponse> {
    try {
      const res = await fetch("/api/v1/wallet/debit", {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          txn_id: txnId,
          user_id: userId,
          amount: parseFloat(amount.toFixed(2)),
          game_id: gameId,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { status: "FAILED", error: err.message || "Network Error" };
    }
  }

  /**
   * 3. Credit Real Wallet on Win (Automatically calculates & deducts 3% House Fee on backend)
   */
  public async creditWin(
    txnId: string,
    grossWinAmount: number,
    userId: string = this.defaultUserId,
    gameId: string = "SKY_RUSH"
  ): Promise<WalletCreditResponse> {
    try {
      const res = await fetch("/api/v1/wallet/credit", {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          txn_id: txnId,
          user_id: userId,
          win_amount: parseFloat(grossWinAmount.toFixed(2)),
          game_id: gameId,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { status: "FAILED", error: err.message || "Network Error" };
    }
  }

  /**
   * 4. Settle Round Loss (Automatically calculates & credits 10% Instant Cashback on backend)
   */
  public async processLoss(
    txnId: string,
    betTxnId: string,
    lossAmount: number,
    userId: string = this.defaultUserId,
    gameId: string = "SKY_RUSH"
  ): Promise<WalletLossResponse> {
    try {
      const res = await fetch("/api/v1/wallet/loss", {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          txn_id: txnId,
          bet_txn_id: betTxnId,
          user_id: userId,
          loss_amount: parseFloat(lossAmount.toFixed(2)),
          game_id: gameId,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { status: "FAILED", error: err.message || "Network Error" };
    }
  }

  /**
   * 5. Rollback Cancelled Bet
   */
  public async rollbackBet(
    txnId: string,
    refTxnId: string,
    userId: string = this.defaultUserId
  ): Promise<WalletRollbackResponse> {
    try {
      const res = await fetch("/api/v1/wallet/rollback", {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          txn_id: txnId,
          ref_txn_id: refTxnId,
          user_id: userId,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { status: "FAILED", error: err.message || "Network Error" };
    }
  }
}

export const seamlessWalletClient = SeamlessWalletClient.getInstance();
