export type RoundState = "WAITING" | "FLYING" | "FLEW_AWAY";
export type WalletMode = "DEMO" | "REAL";

export interface GameState {
  multiplier: number;
  state: RoundState;
  timeElapsed: number;
  countdown: number; // 5 to 0 seconds
  crashMultiplier: number;
  history: Array<{ id: string; val: number }>;
}

export interface Bet {
  amount: number;
  isPlaced: boolean;
  isAutoBet: boolean;
  isAutoCashOut: boolean;
  autoCashOutMultiplier: number;
  hasCashedOut: boolean;
  cashedOutMultiplier?: number;
  winAmount?: number;
  betTxnId?: string;
}

export interface PlayerBet {
  id: string;
  name: string;
  avatarColor: string;
  avatarSeed: string;
  amount: number;
  cashOutMultiplier?: number;
  isCashedOut: boolean;
  isBust: boolean;
}

export interface HistoryItem {
  id: string;
  val: number;
}

export interface UserStats {
  winCount: number;
  totalBets: number;
  totalWagered: number;
  totalWon: number;
  netProfit: number;
}
