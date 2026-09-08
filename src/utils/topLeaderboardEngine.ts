import { TopBetRecord } from "../components/BetsList";

/**
 * Top 3 Bot Leaderboard 12-Hour Rotation Engine
 * 
 * Rules:
 * 1. Shows strictly TOP 3 accounts only.
 * 2. Multipliers range from 100.00x to 400.00x (exclusive high-roller showcase, not occurring in normal play).
 * 3. Bets strictly capped at maximum 2,500 THB (e.g. 400 - 2,500 THB) for ultimate credibility.
 * 4. Rotates every 12 hours across two daily transition windows:
 *    - Midday Window: Starts between 12:01 and 13:00 (12:01 + 0-49 min random offset).
 *    - Midnight Window: Starts between 00:01 and 01:00 (00:01 + 0-49 min random offset).
 * 5. Value holds fixed throughout the ~12-hour period until the next shift window.
 * 6. Guaranteed 3 unique, non-repeating bot accounts per period.
 */

// Simple deterministic string hash
function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Pseudo-random generator from seed
function createPrng(seedNumber: number) {
  let s = seedNumber % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Pad number to 2 digits
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Format date as YYYY-MM-DD
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Get random minute offset between 2 and 48 minutes for the given date & cycle
 * Ensures shift happens between 12:01 - 13:00 and 00:01 - 01:00
 */
export function getShiftOffsetMinutes(dateStr: string, cycle: "midnight" | "midday"): number {
  const hash = hashStr(`${dateStr}_${cycle}_drift_v2`);
  // Offset between 3 and 48 minutes past the hour (e.g. 12:04 to 12:49, or 00:04 to 00:49)
  return 3 + (hash % 46);
}

/**
 * Identify the current active 12-hour epoch based on the current local time
 */
export function getCurrentTopEpoch(now: Date = new Date()): {
  epochKey: string;
  cycle: "midnight" | "midday";
  dateStr: string;
  shiftTime: Date;
  nextShiftTime: Date;
} {
  const todayStr = formatDate(now);
  
  // Today's shift points
  const todayMidnightOffset = getShiftOffsetMinutes(todayStr, "midnight");
  const todayMiddayOffset = getShiftOffsetMinutes(todayStr, "midday");

  const todayMidnightShift = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1 + todayMidnightOffset, 0);
  const todayMiddayShift = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 1 + todayMiddayOffset, 0);

  const nowMs = now.getTime();

  if (nowMs < todayMidnightShift.getTime()) {
    // Before today's midnight shift -> active period is yesterday's midday cycle
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = formatDate(yesterday);
    const yesterdayMiddayOffset = getShiftOffsetMinutes(yesterdayStr, "midday");
    const yesterdayMiddayShift = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 12, 1 + yesterdayMiddayOffset, 0);

    return {
      epochKey: `${yesterdayStr}_midday`,
      cycle: "midday",
      dateStr: yesterdayStr,
      shiftTime: yesterdayMiddayShift,
      nextShiftTime: todayMidnightShift,
    };
  } else if (nowMs < todayMiddayShift.getTime()) {
    // Between today's midnight shift and today's midday shift -> active period is today's midnight cycle
    return {
      epochKey: `${todayStr}_midnight`,
      cycle: "midnight",
      dateStr: todayStr,
      shiftTime: todayMidnightShift,
      nextShiftTime: todayMiddayShift,
    };
  } else {
    // After today's midday shift -> active period is today's midday cycle
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = formatDate(tomorrow);
    const tomorrowMidnightOffset = getShiftOffsetMinutes(tomorrowStr, "midnight");
    const tomorrowMidnightShift = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 1 + tomorrowMidnightOffset, 0);

    return {
      epochKey: `${todayStr}_midday`,
      cycle: "midday",
      dateStr: todayStr,
      shiftTime: todayMiddayShift,
      nextShiftTime: tomorrowMidnightShift,
    };
  }
}

// Realistic bet step amounts under <= 2,500 THB
const REALISTIC_BET_AMOUNTS = [
  300, 400, 500, 600, 750, 800, 1000, 
  1200, 1500, 1800, 2000, 2200, 2400, 2500
];

/**
 * Generates deterministically 3 unique bot accounts for the given epoch
 */
export function generateTop3Leaderboard(epochKey: string): TopBetRecord[] {
  const seed = hashStr(`${epochKey}_top3_supernova_v3`);
  const prng = createPrng(seed);

  const usedUserIds = new Set<string>();
  const bots: TopBetRecord[] = [];

  // Multiplier targets for Rank 1, 2, and 3
  // Multipliers range strictly between 100.00x and 400.00x
  const multiplierRanges = [
    { min: 285.0, max: 398.5 }, // Rank 1 highest
    { min: 195.0, max: 278.0 }, // Rank 2 medium-high
    { min: 105.0, max: 188.0 }, // Rank 3 solid high
  ];

  for (let rank = 0; rank < 3; rank++) {
    // 1. Generate unique 11-digit user ID
    let uniqueId = "";
    while (!uniqueId || usedUserIds.has(uniqueId)) {
      const firstDigit = Math.floor(prng() * 9) + 1; // 1-9
      let rest = "";
      for (let j = 0; j < 10; j++) {
        rest += Math.floor(prng() * 10);
      }
      uniqueId = `user_${firstDigit}${rest}`;
    }
    usedUserIds.add(uniqueId);

    // 2. Generate multiplier between 100.00x and 400.00x based on calibrated range
    const range = multiplierRanges[rank];
    const rawMult = range.min + prng() * (range.max - range.min);
    const multiplier = parseFloat(rawMult.toFixed(2));

    // 3. Generate realistic bet amount strictly <= 2,500 THB
    const amountIndex = Math.floor(prng() * REALISTIC_BET_AMOUNTS.length);
    const amount = REALISTIC_BET_AMOUNTS[amountIndex];

    // 4. Calculate win payout
    const win = Math.round(amount * multiplier);

    // 5. Realistic relative timestamp
    const timeOffsets = ["18m ago", "42m ago", "1h ago", "2h ago", "3h ago", "5h ago", "7h ago"];
    const timeIdx = (rank + Math.floor(prng() * 3)) % timeOffsets.length;
    const timestamp = timeOffsets[timeIdx];

    bots.push({
      id: `top_${epochKey}_rank_${rank + 1}`,
      name: uniqueId,
      multiplier,
      amount,
      win,
      timestamp,
      isBot: true,
    });
  }

  // Sort descending by payout win
  bots.sort((a, b) => b.win - a.win);

  return bots;
}

const STORAGE_KEY = "supernova_top3_leaderboard_cache";

/**
 * Get the current Top 3 leaderboard, utilizing localStorage cache for instant zero-flicker loading
 */
export function getActiveTop3Leaderboard(): TopBetRecord[] {
  try {
    const epoch = getCurrentTopEpoch();
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.epochKey === epoch.epochKey && Array.isArray(parsed.records) && parsed.records.length === 3) {
        return parsed.records;
      }
    }

    // Generate fresh records for this epoch
    const records = generateTop3Leaderboard(epoch.epochKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      epochKey: epoch.epochKey,
      records,
      updatedAt: Date.now(),
    }));
    return records;
  } catch {
    const epoch = getCurrentTopEpoch();
    return generateTop3Leaderboard(epoch.epochKey);
  }
}
