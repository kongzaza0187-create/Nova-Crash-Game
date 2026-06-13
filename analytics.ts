/**
 * SKY RUSH — PLAYER ANALYTICS SYSTEM
 * This module implements deep player behavioral tracking, analytics data catalogs,
 * predictive indicators, risk scores, LTV (Lifetime Value) metrics, and metrics computation
 * for the administrative reporting subsystem.
 * 
 * NOTE: All operations, calculations, and record storage timestamps are governed under UTC.
 */

export interface PlayerSession {
  sessionId: string;
  userId: string;
  startTime: string; // UTC ISO string
  endTime?: string;  // UTC ISO string
  durationSeconds?: number;
}

export interface BettingRecord {
  betId: string;
  userId: string;
  amountTHB: number;
  multiplierCashout?: number;
  isWon: boolean;
  payoutTHB: number;
  timestamp: string; // UTC ISO string
}

export interface AnalyticsReport {
  reportId: string;
  generatedAt: string; // UTC ISO string
  reportType: "DAILY" | "WEEKLY" | "MONTHLY";
  metrics: {
    totalActiveUsers: number;
    totalWageredAmount: number;
    totalPayoutAmount: number;
    ggr: number; // Gross Gaming Revenue
    averageBetSize: number;
    atRiskSpendersCount: number;
    highlyProfitableVipsCount: number;
  };
}

export interface PlayerBehaviorProfile {
  userId: string;
  averageBetSize: number;
  betFrequencyPerMin: number;
  averageCashoutMultiplier: number;
  winLossRatio: number;
  peakPlayingHoursUTC: number[]; // Hours [0-23]
  riskScore: "LOW" | "MEDIUM" | "HIGH";
  isVip: boolean;
  lifetimeValueTHB: number;
  suspiciousActivityDetected: boolean;
  anomalies: string[];
}

// In-Memory Database Collections (Simulated Durable Backend Stores in UTC)
export const playerSessionsList: PlayerSession[] = [];
export const bettingHistoryList: BettingRecord[] = [];
export const analyticsReportsList: AnalyticsReport[] = [];

/**
 * Trait trackers to log a new user session
 */
export function trackSessionStart(userId: string): PlayerSession {
  const session: PlayerSession = {
    sessionId: "sess_" + Math.random().toString(36).substr(2, 9),
    userId,
    startTime: new Date().toISOString(), // Default UTC ISO string
  };
  playerSessionsList.push(session);
  return session;
}

/**
 * Track user session tear down
 */
export function trackSessionEnd(sessionId: string): PlayerSession | null {
  const session = playerSessionsList.find((s) => s.sessionId === sessionId);
  if (session) {
    session.endTime = new Date().toISOString();
    const start = new Date(session.startTime).getTime();
    const end = new Date(session.endTime).getTime();
    session.durationSeconds = Math.round((end - start) / 1000);
    return session;
  }
  return null;
}

/**
 * Records an active bet transaction in UTC
 */
export function recordBetTransaction(
  userId: string,
  amountTHB: number,
  isWon: boolean,
  payoutTHB: number,
  multiplierCashout?: number
): BettingRecord {
  const bet: BettingRecord = {
    betId: "bet_" + Math.random().toString(36).substr(2, 9),
    userId,
    amountTHB,
    multiplierCashout,
    isWon,
    payoutTHB,
    timestamp: new Date().toISOString(),
  };
  bettingHistoryList.push(bet);
  return bet;
}

/**
 * Predictive Analytics Engine
 * Computes Risk Score, VIP status, suspicious activity patterns, and LTV.
 */
export function buildPlayerBehaviorProfile(userId: string): PlayerBehaviorProfile {
  // Aggregate bets for this player
  const playerBets = bettingHistoryList.filter((b) => b.userId === userId);
  const playerSessions = playerSessionsList.filter((s) => s.userId === userId && s.endTime);

  const totalBets = playerBets.length;
  const totalWagered = playerBets.reduce((sum, b) => sum + b.amountTHB, 0);
  const totalWon = playerBets.reduce((sum, b) => sum + b.payoutTHB, 0);
  const winCount = playerBets.filter((b) => b.isWon).length;

  const averageBetSize = totalBets > 0 ? parseFloat((totalWagered / totalBets).toFixed(2)) : 0;
  const winLossRatio = totalBets > 0 ? parseFloat((winCount / totalBets).toFixed(2)) : 0;

  // Average Cashout Multiplier
  const cashouts = playerBets.filter((b) => b.isWon && b.multiplierCashout);
  const averageCashoutMultiplier =
    cashouts.length > 0
      ? parseFloat((cashouts.reduce((sum, b) => sum + (b.multiplierCashout || 0), 0) / cashouts.length).toFixed(2))
      : 0;

  // Bet Frequency calculation based on total session durations
  const totalDurationSecs = playerSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  const totalDurationMins = totalDurationSecs > 0 ? totalDurationSecs / 60 : 1;
  const betFrequencyPerMin = parseFloat((totalBets / totalDurationMins).toFixed(2));

  // Hourly session clustering patterns (UTC)
  const hourCounts: { [key: number]: number } = {};
  playerSessions.forEach((s) => {
    const hr = new Date(s.startTime).getUTCHours();
    hourCounts[hr] = (hourCounts[hr] || 0) + 1;
  });
  const peakPlayingHoursUTC = Object.keys(hourCounts)
    .map(Number)
    .sort((a, b) => hourCounts[b] - hourCounts[a])
    .slice(0, 3); // Top 3 peak hours

  // LTV: Cumulative wagering yield metric
  const lifetimeValueTHB = parseFloat((totalWagered - totalWon).toFixed(2));

  // Risk Score Definition
  let riskScore: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (totalWagered > 100000 || averageBetSize > 5000) {
    riskScore = "HIGH";
  } else if (totalWagered > 20000 || averageBetSize > 1000) {
    riskScore = "MEDIUM";
  }

  // VIP Threshold parameters
  const isVip = totalWagered >= 150000;

  // Anomalous Fraud, Cheating, and Extreme Martingale script detector
  const anomalies: string[] = [];
  let suspiciousActivityDetected = false;

  // 1. Check for suspiciously high win ratios at high cashouts
  if (winLossRatio > 0.85 && averageCashoutMultiplier > 3.0 && totalBets > 10) {
    anomalies.push("Suspiciously high win ratio (>85%) at long odds multipliers.");
    suspiciousActivityDetected = true;
  }

  // 2. Check for abrupt massive bets
  if (totalBets > 5) {
    const historicalMax = Math.max(...playerBets.slice(0, -1).map((b) => b.amountTHB), 0);
    const lastBet = playerBets[playerBets.length - 1];
    if (lastBet && lastBet.amountTHB > historicalMax * 10 && historicalMax > 0) {
      anomalies.push(`Volume Spike: Last bet (${lastBet.amountTHB} THB) is 10x higher than historic peak.`);
      suspiciousActivityDetected = true;
    }
  }

  // 3. Super rapid bet frequency
  if (betFrequencyPerMin > 30) {
    anomalies.push(`Velocity warning: Excessive rapid-firing bets (${betFrequencyPerMin}/min).`);
    suspiciousActivityDetected = true;
  }

  return {
    userId,
    averageBetSize,
    betFrequencyPerMin,
    averageCashoutMultiplier,
    winLossRatio,
    peakPlayingHoursUTC,
    riskScore,
    isVip,
    lifetimeValueTHB,
    suspiciousActivityDetected,
    anomalies,
  };
}

/**
 * Generate Structured Analytics Reports
 */
export function generatePeriodicReport(type: "DAILY" | "WEEKLY" | "MONTHLY"): AnalyticsReport {
  const generatedAt = new Date().toISOString();
  
  // Group filters
  const uniqueUsers = new Set(bettingHistoryList.map((b) => b.userId));
  const totalWageredAmount = bettingHistoryList.reduce((sum, b) => sum + b.amountTHB, 0);
  const totalPayoutAmount = bettingHistoryList.reduce((sum, b) => sum + b.payoutTHB, 0);
  const ggr = parseFloat((totalWageredAmount - totalPayoutAmount).toFixed(2));
  const averageBetSize =
    bettingHistoryList.length > 0
      ? parseFloat((totalWageredAmount / bettingHistoryList.length).toFixed(2))
      : 0;

  let atRiskSpendersCount = 0;
  let highlyProfitableVipsCount = 0;

  uniqueUsers.forEach((uid) => {
    const profile = buildPlayerBehaviorProfile(uid);
    if (profile.riskScore === "HIGH") atRiskSpendersCount++;
    if (profile.isVip) highlyProfitableVipsCount++;
  });

  const report: AnalyticsReport = {
    reportId: `rep_${type.toLowerCase()}_` + Math.random().toString(36).substr(2, 9),
    generatedAt,
    reportType: type,
    metrics: {
      totalActiveUsers: uniqueUsers.size,
      totalWageredAmount: parseFloat(totalWageredAmount.toFixed(2)),
      totalPayoutAmount: parseFloat(totalPayoutAmount.toFixed(2)),
      ggr,
      averageBetSize,
      atRiskSpendersCount,
      highlyProfitableVipsCount,
    },
  };

  analyticsReportsList.push(report);
  return report;
}

// Seed Initial Mock Historical Data for Admin Dashboard Telemetry View
function seedAnalyticsDatabase() {
  const userList = ["usr_bobby", "usr_alexa", "usr_vincenzo", "usr_chloe"];
  
  // 1. Seed sessions
  userList.forEach((uid, index) => {
    const s = trackSessionStart(uid);
    // Simulate active session from 1 hour ago
    const startTimeStamp = Date.now() - (3600000 * (index + 1));
    s.startTime = new Date(startTimeStamp).toISOString();
    playerSessionsList.push(s);
    trackSessionEnd(s.sessionId);
  });

  // 2. Seed wagering histories
  let baseTime = Date.now() - 43200000; // 12 hours ago
  const betsData = [
    { uid: "usr_bobby", bet: 100, mult: 1.5, won: true, payout: 150 },
    { uid: "usr_bobby", bet: 200, mult: 2.1, won: true, payout: 420 },
    { uid: "usr_bobby", bet: 400, mult: 0, won: false, payout: 0 },
    { uid: "usr_alexa", bet: 1100, mult: 3.5, won: true, payout: 3850 },
    { uid: "usr_alexa", bet: 2500, mult: 0, won: false, payout: 0 },
    { uid: "usr_vincenzo", bet: 10000, mult: 8.2, won: true, payout: 82000 },
    { uid: "usr_vincenzo", bet: 15000, mult: 0, won: false, payout: 0 },
    { uid: "usr_chloe", bet: 50, mult: 1.15, won: true, payout: 57.5 },
    { uid: "usr_chloe", bet: 75, mult: 1.8, won: true, payout: 135 },
  ];

  betsData.forEach((item, idx) => {
    const timestamp = new Date(baseTime + (idx * 1800000)).toISOString();
    bettingHistoryList.push({
      betId: `bet_seed_${idx}`,
      userId: item.uid,
      amountTHB: item.bet,
      multiplierCashout: item.mult || undefined,
      isWon: item.won,
      payoutTHB: item.payout,
      timestamp,
    });
  });
}

// Automatically seed analytics when module is mounted/linked
seedAnalyticsDatabase();
