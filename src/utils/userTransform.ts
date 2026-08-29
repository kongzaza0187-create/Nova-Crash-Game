/**
 * Universal User ID Transformer & Bot Pool Generator
 * Ensures all player and bot names follow the standardized format:
 * "user_" followed by exactly 11 digits (e.g. user_84920481923).
 * Zero-PII, completely anonymized, deterministic or random 11-digit generation.
 */

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
    return `user_${generate11DigitString()}`;
  }

  // If already user_ + 11 digits, keep it
  const match = rawUserIdOrName.match(/^user_(\d{11})$/i);
  if (match) {
    return `user_${match[1]}`;
  }

  // Extract all existing digits from raw input
  const digitsOnly = rawUserIdOrName.replace(/\D/g, "");
  
  if (digitsOnly.length >= 11) {
    return `user_${digitsOnly.slice(0, 11)}`;
  }

  // If digits are fewer than 11, deterministically pad with hashed seed from name
  let hash = 0;
  for (let i = 0; i < rawUserIdOrName.length; i++) {
    hash = (hash << 5) - hash + rawUserIdOrName.charCodeAt(i);
    hash |= 0;
  }
  const extraDigits = String(Math.abs(hash)).padStart(11, "8");
  const combined = (digitsOnly + extraDigits).slice(0, 11);
  return `user_${combined}`;
}

export const AVATAR_COLORS = [
  "#f43f5e", "#ec4899", "#d946ef", "#a855f7", "#8b5cf6", 
  "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", 
  "#10b981", "#22c55e", "#84cc16", "#eab308", "#f97316"
];

export const AVATAR_SEEDS = ["A", "B", "K", "Y", "P", "S", "M", "T", "G", "R", "W", "X", "Z", "H", "F", "1", "7", "9", "8", "3"];

export interface BotPoolConfig {
  minBots?: number;
  maxBots?: number;
  maxBetAmount?: number;
}

/**
 * Generates a randomized bot pool of 100 to 200 bots per round
 * Every bot has a strictly unique 11-digit user identifier: `user_XXXXXXXXXXX`
 * Wager amount is capped at max 30,000 THB.
 */
export function generateRandomBotPool(config: BotPoolConfig = {}) {
  const min = config.minBots ?? 100;
  const max = config.maxBots ?? 200;
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  
  const generatedNumbers = new Set<string>();
  const bots = [];

  // Weighted bet amounts up to max 30,000 THB
  const betAmounts = [
    30, 50, 100, 150, 200, 250, 300, 400, 500, 800, 1000, 1500, 2000, 2500, 3000, 5000, 7500, 10000, 15000, 20000, 25000, 30000
  ];

  for (let i = 0; i < count; i++) {
    // Generate unique 11-digit string using deduplication set
    let num11 = generate11DigitString();
    while (generatedNumbers.has(num11)) {
      num11 = generate11DigitString();
    }
    generatedNumbers.add(num11);

    const userName = `user_${num11}`;
    
    // Pick realistic bet amount capped at 30,000 max
    let amount = betAmounts[Math.floor(Math.random() * betAmounts.length)]!;
    if (amount > 30000) amount = 30000;

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
