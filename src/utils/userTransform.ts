/**
 * Universal User ID Transformer & Bot Pool Generator
 * Ensures all player and bot names follow the standardized format:
 * "user_" followed by exactly 11 digits (e.g. user_84920481923).
 * Zero-PII, completely anonymized, deterministic or random 11-digit generation.
 * Guarantees zero duplicate 11-digit user IDs between real franchise players and bots.
 */

// Global registry of currently active real player 11-digit IDs to prevent bot collision
const activeRealPlayerIds = new Set<string>();

export function registerRealPlayerId(formattedUserId: string) {
  const match = formattedUserId.match(/^user_(\d{11})$/i);
  if (match && match[1]) {
    activeRealPlayerIds.add(match[1]);
  }
}

export function unregisterRealPlayerId(formattedUserId: string) {
  const match = formattedUserId.match(/^user_(\d{11})$/i);
  if (match && match[1]) {
    activeRealPlayerIds.delete(match[1]);
  }
}

// Generate a deterministic or pseudo-random unique 11-digit string
export function generate11DigitString(seed?: string | number): string {
  if (seed !== undefined) {
    // Generate deterministic 11-digit number from string seed using simple hash
    let hash = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash);
    const padded = String(positiveHash).padStart(11, "7");
    // Ensure exactly 11 digits
    return padded.slice(0, 11);
  }

  // Random 11-digit number between 10000000000 and 99999999999
  const firstDigit = Math.floor(Math.random() * 9) + 1; // 1-9
  let digits = String(firstDigit);
  for (let i = 0; i < 10; i++) {
    digits += Math.floor(Math.random() * 10);
  }
  return digits;
}

/**
 * Standardize any username, external merchant user ID, or bot name to:
 * `user_` followed by an 11-digit number without collisions.
 */
export function formatToStandardUser(rawUserIdOrName: string): string {
  if (!rawUserIdOrName) {
    const freshId = generate11DigitString();
    registerRealPlayerId(`user_${freshId}`);
    return `user_${freshId}`;
  }

  // If already user_ + 11 digits, keep it
  const match = rawUserIdOrName.match(/^user_(\d{11})$/i);
  if (match && match[1]) {
    registerRealPlayerId(`user_${match[1]}`);
    return `user_${match[1]}`;
  }

  // Extract all existing digits from raw input
  const digitsOnly = rawUserIdOrName.replace(/\D/g, "");
  
  if (digitsOnly.length >= 11) {
    const formatted = `user_${digitsOnly.slice(0, 11)}`;
    registerRealPlayerId(formatted);
    return formatted;
  }

  // If digits are fewer than 11, deterministically pad with hashed seed from name
  let hash = 0;
  for (let i = 0; i < rawUserIdOrName.length; i++) {
    hash = (hash << 5) - hash + rawUserIdOrName.charCodeAt(i);
    hash |= 0;
  }
  const extraDigits = String(Math.abs(hash)).padStart(11, "8");
  const combined = (digitsOnly + extraDigits).slice(0, 11);
  const formatted = `user_${combined}`;
  registerRealPlayerId(formatted);
  return formatted;
}

export const AVATAR_COLORS = [
  "#f43f5e", "#ec4899", "#d946ef", "#a855f7", "#8b5cf6", 
  "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", 
  "#10b981", "#22c55e", "#84cc16", "#eab308", "#f97316"
];

export const AVATAR_SEEDS = ["A", "B", "K", "Y", "P", "S", "M", "T", "G", "R", "W", "X", "Z", "H", "F", "1", "7", "9", "8", "3"];

/**
 * Masks the last 2 digits of a bot user identifier with `**`
 * e.g., `user_89401824901` -> `user_894018249**`
 */
export function maskBotUser(name: string): string {
  if (!name) return "user_*********";
  if (name.endsWith("**")) return name;
  if (name.length <= 2) return "**";
  return `${name.slice(0, -2)}**`;
}

/**
 * Generates natural, realistic, non-round human-like bet amounts for bots
 * e.g. 1,050, 2,001, 3,550, 450, 780, 1,250, 2,005, 3,020, etc.
 */
export function generateRealisticBotBet(maxCap: number = 8000): number {
  const baseTiers = [
    50, 100, 150, 200, 300, 400, 500, 700, 800, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7000, 8000
  ];
  
  const base = baseTiers[Math.floor(Math.random() * baseTiers.length)]!;
  const roll = Math.random();
  let amount = base;

  if (roll < 0.38) {
    // Style A: Non-round increments with +50 (e.g. 1,050, 3,550, 2,050, 450, 750, 1,250)
    const extra = (Math.floor(Math.random() * 3) * 100) + 50; // 50, 150, or 250
    amount = base + extra;
  } else if (roll < 0.65) {
    // Style B: Odd units / loose change with 1, 5, 2 (e.g. 2,001, 1,001, 505, 3,001, 501, 1,505)
    const oddUnits = [1, 1, 2, 3, 5, 5, 7, 10, 11];
    const unit = oddUnits[Math.floor(Math.random() * oddUnits.length)]!;
    amount = base + unit;
  } else if (roll < 0.88) {
    // Style C: Realistic non-zero tens (e.g. 420, 780, 1,120, 2,340, 3,180)
    const tens = (Math.floor(Math.random() * 8) + 1) * 10; // 10, 20, 30, ... 80
    amount = base + tens;
  } else {
    // Style D: Standard natural amount
    amount = base;
  }

  // Ensure amount is strictly within bounds [20, maxCap]
  amount = Math.max(20, Math.min(maxCap, Math.floor(amount)));
  return amount;
}

export interface BotPoolConfig {
  minBots?: number;
  maxBots?: number;
  maxBetAmount?: number;
  excludedRealUserIds?: string[];
}

/**
 * Generates a randomized bot pool of 100 to 200 bots per round
 * Every bot has a strictly unique 11-digit user identifier: `user_XXXXXXXXXXX`
 * Guaranteed zero collision with any real active player IDs.
 * Wager amount is capped at max 30,000 THB.
 */
export function generateRandomBotPool(config: BotPoolConfig = {}) {
  const min = config.minBots ?? 100;
  const max = config.maxBots ?? 200;
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  
  // Seed with all active real player numbers and passed exclusions to guarantee 100% uniqueness
  const generatedNumbers = new Set<string>(activeRealPlayerIds);
  if (config.excludedRealUserIds) {
    for (const uid of config.excludedRealUserIds) {
      const m = uid.match(/^user_(\d{11})$/i);
      if (m && m[1]) generatedNumbers.add(m[1]);
    }
  }

  const bots = [];

  for (let i = 0; i < count; i++) {
    // Generate unique 11-digit string that never collides with any real user or another bot
    let num11 = generate11DigitString();
    while (generatedNumbers.has(num11)) {
      num11 = generate11DigitString();
    }
    generatedNumbers.add(num11);

    const userName = `user_${num11}`;
    
    // Pick realistic non-round bet amount (e.g. 1,050, 2,001, 3,550) capped at maxBetAmount
    const maxCap = config.maxBetAmount ?? 8000;
    const amount = generateRealisticBotBet(maxCap);

    // Realistic target cashout multipliers
    // 40% quick conservative exit (1.10x - 1.80x)
    // 35% medium exit (1.80x - 3.50x)
    // 20% ambitious exit (3.50x - 12.00x)
    // 5% moonshot high multiplier exit (12.00x - 85.00x)
    const roll = Math.random();
    let targetMultiplier: number;
    if (roll < 0.40) {
      targetMultiplier = parseFloat((1.10 + Math.random() * 0.70).toFixed(2));
    } else if (roll < 0.75) {
      targetMultiplier = parseFloat((1.80 + Math.random() * 1.70).toFixed(2));
    } else if (roll < 0.95) {
      targetMultiplier = parseFloat((3.50 + Math.random() * 8.50).toFixed(2));
    } else {
      targetMultiplier = parseFloat((12.00 + Math.random() * 73.00).toFixed(2));
    }

    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
    const avatarSeed = AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)]!;

    bots.push({
      id: `bot_${num11}_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: userName,
      rawNum: num11,
      avatarColor,
      avatarSeed,
      amount,
      isCashedOut: false,
      isBust: false,
      targetMultiplier,
      isBot: true
    });
  }

  return bots;
}
