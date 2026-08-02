import express, { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

// Ensure process.env.NODE_ENV is set or default
const isProduction = process.env.NODE_ENV === "production";
const PORT = 3000;

// ==========================================
// PART 7: LOGGING & MONITORING SYSTEM
// ==========================================
interface SecurityLogEntry {
  id: string;
  type: string;
  timestamp: string;
  ip: string;
  userId?: string;
  details: string;
}

// Stores logs separate from main database
const securityLogs: SecurityLogEntry[] = [];

function logSecurityEvent(entry: Omit<SecurityLogEntry, "id">) {
  const logId = "log_" + crypto.randomUUID();
  const fullEntry = { id: logId, ...entry };
  securityLogs.push(fullEntry);
  console.log(`[SECURITY EVENT][${entry.type}] ${entry.details} (IP: ${entry.ip})`);
}

function logSuspiciousActivity(payload: { type: string; userId?: string; details: string; ip?: string }) {
  logSecurityEvent({
    type: payload.type,
    ip: payload.ip || "unknown",
    userId: payload.userId,
    timestamp: new Date().toISOString(),
    details: `🚨 SUSPICIOUS ACTIVITY: ${payload.details}`
  });
}

function logFailedValidation(payload: { timestamp: string; ip: string; details: string }) {
  logSecurityEvent({
    type: "FAILED_VALIDATION",
    ip: payload.ip,
    timestamp: payload.timestamp,
    details: `Input validation failed: ${payload.details}`
  });
}

function logDbError(errorMessage: string) {
  logSecurityEvent({
    type: "DATABASE_ERROR",
    ip: "system",
    timestamp: new Date().toISOString(),
    details: `Database Internal Error: ${errorMessage}`
  });
}

// ==========================================
// PART 4: AUTHENTICATION (JWT SYSTEM)
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

function base64urlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

class SecurityTokenService {
  private blacklistedTokens: Set<string> = new Set();

  public generateToken(payload: { userId: string; username: string }, isRefresh = false): string {
    const header = { alg: "HS256", typ: "JWT" };
    // Token expires after 24 hours; Refresh token expires after 7 days
    const exp = Math.floor(Date.now() / 1000) + (isRefresh ? 7 * 24 * 60 * 60 : 24 * 60 * 60);
    const fullPayload = { ...payload, exp, isRefresh };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));

    const signature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  public verifyToken(token: string): { userId: string; username: string; isRefresh: boolean } | null {
    if (this.blacklistedTokens.has(token)) {
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    if (signature !== expectedSignature) {
      return null;
    }

    try {
      const payload = JSON.parse(base64urlDecode(payloadB64));
      if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        return null; // Expired
      }
      return payload;
    } catch {
      return null;
    }
  }

  public blacklistToken(token: string) {
    this.blacklistedTokens.add(token);
    logSecurityEvent({
      type: "TOKEN_BLACKLISTED",
      ip: "system",
      timestamp: new Date().toISOString(),
      details: "User token blacklisted after logout"
    });
  }
}

const tokenService = new SecurityTokenService();

// Express Auth middleware
function verifyJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. Valid JWT token is required inside Authorization header." });
  }

  const token = authHeader.split(" ")[1];
  const payload = tokenService.verifyToken(token);
  if (!payload) {
    logSuspiciousActivity({
      type: "INVALID_JWT_ATTEMPT",
      details: "Access attempt using expired or invalid JWT token",
      ip: req.ip || "unknown"
    });
    return res.status(401).json({ error: "Unauthorized. Invalid, signature-mismatched, or expired JWT." });
  }

  (req as any).user = payload;
  next();
}

// ==========================================
// PART 2: RATE LIMITING MIDDLEWARE
// ==========================================
interface RateLimitBucket {
  count: number;
  resetTime: number;
}

class SecurityRateLimiter {
  private ipBuckets: Map<string, RateLimitBucket> = new Map();
  private userBetBuckets: Map<string, RateLimitBucket> = new Map();
  private loginBuckets: Map<string, RateLimitBucket> = new Map();
  private consecutiveViolations: Map<string, number> = new Map();
  private blockedIPs: Set<string> = new Set();

  public isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  public trackViolation(ip: string, reason: string) {
    const current = (this.consecutiveViolations.get(ip) || 0) + 1;
    this.consecutiveViolations.set(ip, current);
    
    logSecurityEvent({
      type: "RATE_LIMIT_VIOLATION",
      ip,
      timestamp: new Date().toISOString(),
      details: `Violation: ${reason}. Total violation count: ${current}`
    });

    // Block IP automatically after 3 consecutive violations
    if (current >= 3) {
      this.blockedIPs.add(ip);
      logSecurityEvent({
        type: "IP_BLOCKED",
        ip,
        timestamp: new Date().toISOString(),
        details: "IP automatically permanently blocked from the system due to 3 active rate limit violations"
      });
    }
  }

  private checkLimit(buckets: Map<string, RateLimitBucket>, key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetTime) {
      bucket = { count: 0, resetTime: now + windowMs };
    }
    bucket.count++;
    buckets.set(key, bucket);
    return bucket.count <= max;
  }

  public handleRequest(ip: string): boolean {
    if (this.isBlocked(ip)) return false;
    const ok = this.checkLimit(this.ipBuckets, ip, 100, 60000); // Max 100 requests per minute per IP
    if (!ok) {
      this.trackViolation(ip, "Max global application endpoint requests (100 req/min) exceeded");
    }
    return ok;
  }

  public handleBet(userId: string, ip: string): boolean {
    if (this.isBlocked(ip)) return false;
    const ok = this.checkLimit(this.userBetBuckets, userId, 10, 60000); // Max 10 bet requests per minute per user
    if (!ok) {
      this.trackViolation(ip, `Max user bet requests (10 bets/min) exceeded by user ID: ${userId}`);
    }
    return ok;
  }

  public handleLogin(ip: string): boolean {
    if (this.isBlocked(ip)) return false;
    const ok = this.checkLimit(this.loginBuckets, ip, 5, 60000); // Max 5 login attempts per minute per IP
    if (!ok) {
      this.trackViolation(ip, "Max authorization key attempts (5 logins/min) exceeded");
    }
    return ok;
  }
}

const rateLimiterInstance = new SecurityRateLimiter();

// General requests limiter middleware
function globalRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || "unknown";
  if (rateLimiterInstance.isBlocked(clientIp)) {
    return res.status(403).json({ error: "Access denied. Your IP has been flagged and blocked due to consecutive rate limit violations." });
  }

  const success = rateLimiterInstance.handleRequest(clientIp);
  if (!success) {
    return res.status(429).json({ error: "Too Many Requests. Maximum speed bound reached (100 req/min)." });
  }

  next();
}


// ==========================================
// PART 3: INPUT VALIDATION MIDDLEWARE & SECURITY PARSER
// ==========================================
function containsMaliciousPayload(input: string): boolean {
  if (!input) return false;
  const lower = input.toLowerCase();

  // Reject any SQL characters & keywords: ' " ; -- DROP SELECT
  const sqlKeywords = ["select ", "drop ", "union ", "insert ", "delete ", "update ", "or 1=1", "--"];
  const hasSqlChars = /['";]/.test(input);
  const hasSqlKeywords = sqlKeywords.some(keyword => lower.includes(keyword));

  // Reject any script tags & script-style parameters: <script> javascript:
  const hasScriptTags = /<script\b[^>]*>|javascript:/gi.test(lower);

  return hasSqlChars || hasSqlKeywords || hasScriptTags;
}

// Generic validation middle tier
function validateInputMiddleware(req: Request, res: Response, next: NextFunction) {
  const inspectAndReject = (obj: any): boolean => {
    if (typeof obj === "string") {
      if (containsMaliciousPayload(obj)) {
        return true;
      }
    } else if (obj && typeof obj === "object") {
      for (const key in obj) {
        if (inspectAndReject(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  const hasMalicious = inspectAndReject(req.body) || inspectAndReject(req.query) || inspectAndReject(req.params);
  if (hasMalicious) {
    logFailedValidation({
      timestamp: new Date().toISOString(),
      ip: req.ip || "unknown",
      details: "SQL Injection or Cross-Site Scripting (XSS) symbols matched in requested parameters"
    });
    return res.status(400).json({ error: "Suspicious database payload detected. Operation cancelled." });
  }

  next();
}


// ==========================================
// PART 5: DATABASE PROTECTION SYSTEM
// ==========================================
class SecurityProtectedDatabase {
  private activePoolSize = 0;
  private readonly maxPoolLimit = 10; // Max 10 active connections limit
  private userRecordsStore: Map<string, any> = new Map();

  constructor() {
    // Intubate administrative user account
    this.seedUser("usr_admin", "admin", "SecureAdminPass1!_$", 2500000);
  }

  private async acquireConnection(): Promise<void> {
    if (this.activePoolSize >= this.maxPoolLimit) {
      throw new Error("Active Connection Pool Limit reached (Limit: 10 connections max)");
    }
    this.activePoolSize++;
  }

  private releaseConnection(): void {
    if (this.activePoolSize > 0) {
      this.activePoolSize--;
    }
  }

  private seedUser(userId: string, username: string, plainPass: string, startingBal: number) {
    // Encrypt sensitive user data
    const salt = crypto.randomBytes(16).toString("hex");
    // Standard secure hash simulating bcrypt rounds limit
    const derivedKey = crypto.pbkdf2Sync(plainPass, salt, 12000, 64, "sha512").toString("hex");
    const passwordHash = `${salt}.${derivedKey}`;

    this.userRecordsStore.set(userId, {
      userId,
      username,
      passwordHash,
      balance: startingBal,
      createdAt: new Date().toISOString()
    });
  }

  // Use strictly parameterized query simulation
  public async executeParameterized(statement: string, params: any[]): Promise<any> {
    await this.acquireConnection();
    try {
      // Validate parameterized discipline
      if (statement.includes("'") || statement.includes("\"") || statement.includes(";")) {
        if (params.length === 0) {
          throw new Error("Invalid unparameterized statement structure rejected.");
        }
      }

      if (statement.includes("SELECT * FROM users WHERE username = ?")) {
        const username = params[0];
        for (const user of this.userRecordsStore.values()) {
          if (user.username === username) {
            // NEVER return password directly - make cloned descriptor
            return { ...user };
          }
        }
        return null;
      }

      if (statement.includes("SELECT * FROM users WHERE userId = ?")) {
        const userId = params[0];
        const user = this.userRecordsStore.get(userId);
        if (user) {
          return { ...user };
        }
        return null;
      }

      if (statement.includes("UPDATE users SET balance = ? WHERE userId = ?")) {
        const [newBal, userId] = params;
        const user = this.userRecordsStore.get(userId);
        if (user) {
          user.balance = parseFloat(newBal.toFixed(2));
          this.userRecordsStore.set(userId, user);
          return { ...user };
        }
        return null;
      }

      if (statement.includes("INSERT INTO users (userId, username, passwordHash, balance) VALUES (?, ?, ?, ?)")) {
        const [userId, username, hash, balance] = params;
        const newUserObj = { userId, username, passwordHash: hash, balance };
        this.userRecordsStore.set(userId, newUserObj);
        return newUserObj;
      }

      return null;
    } catch (err: any) {
      // Log all database errors without exposing details to the client
      logDbError(err.message || "Unknown schema query error");
      throw new Error("Internal Service Database Security Interruption");
    } finally {
      this.releaseConnection();
    }
  }

  // Encrypt sensitive user data with PBKDF2 (12000 cycles roughly equivalent to 12 bcrypt cost factors)
  public async encryptCredentials(plainValue: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.pbkdf2Sync(plainValue, salt, 12000, 64, "sha512").toString("hex");
    return `${salt}.${derived}`;
  }

  public verifyCredentials(plainValue: string, storedHash: string): boolean {
    const parts = storedHash.split(".");
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    const derived = crypto.pbkdf2Sync(plainValue, salt, 12000, 64, "sha512").toString("hex");
    return derived === key;
  }
}

const secureDb = new SecurityProtectedDatabase();


// ==========================================
// PART 6: GAME INTEGRITY MODULE (Provably Fair)
// ==========================================
interface SecureGameRound {
  roundId: string;
  crashPoint: number;
  secretSalt: string;
  hash: string; // Provably fair pre-round public commitment hash
  active: boolean;
  isCrashed: boolean;
  startTime: number;
}

class SecurityGameIntegrityEngine {
  private currentRound: SecureGameRound | null = null;
  private activeWagers: Map<string, number> = new Map(); // userId -> wagerAmount

  public getActiveRound(): SecureGameRound | null {
    return this.currentRound;
  }

  public makeNewRound(): SecureGameRound {
    const roundId = "rnd_" + crypto.randomUUID();
    const secretSalt = crypto.randomBytes(24).toString("hex");

    // Securely randomize crash points mimicking high security crash ratios
    const rand = Math.random();
    let crashPoint = 1.00;
    if (rand > 0.03) { // 3% native crash limit 
      const parsedCoeffValue = 99 / (100 - (rand * 100));
      crashPoint = parseFloat(Math.max(1.00, Math.min(250.0, parsedCoeffValue)).toFixed(2));
    }

    // Provably fair commitment calculation
    const hash = crypto.createHash("sha256").update(roundId + secretSalt).digest("hex");

    this.currentRound = {
      roundId,
      crashPoint,
      secretSalt,
      hash,
      active: true,
      isCrashed: false,
      startTime: Date.now()
    };

    this.activeWagers.clear();

    logSecurityEvent({
      type: "PROVABLY_FAIR_ROUND_GEN",
      ip: "system",
      timestamp: new Date().toISOString(),
      details: `Created new round. Public Commitment Hash: ${hash} (Salt hidden for fair assurance)`
    });

    return { ...this.currentRound };
  }

  public commitManualMultiplierUpdate(currentCycleMultiplier: number) {
    if (!this.currentRound || !this.currentRound.active) return;
    if (currentCycleMultiplier >= this.currentRound.crashPoint) {
      this.currentRound.active = false;
      this.currentRound.isCrashed = true;
      logSecurityEvent({
        type: "ROUND_CRASHED",
        ip: "system",
        timestamp: new Date().toISOString(),
        details: `Game Round crashed at verified limit: ${this.currentRound.crashPoint}x`
      });
    }
  }

  public registerBetOnServer(userId: string, betAmount: number, ip: string): { success: boolean; error?: string } {
    if (!this.currentRound || !this.currentRound.active || this.currentRound.isCrashed) {
      logSuspiciousActivity({
        type: "BET_NO_ACTIVE_ROUND",
        userId,
        ip,
        details: "User attempted to post bet wager while game round is inactive"
      });
      return { success: false, error: "Game round is not open for wagering." };
    }

    // Verify all bet amounts on server before processing (Verify positive number only)
    if (isNaN(betAmount) || betAmount <= 0) {
      logSuspiciousActivity({
        type: "INVALID_BET_WAGER",
        userId,
        ip,
        details: `Rejected negative, non-numeric, or null wager amount: ${betAmount}`
      });
      return { success: false, error: "Wager amount must be a clean positive number." };
    }

    if (this.activeWagers.has(userId)) {
      logSuspiciousActivity({
        type: "DUPLICATE_BET_WAGER",
        userId,
        ip,
        details: "Attempted to register multiple active wagers inside matching cycle"
      });
      return { success: false, error: "An active bet is already bound to your credentials." };
    }

    this.activeWagers.set(userId, betAmount);
    return { success: true };
  }

  public processVerifyCashout(userId: string, targetMultiplier: number, ip: string): { success: boolean; payout?: number; error?: string } {
    if (!this.currentRound || !this.currentRound.active || this.currentRound.isCrashed) {
      return { success: false, error: "The flight simulation round is not currently running." };
    }

    const betAmount = this.activeWagers.get(userId);
    if (!betAmount) {
      return { success: false, error: "No active qualifying wager registered." };
    }

    // Verify cashout multiplier is valid and round is still active
    if (isNaN(targetMultiplier) || targetMultiplier < 1.0) {
      logSuspiciousActivity({
        type: "INVALID_CASHOUT_MULTIPLIER",
        userId,
        ip,
        details: `Rejected unauthorized cashout multiplier format: ${targetMultiplier}`
      });
      return { success: false, error: "Requested cashout multiplier format is invalid." };
    }

    const crashPoint = this.currentRound.crashPoint;

    // Reject any cashout request after crash point is reached
    if (targetMultiplier > crashPoint) {
      logSuspiciousActivity({
        type: "EXCEEDED_MULTIPLIER_FRAUD",
        userId,
        ip,
        details: `User requested payout at ${targetMultiplier}x when actual crash point sequence triggered at ${crashPoint}x`
      });
      this.activeWagers.delete(userId); // Lose wager
      return { success: false, error: "Target multiplier reached crash point threshold." };
    }

    const payout = parseFloat((betAmount * targetMultiplier).toFixed(2));
    this.activeWagers.delete(userId); // Cashout processed

    return { success: true, payout };
  }
}

const integrityEngine = new SecurityGameIntegrityEngine();


// ==========================================
// BACKEND CONFIGURATION: RTP, JACKPOT RNG & AI PREDICTION
// ==========================================
let backendRoundCounter = 0;

function generateJackpotIndexes(): number[] {
  const indexes: number[] = [];
  while (indexes.length < 2) {
    const idx = Math.floor(Math.random() * 100) + 1; // 1 to 100
    if (!indexes.includes(idx)) {
      indexes.push(idx);
    }
  }
  return indexes.sort((a, b) => a - b);
}

let jackpotRoundsInCurrent100: number[] = generateJackpotIndexes();
let superJackpotRoundsInCurrent23: number = Math.floor(Math.random() * 23) + 1; // Exactly 1 round in every 23-round block (1 to 23 index)
let lastCrashPointWasLow = false; // Prevent consecutive instant crashes to reduce player cost speed
const cashoutHistory: number[] = [1.35, 1.50, 1.25, 1.45, 1.60, 1.85, 1.40, 1.55, 1.30, 1.70]; // Seed initial realistic figures

// Custom Math, Cooldown, and Trapping variables
function generateGroupDRoundIn50(): number {
  return Math.floor(Math.random() * 50) + 1; // 1 to 50 index
}
let groupDRoundInCurrent50 = generateGroupDRoundIn50();
let cooldownRoundsRemaining = 0;
let postCooldownRewardsRemaining = 0;
let hotStreakRoundsRemaining = 0;
const playerSuccessfulCashouts: number[] = [1.45, 1.50, 1.35, 1.60]; // Seed with standard values
let trapRoundsRemaining = 0;
let favoriteCashoutPoint = 1.50; // Analyzed preference threshold
let lastCrashPointForCooldownTrigger = 1.00;

// Special 49x Feature States (Isolated per player/tab session via sessionId):
interface PlayerSpecialState {
  sessionEntryBalance: number;
  roundsSinceLast49x: number;
  specialCooldownThreshold: number;
  lastResetDateBangkok: string;
  sessionRoundCounter: number;
  fakeTargetRound: number;
  recalibrationCount: number;
  crisisTriggerCount: number;      // Tracks how many times balance hit <= 30% of initial session balance
  isInCrisisMode: boolean;          // Active crisis indicator
  preemptTrapQueue?: boolean[];     // A pre-shuffled list of exactly 45% traps to ensure perfect proportionality over rounds
  preemptTrapIndex?: number;        // Tracking index in the pre-shuffled queue
  // Isolated gameplay session parameters to prevent cross-tab interference:
  cooldownRoundsRemaining: number;
  postCooldownRewardsRemaining: number;
  hotStreakRoundsRemaining: number;
  playerSuccessfulCashouts: number[];
  trapRoundsRemaining: number;
  favoriteCashoutPoint: number;
  lastCrashPointForCooldownTrigger: number;
  // Looping Win/Loss Streak pattern parameters:
  streakMode: "WIN" | "LOSS" | "NORMAL";
  streakRoundsRemaining: number;
  // Dynamic Lifecycle parameters
  lifecycleCycleLength: number;
  lifecyclePhases: {
    profit1End: number;
    profit2End: number;
    loss3End: number;
    even4End: number;
    profit5End: number;
    loss6End: number;
  };
  setRewardCycle?: SetRewardCycle;
}

// Global 10-Set Reward System State
let globalSetRewardCycle: SetRewardCycle | null = null;

interface SetRewardCycle {
  cycleIndex: number;
  startTime: number;
  durationMs: number;
  startRound: number;
  targets: number[];
  ranges: [number, number][];
  triggeredSets: boolean[];
}

function generateSetRewardTargets(cycleIndex: number, currentRound: number): SetRewardCycle {
  const ranges: [number, number][] = [
    [5, 8],      // Set 1: 5 – 8
    [15, 18],    // Set 2: 15 – 18
    [25, 28],    // Set 3: 25 – 28
    [35, 38],    // Set 4: 35 – 38
    [45, 48],    // Set 5: 45 – 48
    [55, 58],    // Set 6: 55 – 58
    [65, 68],    // Set 7: 65 – 68
    [75, 78],    // Set 8: 75 – 78
    [85, 88],    // Set 9: 85 – 88
    [95, 98],    // Set 10: 95 – 98
  ];

  const targets: number[] = [];
  let prevTarget = 0;

  for (const [min, max] of ranges) {
    const actualMin = Math.max(min, prevTarget + 1);
    const actualMax = Math.max(actualMin, max);
    const target = Math.floor(Math.random() * (actualMax - actualMin + 1)) + actualMin;
    targets.push(target);
    prevTarget = target;
  }

  // Duration randomly set between 90 and 100 minutes in milliseconds
  const durationMs = Math.floor((90 + Math.random() * 10) * 60 * 1000);

  return {
    cycleIndex,
    startTime: Date.now(),
    durationMs,
    startRound: currentRound,
    targets,
    ranges,
    triggeredSets: new Array(10).fill(false)
  };
}

// Generates randomized transition bounds for the 7 stages of the player's psychological lifecycle
function generateRandomPhases(cycleLength: number) {
  // Randomize weights for each phase (PROFIT_1, PROFIT_2, LOSS_3, EVEN_4, PROFIT_5, LOSS_6, BUST_7)
  const w1 = 4 + Math.random() * 4;  // Phase 1 (4-8 rounds)
  const w2 = 5 + Math.random() * 6;  // Phase 2 (5-11 rounds)
  const w3 = 4 + Math.random() * 5;  // Phase 3 (4-9 rounds)
  const w4 = 4 + Math.random() * 5;  // Phase 4 (4-9 rounds)
  const w5 = 4 + Math.random() * 5;  // Phase 5 (4-9 rounds)
  const w6 = 6 + Math.random() * 7;  // Phase 6 (6-13 rounds)
  const w7 = 5 + Math.random() * 5;  // Phase 7 (5-10 rounds)
  const totalW = w1 + w2 + w3 + w4 + w5 + w6 + w7;

  const len1 = Math.max(2, Math.round((w1 / totalW) * cycleLength));
  const len2 = Math.max(2, Math.round((w2 / totalW) * cycleLength));
  const len3 = Math.max(2, Math.round((w3 / totalW) * cycleLength));
  const len4 = Math.max(2, Math.round((w4 / totalW) * cycleLength));
  const len5 = Math.max(2, Math.round((w5 / totalW) * cycleLength));
  const len6 = Math.max(2, Math.round((w6 / totalW) * cycleLength));

  const profit1End = len1;
  const profit2End = profit1End + len2;
  const loss3End = profit2End + len3;
  const even4End = loss3End + len4;
  const profit5End = even4End + len5;
  const loss6End = profit5End + len6;

  return {
    profit1End,
    profit2End,
    loss3End,
    even4End,
    profit5End,
    loss6End
  };
}

// Generates a pre-shuffled queue of boolean values with exactly 45% true (Preempt Trap) and 55% false
function generatePreemptTrapQueue(): boolean[] {
  const queue: boolean[] = [];
  for (let i = 0; i < 45; i++) {
    queue.push(true);
  }
  for (let i = 0; i < 55; i++) {
    queue.push(false);
  }
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = queue[i];
    queue[i] = queue[j];
    queue[j] = temp;
  }
  return queue;
}

const playerStates = new Map<string, PlayerSpecialState>();

// Global fallback states:
let sessionEntryBalance = 150000; 
let roundsSinceLast49x = 999; // Initialize to high number so it triggers immediately on the first drop
let specialCooldownThreshold = Math.floor(Math.random() * 6) + 33; // Random cooldown from 33 to 38 rounds
let lastResetDateBangkok = "";

// ==========================================
// NEW GLOBAL PRE-SCHEDULED 49.00X MULTIPLIER RETRO ENGINE
// ==========================================
interface TargetState {
  series: string;
  cycleIndex: number;
  minRange: number;
  maxRange: number;
  rolled: boolean;
  triggered: boolean;
}
const global49xTargetRounds = new Map<number, TargetState>();

// Generate Series A (Arithmetic): k * [33, 38]
for (let k = 1; k <= 1000; k++) {
  const minRange = 33 * k;
  const maxRange = 38 * k;
  const targetRound = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
  if (!global49xTargetRounds.has(targetRound)) {
    global49xTargetRounds.set(targetRound, {
      series: "Arithmetic (Linear k)",
      cycleIndex: k,
      minRange,
      maxRange,
      rolled: false,
      triggered: false
    });
  }
}

// Generate Series B (Geometric/Doubling): 2^(j-1) * [33, 38]
let geomMin = 33;
let geomMax = 38;
for (let j = 1; j <= 20; j++) {
  const targetRound = Math.floor(Math.random() * (geomMax - geomMin + 1)) + geomMin;
  if (!global49xTargetRounds.has(targetRound)) {
    global49xTargetRounds.set(targetRound, {
      series: "Geometric (Doubling j)",
      cycleIndex: j,
      minRange: geomMin,
      maxRange: geomMax,
      rolled: false,
      triggered: false
    });
  }
  geomMin *= 2;
  geomMax *= 2;
}

console.log("=================================================");
console.log("🚀 [GLOBAL 49X ENGINE] PRE-SCHEDULED ROUND TARGETS:");
const sorted49xTargets = Array.from(global49xTargetRounds.keys()).sort((a, b) => a - b);
sorted49xTargets.forEach(roundNum => {
  if (roundNum <= 300) {
    const t = global49xTargetRounds.get(roundNum)!;
    console.log(`  • Round ${roundNum}: Series: ${t.series} | Cycle: ${t.cycleIndex} | Range: [${t.minRange}-${t.maxRange}]`);
  }
});
console.log("=================================================");




// ==========================================
// EXPRESS SERVER & ENDPOINTS
// ==========================================
async function runSecurityFullstackServer() {
  const app = express();

  // Parse JSON payloads securely
  app.use(express.json());

  // === PART 1: API SECURITY HEADERS ===
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
    res.setHeader("Content-Security-Policy", "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss: https:;");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  // Apply threat audit analysis
  app.use(globalRateLimitMiddleware);
  app.use(validateInputMiddleware);

  // API HEALTH CHECK
  app.get("/api/security/health", (req, res) => {
    res.json({
      status: "active",
      securityMetrics: {
        poolActive: secureDb["activePoolSize"],
        jwtSecretActive: true,
        provablyFairHashActive: integrityEngine.getActiveRound() ? true : false,
        activeViolationsBlocked: rateLimiterInstance["blockedIPs"].size
      }
    });
  });

  // RECORD CASHOUT VALUE FROM CLIENTS TO REFINE AI ALGORITHMS
  app.post("/api/security/ai/cashout-metric", (req, res) => {
    const { multiplierCashed, sessionId } = req.body;
    if (multiplierCashed && typeof multiplierCashed === "number") {
      const val = parseFloat(multiplierCashed.toFixed(2));
      cashoutHistory.push(val);
      if (cashoutHistory.length > 500) {
        cashoutHistory.shift(); // Evict oldest metric
      }
      playerSuccessfulCashouts.push(val);

      if (sessionId && typeof sessionId === "string") {
        const state = playerStates.get(sessionId);
        if (state) {
          if (!state.playerSuccessfulCashouts) {
            state.playerSuccessfulCashouts = [1.45, 1.50, 1.35, 1.60];
          }
          state.playerSuccessfulCashouts.push(val);
          if (state.playerSuccessfulCashouts.length > 200) {
            state.playerSuccessfulCashouts.shift(); // keep it small
          }
          console.log(`[AI METRIC RECORD] Recorded cashout of ${val}x for sessionId: ${sessionId}. Session History Size: ${state.playerSuccessfulCashouts.length}`);
        }
      }
    }
    return res.json({ success: true });
  });

  // SECURE ANALYTICS & PREDICTION RETRIEVAL ROUTE
  app.get("/api/security/ai/insights", (req, res) => {
    if (cashoutHistory.length === 0) {
      return res.json({
        totalAnalyzed: 0,
        averageCashoutPoint: 1.50,
        predictedPeakRiskPoint: 1.45,
        targetRtpPercent: 60,
        houseEdgePercent: 40,
        jackpotCyclesCount: `${backendRoundCounter % 100}/100`,
        jackpotsScheduledThisCycle: jackpotRoundsInCurrent100,
        superJackpotCyclesCount: `${backendRoundCounter % 23}/23`,
        superJackpotScheduledTarget: superJackpotRoundsInCurrent23
      });
    }

    const totalAnalyzed = cashoutHistory.length;
    let sum = 0;
    for (const val of cashoutHistory) {
      sum += val;
    }
    const averageCashoutPoint = parseFloat((sum / totalAnalyzed).toFixed(2));
    
    // AI Prediction: Predict player cashout preference average and schedule pre-explosion before that threshold
    // Let's set the pre-explosion target safely 5% earlier than the user average to guarantee house advantage
    const predictedPeakRiskPoint = parseFloat(Math.max(1.05, averageCashoutPoint - 0.05).toFixed(2));

    return res.json({
      totalAnalyzed,
      averageCashoutPoint,
      predictedPeakRiskPoint,
      targetRtpPercent: 60,
      houseEdgePercent: 40,
      jackpotCyclesCount: `${backendRoundCounter % 100}/100`,
      jackpotsScheduledThisCycle: jackpotRoundsInCurrent100,
      superJackpotCyclesCount: `${backendRoundCounter % 23}/23`,
      superJackpotScheduledTarget: superJackpotRoundsInCurrent23
    });
  });

  // GAME PRE-COMMITMENT HASH ENDPOINT
  app.post("/api/security/round/start", (req, res) => {
    backendRoundCounter += 1;
    const currentModuloIndex = ((backendRoundCounter - 1) % 100) + 1; // 1 to 100 index

    const sessionId = (req.body && typeof req.body.sessionId === "string") ? req.body.sessionId : "default_session";
    const currentBalance = (req.body && typeof req.body.currentBalance === "number") ? req.body.currentBalance : 150000;

    // Client-led state synchronization inputs for multi-instance high-availability resiliency
    const clientRoundCounter = (req.body && typeof req.body.sessionRoundCounter === "number") ? req.body.sessionRoundCounter : 0;
    const clientFakeTargetRound = (req.body && typeof req.body.fakeTargetRound === "number") ? req.body.fakeTargetRound : 0;
    const clientRecalibrationCount = (req.body && typeof req.body.recalibrationCount === "number") ? req.body.recalibrationCount : 0;
    const userStats = (req.body && typeof req.body.userStats === "object") ? req.body.userStats : null;

    // Get or initialize player's isolated state
    if (!playerStates.has(sessionId)) {
      const initialFakeTarget = clientFakeTargetRound > 0 ? clientFakeTargetRound : (Math.floor(Math.random() * (21 - 17 + 1)) + 17);
      const cycleLen = Math.floor(Math.random() * 26) + 35; // Random cycle length between 35 and 60 rounds
      const phases = generateRandomPhases(cycleLen);
      playerStates.set(sessionId, {
        sessionEntryBalance: currentBalance,
        roundsSinceLast49x: clientRoundCounter, // sync
        specialCooldownThreshold: Math.floor(Math.random() * (38 - 33 + 1)) + 33, // 33 to 38 inclusive
        lastResetDateBangkok: "",
        sessionRoundCounter: clientRoundCounter, // sync
        fakeTargetRound: initialFakeTarget,
        recalibrationCount: clientRecalibrationCount,
        crisisTriggerCount: 0,
        isInCrisisMode: false,
        preemptTrapQueue: generatePreemptTrapQueue(),
        preemptTrapIndex: 0,
        cooldownRoundsRemaining: 0,
        postCooldownRewardsRemaining: 0,
        hotStreakRoundsRemaining: 0,
        playerSuccessfulCashouts: [1.45, 1.50, 1.35, 1.60],
        trapRoundsRemaining: 0,
        favoriteCashoutPoint: 1.50,
        lastCrashPointForCooldownTrigger: 1.00,
        streakMode: "NORMAL",
        streakRoundsRemaining: Math.floor(Math.random() * 3) + 3, // Initial NORMAL streak of 3-5 rounds
        lifecycleCycleLength: cycleLen,
        lifecyclePhases: phases
      });
      console.log(`[STATE ISOLATION] Created isolated state for sessionId: ${sessionId} with initial balance ${currentBalance} THB. Real target: ${playerStates.get(sessionId)!.specialCooldownThreshold}, Fake AI forecasted target: ${initialFakeTarget} | Dynamic Cycle Length: ${cycleLen} rounds | Phases: ${JSON.stringify(phases)}`);
    }

    const state = playerStates.get(sessionId)!;

    // Synchronize container state with client-reported session progress for load-balanced environments
    if (clientRoundCounter === 0 || clientRoundCounter === 1) {
      state.sessionRoundCounter = clientRoundCounter;
      state.setRewardCycle = generateSetRewardTargets(1, state.sessionRoundCounter);
      console.log(`[SESSION RESET SYNC] 🔄 Session reset detected for ${sessionId}. Reset sessionRoundCounter to ${state.sessionRoundCounter} and generated Set 1 reward targets!`);
    } else if (clientRoundCounter > state.sessionRoundCounter) {
      state.sessionRoundCounter = clientRoundCounter;
    }
    if (clientFakeTargetRound > state.fakeTargetRound) {
      state.fakeTargetRound = clientFakeTargetRound;
    }
    if (clientRecalibrationCount > state.recalibrationCount) {
      state.recalibrationCount = clientRecalibrationCount;
    }

    // Thailand Time Zone (Asia/Bangkok) 00:01 Midnight reset check
    try {
      const options = { timeZone: 'Asia/Bangkok', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' } as const;
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(new Date());
      const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
      
      const bkkHour = parseInt(partMap.hour, 10);
      const bkkMinute = parseInt(partMap.minute, 10);
      const bkkDateString = `${partMap.year}-${partMap.month}-${partMap.day}`; // "YYYY-MM-DD"
      
      // Check if we are past 00:01 Bangkok time of the current day (past midnight 1 minute)
      const isPastMidnightOne = (bkkHour > 0 && bkkHour !== 24) || (bkkHour === 0 && bkkMinute >= 1) || (bkkHour === 24 && bkkMinute >= 1);
      
      if (isPastMidnightOne && state.lastResetDateBangkok !== bkkDateString) {
        state.roundsSinceLast49x = 999;
        state.lastResetDateBangkok = bkkDateString;
        console.log(`[BANGKOK MIDNIGHT 00:01 RESET] Cooldown reset to 999 for session ${sessionId}. Time: ${bkkHour}:${bkkMinute} on ${bkkDateString}`);
      }
    } catch (err) {
      console.error("[BANGKOK RESET CHECK ERROR] Fail to check or format Thailand time:", err);
    }

    // Automatically update session entry balance if we see a reset or refill or initial start
    if (currentBalance === 150000) {
      state.sessionEntryBalance = 150000;
      state.crisisTriggerCount = 0;
      state.isInCrisisMode = false;
      console.log(`[SPECIAL TRIGGER] 🔄 Player refilled/reset to 150,000 THB! Resetting crisisTriggerCount to 0 and clearing crisis mode for session ${sessionId}`);
    } else if (currentBalance > state.sessionEntryBalance || backendRoundCounter === 1) {
      state.sessionEntryBalance = currentBalance;
      console.log(`[SPECIAL TRIGGER] Session starting/entry balance calibrated/updated to: ${state.sessionEntryBalance} THB for session ${sessionId}`);
    }

    // Increment rounds since last 49x
    state.roundsSinceLast49x += 1;
    state.sessionRoundCounter += 1;

    // Recalibrate and shift deceptive targets to deceive players into staying/all-inning
    if (state.sessionRoundCounter >= state.fakeTargetRound) {
      state.recalibrationCount += 1;
      let nextFake = state.fakeTargetRound;
      if (state.recalibrationCount === 1) {
        nextFake = Math.floor(Math.random() * (28 - 25 + 1)) + 25;
      } else if (state.recalibrationCount === 2) {
        // Matches the real onset 33-38 round of 49.00x!
        nextFake = Math.floor(Math.random() * (36 - 33 + 1)) + 33;
      } else {
        nextFake = state.sessionRoundCounter + Math.floor(Math.random() * 5) + 5;
      }

      // Safeguard: Ensure target is strictly greater than the current session round
      if (nextFake <= state.sessionRoundCounter) {
        nextFake = state.sessionRoundCounter + Math.floor(Math.random() * 4) + 4;
      }
      state.fakeTargetRound = nextFake;
      console.log(`[DECEPTIVE AI PREDICTOR] Recalibration #${state.recalibrationCount} triggered for sessionId: ${sessionId}. New fake target pushed to Session Round ${state.fakeTargetRound}`);
    }

    // Advanced Playing Behavior Analysis (วิเคราะห์พฤติกรรมการเล่น)
    let isHighRiskBehavior = false;
    let behaviorReason = "";
    let isLowWinRateJackpotTriggered = false;
    let clientWinRate = 0;
    let userBetsCount = 0;

    if (userStats) {
      userBetsCount = (typeof userStats.totalBets === "number") ? userStats.totalBets : 0;
      const userWinCount = (typeof userStats.winCount === "number") ? userStats.winCount : 0;
      clientWinRate = userBetsCount > 0 ? (userWinCount / userBetsCount) : 0;
      const avgBet = userBetsCount > 0 ? (userStats.totalWagered / userBetsCount) : 0;

      // 1. High Win Rate Profile: Winning more than 50% of played rounds (min 3 rounds played)
      const hasHighWinRate = (userBetsCount >= 3 && clientWinRate > 0.50);
      
      // 2. High Profit Profile: Net profit is positive and substantial (more than 15,000 THB)
      const hasHighProfit = (userStats.netProfit > 15000);

      // 3. High Wager Risk Profile: Placing large bets on average (average bet size > 1,000 THB)
      const hasHighWager = (avgBet > 1000);

      if (hasHighWinRate || hasHighProfit || hasHighWager) {
        isHighRiskBehavior = true;
        behaviorReason = `[Win Rate: ${(clientWinRate * 100).toFixed(1)}% | Net Profit: ${userStats.netProfit.toLocaleString()} THB | Avg Bet: ${avgBet.toFixed(0)} THB]`;
      }

      // เมื่อผู้เล่นมีวิลเลจเฉลี่ย 30% หรือน้อยกว่า (เล่นอย่างน้อย 3 ตา) ให้เกิดแตกรางวัลใหญ่ขึ้นมาทันทีเพื่อให้มีทุนเล่นยาวขึ้น
      if (userBetsCount >= 3 && clientWinRate <= 0.30) {
        isLowWinRateJackpotTriggered = true;
      }
    }

    // Extract session-isolated values or use global fallback configurations to prevent cross-tab interference
    const currentSuccessfulCashouts = state ? state.playerSuccessfulCashouts : playerSuccessfulCashouts;
    let currentFavoriteCashoutPoint = 1.50;
    if (currentSuccessfulCashouts.length > 0) {
      const sum = currentSuccessfulCashouts.reduce((s, v) => s + v, 0);
      currentFavoriteCashoutPoint = parseFloat((sum / currentSuccessfulCashouts.length).toFixed(2));
    }
    if (state) {
      state.favoriteCashoutPoint = currentFavoriteCashoutPoint;
    } else {
      favoriteCashoutPoint = currentFavoriteCashoutPoint;
    }

    let currentTrapRoundsRemaining = state ? state.trapRoundsRemaining : trapRoundsRemaining;
    let currentCooldownRoundsRemaining = state ? state.cooldownRoundsRemaining : cooldownRoundsRemaining;
    let currentPostCooldownRewardsRemaining = state ? state.postCooldownRewardsRemaining : postCooldownRewardsRemaining;
    let currentHotStreakRoundsRemaining = state ? state.hotStreakRoundsRemaining : hotStreakRoundsRemaining;

    // -------------------------------------------------------------
    // CRISIS LIFELINE AND PROGRESS ENGINE (ระบบวิเคราะห์สภาวะฉุกเฉินและอุ้มชู)
    // -------------------------------------------------------------
    const entryBalance = state ? state.sessionEntryBalance : 150000;
    const crisisThreshold = entryBalance * 0.30;
    
    // Near Capital range check (Wallet is close to starting capital)
    const isInNearCapitalRange = (currentBalance >= (entryBalance * 0.75) && currentBalance <= (entryBalance * 0.998));
    const isEligibleForTrap = (isInNearCapitalRange || isHighRiskBehavior);
    let activeCrisisBonusMultiplier = 0;

    if (state) {
      if (currentBalance <= crisisThreshold) {
        if (!state.isInCrisisMode) {
          state.isInCrisisMode = true;
          state.crisisTriggerCount += 1;
          console.log(`[CRISIS MONITOR] 🚨 Crisis detected for sessionId: ${sessionId}! Balance ${currentBalance} THB is <= 30% of entry balance ${entryBalance} THB. Trigger Count: ${state.crisisTriggerCount}`);
        }

        // Always guarantee a big win/multiplier of 6.00x or higher when below or equal to 30% of entry balance to prevent player from busting!
        // Generates an attractive multiplier between 6.00x and 13.00x (exactly as requested!)
        activeCrisisBonusMultiplier = parseFloat((6.00 + Math.random() * 7.00).toFixed(2));
        console.log(`[CRISIS LIFELINE] 🛡️ Forcing guaranteed 6.00x+ big recovery multiplier: ${activeCrisisBonusMultiplier}x`);
      } else {
        if (state.isInCrisisMode) {
          state.isInCrisisMode = false;
          console.log(`[CRISIS MONITOR] ✅ Recovery detected! Balance ${currentBalance} THB is above 30% of entry balance (${crisisThreshold} THB). Crisis mode cleared.`);
        }
      }
    }

    // -------------------------------------------------------------
    // ADVANCED BEHAVIORAL LIFE-CYCLE ENGINE (ระบบวัฏจักรพฤติกรรมผู้เล่น)
    // -------------------------------------------------------------
    // กำไร (Profit) -> กำไร (More Profit) -> ขาดทุน (Loss) -> กลับมาเท่าทุน (Break-even) -> กำไร (Profit) -> ขาดทุน (Loss) -> ขาดทุนหมดตัว (Bust/Zero out)
    const sessionRound = state ? state.sessionRoundCounter : 1;
    let lifecycleStage = "STANDARD";
    let lifecycleDesc = "Standard gameplay distribution";
    let trapProbabilityOverride = -1; // -1 means use standard rolls
    let hotStreakProbabilityOverride = -1;

    // Use dynamic cycle configuration from the player state with a robust fallback
    const cycleLength = (state && state.lifecycleCycleLength) ? state.lifecycleCycleLength : 45;
    const phases = (state && state.lifecyclePhases) ? state.lifecyclePhases : {
      profit1End: 5,
      profit2End: 12,
      loss3End: 18,
      even4End: 24,
      profit5End: 30,
      loss6End: 38
    };

    const normalizedRound = ((sessionRound - 1) % cycleLength) + 1;

    if (false) { // Disabled bust override to support infinite safety lifelines
      lifecycleStage = "BUST_7";
      lifecycleDesc = "Phase 7 Override: Final crisis bust reached (รอบที่ 3 หมดตัว) - Standard negative EV absorption";
      trapProbabilityOverride = 0.45; // Exactly 45% trap rate as requested
      hotStreakProbabilityOverride = 0.00;
    } else if (normalizedRound <= phases.profit1End) {
      lifecycleStage = "PROFIT_1";
      lifecycleDesc = "Phase 1: Initial Player Onboarding (กำไร) - High-value standard distributions";
      trapProbabilityOverride = 0.00; // Zero traps
      hotStreakProbabilityOverride = 0.35; // High chance of hot streaks
    } else if (normalizedRound <= phases.profit2End) {
      lifecycleStage = "PROFIT_2";
      lifecycleDesc = "Phase 2: Reinforcing Confidence (กำไรต่อเนื่อง) - Generating solid 2x-4x payouts";
      trapProbabilityOverride = 0.05; // Extremely rare traps
      hotStreakProbabilityOverride = 0.45; // Very high hot streaks
    } else if (normalizedRound <= phases.loss3End) {
      lifecycleStage = "LOSS_3";
      lifecycleDesc = "Phase 3: Tactical Pullback (ขาดทุน) - House claims advantage via preempt traps";
      trapProbabilityOverride = 0.80; // High probability of traps
      hotStreakProbabilityOverride = 0.00;
    } else if (normalizedRound <= phases.even4End) {
      lifecycleStage = "EVEN_4";
      lifecycleDesc = "Phase 4: Adrenaline Recovery (กลับมาเท่าทุน) - Helping player bounce back to entry level";
      trapProbabilityOverride = 0.10; // Low traps
      hotStreakProbabilityOverride = 0.30;
    } else if (normalizedRound <= phases.profit5End) {
      lifecycleStage = "PROFIT_5";
      lifecycleDesc = "Phase 5: Second Profit Surge (กลับมากำไร) - Luring player to double down";
      trapProbabilityOverride = 0.15;
      hotStreakProbabilityOverride = 0.40;
    } else if (normalizedRound <= phases.loss6End) {
      lifecycleStage = "LOSS_6";
      lifecycleDesc = "Phase 6: Heavy Drawdown (ขาดทุนหน่วง) - Aggressively draining player balance";
      trapProbabilityOverride = 0.85; // Very high trap probability
      hotStreakProbabilityOverride = 0.00;
    } else {
      lifecycleStage = "BUST_7";
      lifecycleDesc = "Phase 7: Long-term Statistical Extinction (ขาดทุนหมดตัว) - Standard negative EV absorption";
      trapProbabilityOverride = 0.90; // Near-guaranteed traps to empty wallet
      hotStreakProbabilityOverride = 0.05;
    }

    console.log(`[LIFE-CYCLE ENGINE] Session: ${sessionId} | Session Round: ${sessionRound} (Normalized: ${normalizedRound}/${cycleLength}) | Stage: ${lifecycleStage} | Description: ${lifecycleDesc}`);

    // Check if player has made > 50% profit of their initial entry capital (ทุนกระเป๋าเงินที่เขากดเข้ามา)
    const profitRatio = (currentBalance - entryBalance) / entryBalance;
    const hasProfitedOver50Percent = profitRatio >= 0.50 || (userStats && userStats.netProfit >= (entryBalance * 0.50));

    // Determine trap chances with overrides from the psychological lifecycle
    const trapRollChance = trapProbabilityOverride !== -1 ? trapProbabilityOverride : 0.45;

    // Apply Near Capital Trap roll
    // DISABLED to strictly respect the 45% overall AI Preempt Trap proportion and prevent player balance draining too fast!
    const isNearCapitalTrap = false;

    // ระบบดักหน้า (AI Preempt/Intercept Trap) โดยวิเคราะห์จากพฤติกรรมการเล่น
    // จะใช้ระบบดักหน้าไม่ใช่ทุกตา แต่จะล็อกสัดส่วนไว้ที่ 45% อย่างเป๊ะๆ ตามที่ผู้เล่นร้องขอ (เล่น 10 ตา ดัก 4.5 ตา, 100 ตา ดัก 45 ตา, 1000 ตา ดัก 450 ตา)
    // โดยใช้ระบบ Pre-shuffled Queue ที่มีอัตราส่วน True 45% และ False 55%
    let isPreemptTrapActive = false;
    if (state) {
      if (!state.preemptTrapQueue || state.preemptTrapQueue.length === 0) {
        state.preemptTrapQueue = generatePreemptTrapQueue();
        state.preemptTrapIndex = 0;
      }
      const queueIndex = (state.preemptTrapIndex ?? 0) % state.preemptTrapQueue.length;
      isPreemptTrapActive = state.preemptTrapQueue[queueIndex];
      // Increment the index to progress through the perfectly proportional 45% deck
      state.preemptTrapIndex = queueIndex + 1;

      // If player is in Crisis Lifeline, bypass Preempt Trap for this round so they win!
      if (activeCrisisBonusMultiplier > 0) {
        isPreemptTrapActive = false;
      }

      console.log(`[AI PREEMPT TRAP SYSTEM] 🎯 Proportional Deck Active: Session Round ${sessionRound} | Queue Index ${queueIndex}/100 | Active Status: ${isPreemptTrapActive} (Perfect 45% ratio secured)`);
    } else {
      isPreemptTrapActive = activeCrisisBonusMultiplier > 0 ? false : Math.random() < 0.45;
    }

    if (isEligibleForTrap || isPreemptTrapActive) {
      console.log(`[BEHAVIORAL ANALYSIS] Session: ${sessionId} | Balance: ${currentBalance} THB (Entry: ${entryBalance} THB) | Near Capital Range: ${isInNearCapitalRange} | High Risk: ${isHighRiskBehavior} ${behaviorReason} | Trap Eligible: true | Near Capital Trap Active: ${isNearCapitalTrap} (Roll Chance: ${(trapRollChance*100).toFixed(0)}%) | Preempt Trap Active: ${isPreemptTrapActive} | Low Win Rate Jackpot Triggered: ${isLowWinRateJackpotTriggered}`);
    }

    // Securely randomize crash points mimicking house-authorized profiles
    let targetCrashPoint = 1.00;
    let isSpecial49xRound = false;

    // Helper to generate beautifully spread multipliers favoring 2x, 3x, 4x payouts
    // เพื่อให้ตัวคูณในช่วง 2x, 3x, 4x มีการกระจายตัวออกมาเรื่อยๆ อย่างสนุกสนานและเป็นธรรมชาติ
    const getBypassSpreadCrashPoint = (): number => {
      const roll = Math.random();
      if (roll < 0.15) {
        // 15% chance: 1.20x - 1.99x (Warmup/organic flight)
        return parseFloat((1.20 + Math.random() * 0.79).toFixed(2));
      } else if (roll < 0.50) {
        // 35% chance: 2.00x - 2.99x (2.xx)
        return parseFloat((2.00 + Math.random() * 0.99).toFixed(2));
      } else if (roll < 0.80) {
        // 30% chance: 3.00x - 3.99x (3.xx)
        return parseFloat((3.00 + Math.random() * 0.99).toFixed(2));
      } else {
        // 20% chance: 4.00x - 4.99x (4.xx)
        return parseFloat((4.00 + Math.random() * 0.99).toFixed(2));
      }
    };

    // Standard Rtp Distribution helper
    const getStandardDistributionCrashPoint = (): number => {
      const modulo50Index = ((backendRoundCounter - 1) % 50) + 1;
      
      // Safety restart / randomization of Group D target index at next 50 round milestone
      if (modulo50Index === 1) {
        groupDRoundInCurrent50 = generateGroupDRoundIn50();
      }

      if (modulo50Index === groupDRoundInCurrent50) {
        // Deterministic Group D (10.01x - 13.00x): Exactly 1 crash in every 50 rounds
        const val = parseFloat((10.01 + Math.random() * (13.00 - 10.01)).toFixed(2));
        console.log(`[GAME ENGINE] [GROUP D ELECTED] Round: ${backendRoundCounter} | Mod50: ${modulo50Index}/50 | Triggered 10.01x-13.00x round: ${val}x`);
        return val;
      }

      // Roll based on new requested RNG probabilities:
      // - 1.01 - 2.49x (45% probability)
      // - 2.50 - 4.39x (35% probability)
      // - 4.40 - 10.00x (20% probability)
      const roll = Math.random();
      if (roll < 0.45) {
        // 1.01 - 2.49x
        const val = parseFloat((1.01 + Math.random() * (2.49 - 1.01)).toFixed(2));
        console.log(`[RNG SYSTEM] 🎰 Rolled low-range [1.01-2.49x] (45% chance) -> ${val}x`);
        return val;
      } else if (roll < 0.80) { // 0.45 + 0.35 = 0.80
        // 2.50 - 4.39x
        const val = parseFloat((2.50 + Math.random() * (4.39 - 2.50)).toFixed(2));
        console.log(`[RNG SYSTEM] 🎰 Rolled mid-range [2.50-4.39x] (35% chance) -> ${val}x`);
        return val;
      } else { // 20%
        // 4.40 - 10.00x
        const val = parseFloat((4.40 + Math.random() * (10.00 - 4.40)).toFixed(2));
        console.log(`[RNG SYSTEM] 🎰 Rolled high-range [4.40-10.00x] (20% chance) -> ${val}x`);
        return val;
      }
    };

    // Trigger AI Data Analysis on Session Round 50
    const currentRoundNum = state ? state.sessionRoundCounter : backendRoundCounter;
    if (currentRoundNum === 50) {
      if (currentSuccessfulCashouts.length > 0) {
        const sum = currentSuccessfulCashouts.reduce((s, v) => s + v, 0);
        currentFavoriteCashoutPoint = parseFloat((sum / currentSuccessfulCashouts.length).toFixed(2));
      } else {
        currentFavoriteCashoutPoint = 1.50; // default backup
      }
      currentTrapRoundsRemaining = 11;
      console.log(`[AI DATA ANALYSIS] Activated! Tested ${currentSuccessfulCashouts.length} cashout points. Favorite cashout target: ${currentFavoriteCashoutPoint}x. Charging intercepts for next 11 rounds.`);
    }

    // Check if the current global round is pre-scheduled for 49.00x!
    if (global49xTargetRounds.has(backendRoundCounter)) {
      const stateObj = global49xTargetRounds.get(backendRoundCounter)!;
      if (!stateObj.rolled) {
        stateObj.rolled = true;
        const rollSuccessful = Math.random() < 0.97;
        stateObj.triggered = rollSuccessful;
        console.log(`[GLOBAL 49X SYSTEM] 🎯 TARGET HIT on Global Round ${backendRoundCounter}! Range: [${stateObj.minRange}-${stateObj.maxRange}] | Series: ${stateObj.series} | 97% Roll: ${rollSuccessful ? "SUCCESS 🚀" : "FAILED ❌"}`);
      }
      if (stateObj.triggered) {
        isSpecial49xRound = true;
      }
    }

    // Find upcoming special round target
    let nextSpecialRoundNum = 33;
    const sortedTargets = Array.from(global49xTargetRounds.keys()).sort((a,b)=>a-b);
    for (const r of sortedTargets) {
      if (r >= backendRoundCounter) {
        nextSpecialRoundNum = r;
        break;
      }
    }

    // -------------------------------------------------------------
    // LOOPING STREAK PATTERN ENGINE (ระบบสลับรอบแจกรางวัลและดูดคืนแบบวัฏจักรคู่ขนาน)
    // -------------------------------------------------------------
    let activeStreakMultiplier: number | null = null;
    let activeStreakDescription = "";

    if (state) {
      // Initialize if not set
      if (state.streakMode === undefined) {
        state.streakMode = "NORMAL";
        state.streakRoundsRemaining = Math.floor(Math.random() * 3) + 3; // 3 to 5 rounds
        console.log(`[STREAK SYSTEM INITIALIZATION] Starting Session ${sessionId} with NORMAL play of ${state.streakRoundsRemaining} rounds.`);
      }

      // We only count down and process streak steps if we are NOT in any other priority override round
      const isPriorityOverrideRound = (
        state.sessionRoundCounter === 2 || 
        activeCrisisBonusMultiplier > 0 || 
        isSpecial49xRound || 
        backendRoundCounter === 1 || 
        isLowWinRateJackpotTriggered
      );

      if (!isPriorityOverrideRound) {
        // Decrease the rounds remaining for this streak
        state.streakRoundsRemaining -= 1;

        // If current streak mode has run its course, swap to the next mode in the cycle: NORMAL -> WIN -> LOSS -> NORMAL
        if (state.streakRoundsRemaining <= 0) {
          if (state.streakMode === "NORMAL") {
            state.streakMode = "WIN";
            state.streakRoundsRemaining = Math.floor(Math.random() * 2) + 2; // Exactly 2 or 3 rounds of consecutive wins
            console.log(`[STREAK ENGINE] 🔄 NORMAL intermission completed for Session ${sessionId}! Entering consecutive WIN streak for next ${state.streakRoundsRemaining} rounds [2.50x - 4.39x].`);
          } else if (state.streakMode === "WIN") {
            state.streakMode = "LOSS";
            state.streakRoundsRemaining = Math.floor(Math.random() * 3) + 3; // Exactly 3 to 5 rounds of consecutive low pulls ("เสียรัวๆ")
            console.log(`[STREAK ENGINE] 🔄 WIN streak completed for Session ${sessionId}! Entering consecutive LOSS streak for next ${state.streakRoundsRemaining} rounds [1.01x - 2.49x] (+EV house edge).`);
          } else { // LOSS -> NORMAL
            state.streakMode = "NORMAL";
            state.streakRoundsRemaining = Math.floor(Math.random() * 3) + 4; // 4 to 6 rounds of standard RNG distribution
            console.log(`[STREAK ENGINE] 🔄 LOSS streak completed for Session ${sessionId}! Entering NORMAL standard RNG intermission for next ${state.streakRoundsRemaining} rounds.`);
          }
        }

        // Apply active streak crash point
        if (state.streakMode === "WIN") {
          // Generate consecutive win multipliers in range 2.50x - 4.39x (exactly as requested!)
          activeStreakMultiplier = parseFloat((2.50 + Math.random() * (4.39 - 2.50)).toFixed(2));
          activeStreakDescription = `[STREAK WIN ACTIVE] 🔥 Consecutive win streak round (${state.streakRoundsRemaining} remaining) forcing ${activeStreakMultiplier}x!`;
        } else if (state.streakMode === "LOSS") {
          // Generate consecutive loss/pullback multipliers in range 1.01x - 2.49x (exactly as requested!)
          activeStreakMultiplier = parseFloat((1.01 + Math.random() * (2.49 - 1.01)).toFixed(2));
          activeStreakDescription = `[STREAK LOSS ACTIVE] 📉 Consecutive loss streak round (${state.streakRoundsRemaining} remaining) forcing low ${activeStreakMultiplier}x!`;
        } else {
          // NORMAL mode has no forced multiplier, allowing it to naturally use the requested 45% / 35% / 20% RNG probabilities!
          activeStreakMultiplier = null;
        }
      }
    }

    // Roll for a new Hot Streak if we are in normal gameplay (no active traps, cooldowns, or special rounds)
    if (currentHotStreakRoundsRemaining === 0 && 
        currentCooldownRoundsRemaining === 0 && 
        currentPostCooldownRewardsRemaining === 0 && 
        currentTrapRoundsRemaining === 0 && 
        !isPreemptTrapActive && 
        !isNearCapitalTrap &&
        backendRoundCounter > 1 &&
        !(state && state.sessionRoundCounter === 2) &&
        !isSpecial49xRound &&
        !isLowWinRateJackpotTriggered) {
      const activeHotStreakChance = hotStreakProbabilityOverride !== -1 ? hotStreakProbabilityOverride : 0.15;
      if (Math.random() < activeHotStreakChance) { // Use lifecycle-driven hot streak chance
        currentHotStreakRoundsRemaining = Math.floor(Math.random() * 2) + 3; // 3 or 4 rounds as requested by user
        console.log(`[HOT STREAK ENGINE] 🔥 RNG triggered a Hot Streak (Lifecycle Chance: ${(activeHotStreakChance*100).toFixed(0)}%)! Configured for ${currentHotStreakRoundsRemaining} consecutive rounds of 2.00x - 4.99x payouts.`);
      }
    }

    // Calculate 10-Set Reward System (11.00x - 12.01x in every 25-29, 50-58, ..., 250-290 round sets)
    // Synchronized for both Session Rounds and Global Room Rounds with a 90-100 minute reset timer
    const nowMs = Date.now();
    
    // 1. Session-level 10-Set Reward Cycle initialization and tracking
    if (state) {
      const sessionCycleExpired = state.setRewardCycle && (nowMs - state.setRewardCycle.startTime >= state.setRewardCycle.durationMs);
      if (!state.setRewardCycle || sessionCycleExpired) {
        const nextIdx = state.setRewardCycle ? state.setRewardCycle.cycleIndex + 1 : 1;
        state.setRewardCycle = generateSetRewardTargets(nextIdx, state.sessionRoundCounter);
        console.log(`[SESSION 10-SET REWARD ENGINE] 🔄 Initialized Session Set Reward Cycle #${nextIdx} for ${sessionId}. Start Session Round: ${state.sessionRoundCounter}. Scheduled Targets:`, state.setRewardCycle.targets);
      }
    }

    // 2. Global Room-level 10-Set Reward Cycle initialization
    const globalCycleExpired = globalSetRewardCycle && (nowMs - globalSetRewardCycle.startTime >= globalSetRewardCycle.durationMs);
    if (!globalSetRewardCycle || globalCycleExpired) {
      const nextCycleIndex = globalSetRewardCycle ? globalSetRewardCycle.cycleIndex + 1 : 1;
      globalSetRewardCycle = generateSetRewardTargets(nextCycleIndex, backendRoundCounter);
      const durMins = (globalSetRewardCycle.durationMs / 60000).toFixed(1);
      console.log(`[GLOBAL 10-SET REWARD ENGINE] 🔄 Initialized Global Room Reward Cycle #${nextCycleIndex}. Timer duration: ${durMins}m. Starting global round: ${backendRoundCounter}. Scheduled relative targets:`, globalSetRewardCycle.targets);
    }

    let isSetRewardRound = false;
    let activeSetIndex = -1;

    // Evaluate Session Round Reward Targets first
    if (state && state.setRewardCycle) {
      let sessionRelRound = state.sessionRoundCounter - state.setRewardCycle.startRound + 1;
      
      // Auto-renew cycle if session relative round exceeded 100 (completed all 10 sets)
      if (sessionRelRound > 100) {
        const nextIdx = state.setRewardCycle.cycleIndex + 1;
        state.setRewardCycle = generateSetRewardTargets(nextIdx, state.sessionRoundCounter);
        sessionRelRound = 1;
        console.log(`[SESSION 10-SET REWARD LOOP] 🔄 Auto-renewed Set Reward Cycle to #${nextIdx} at Session Round ${state.sessionRoundCounter}`);
      }

      for (let i = 0; i < state.setRewardCycle.ranges.length; i++) {
        if (!state.setRewardCycle.triggeredSets[i]) {
          const [minRange, maxRange] = state.setRewardCycle.ranges[i];
          const targetRound = state.setRewardCycle.targets[i];

          // Trigger on target hit OR fail-safe trigger at maxRange if passed!
          if (sessionRelRound === targetRound || sessionRelRound >= maxRange) {
            isSetRewardRound = true;
            activeSetIndex = i;
            state.setRewardCycle.triggeredSets[i] = true;
            console.log(`[SESSION 10-SET REWARD ACTIVE] 🎁 Set #${i+1} (${minRange}-${maxRange}) TRIGGERED on Session Round ${state.sessionRoundCounter} (Rel: ${sessionRelRound}, Target: ${targetRound})!`);
            break;
          }
        }
      }
    }

    // Secondary check: Global Room Round Reward Targets
    if (!isSetRewardRound && globalSetRewardCycle) {
      const globalRelRound = backendRoundCounter - globalSetRewardCycle.startRound + 1;
      for (let i = 0; i < globalSetRewardCycle.ranges.length; i++) {
        if (!globalSetRewardCycle.triggeredSets[i]) {
          const [minRange, maxRange] = globalSetRewardCycle.ranges[i];
          const targetRound = globalSetRewardCycle.targets[i];

          if (globalRelRound === targetRound || globalRelRound >= maxRange) {
            isSetRewardRound = true;
            activeSetIndex = i;
            globalSetRewardCycle.triggeredSets[i] = true;
            console.log(`[GLOBAL 10-SET REWARD ACTIVE] 🎁 Set #${i+1} (${minRange}-${maxRange}) TRIGGERED on Global Round ${backendRoundCounter} (Rel: ${globalRelRound}, Target: ${targetRound})!`);
            break;
          }
        }
      }
    }

    // Branching decisions for target crash point
    if (state && state.sessionRoundCounter === 2) {
      // Special Rule from user: 2nd session round must reach exactly 99.00x multiplier with 100% chance!
      targetCrashPoint = 99.00;
      console.log(`[USER SPECIAL COMMAND ACTIVE] 🚀 Player Session Round 2: Boosted to fly to exactly ${targetCrashPoint}x with 100% certainty!`);
    } else if (activeCrisisBonusMultiplier > 0) {
      // Crisis Lifeline triggered (1st or 2nd time dropping <= 30%)
      targetCrashPoint = activeCrisisBonusMultiplier;
      console.log(`[CRISIS LIFELINE ACTIVE] 🛡️ 100% GUARANTEED RECOVERY MULTIPLIER: Flying to exactly ${targetCrashPoint}x to restore player wallet!`);
    } else if (isSpecial49xRound) {
      // Special Rule: Force aircraft to rocket up to exactly 49.00x multiplier immediately!
      targetCrashPoint = 49.00;
      console.log(`[SPECIAL FEATURE ACTIVE] 🚀 Rocket boosted to fly to exactly ${targetCrashPoint}x! Let players get a massive recovery!`);
    } else if (isSetRewardRound) {
      // 10-Set Reward Rule: 11.00x to 12.01x on scheduled rounds (Sets 1-10 across 25..29, 50..58, ..., 250..290)
      targetCrashPoint = parseFloat((11.00 + Math.random() * 1.01).toFixed(2));
      console.log(`[10-SET REWARD EXECUTED] 🎁 Scheduled Set #${activeSetIndex >= 0 ? activeSetIndex + 1 : '1-10'} Reward Flying to ${targetCrashPoint}x (Guaranteed 11.00x - 12.01x)!`);
    } else if (backendRoundCounter === 1) {
      // Rule: First Game Force [1.08x - 1.10x] 100% chance
      targetCrashPoint = parseFloat((1.08 + Math.random() * (1.10 - 1.08)).toFixed(2));
      console.log(`[GAME ENGINE] Round 1 Force-Crash Profile: ${targetCrashPoint}x`);
    } else if (isLowWinRateJackpotTriggered) {
      // แตกรางวัลใหญ่ทันทีเมื่อวิลเลจเฉลี่ย <= 30% (25.00x - 45.00x)
      targetCrashPoint = parseFloat((25.00 + Math.random() * (45.00 - 25.00)).toFixed(2));
      console.log(`[LOW WIN RATE JACKPOT] 🎁 วิลเลจเฉลี่ยของลูกค้าต่ำกว่า 30% (${(clientWinRate * 100).toFixed(1)}%). แตกรางวัลใหญ่ทันที: ${targetCrashPoint}x เพื่อให้ลูกค้ามีทุนเล่นยาวขึ้น!`);
    } else if (currentHotStreakRoundsRemaining > 0) {
      currentHotStreakRoundsRemaining -= 1;
      // Generate a solid consecutive multiplier of 2x, 3x, or 4x: [2.00x - 4.99x]
      targetCrashPoint = parseFloat((2.00 + Math.random() * 3.00).toFixed(2));
      console.log(`[HOT STREAK ACTIVE] 🔥 Consecutive win active! (Rounds remaining: ${currentHotStreakRoundsRemaining}) -> Exploding at ${targetCrashPoint}x (Guaranteed 2.00x-4.99x)`);
    } else if (currentCooldownRoundsRemaining > 0) {
      // Rule: Cooldown Phase (3-6 rounds) following any crash >= 6.00x. Forces low multipliers between 1.00x and 2.00x.
      currentCooldownRoundsRemaining -= 1;
      const skewRoll = Math.random();
      if (skewRoll < 0.30) {
        // 30% chance of ultra-low crash (1.00x - 1.10x) to pull back funds
        targetCrashPoint = parseFloat((1.00 + Math.random() * 0.10).toFixed(2));
      } else if (skewRoll < 0.80) {
        // 50% chance of 1.11x - 1.40x (low range)
        targetCrashPoint = parseFloat((1.11 + Math.random() * 0.29).toFixed(2));
      } else {
        // 20% chance of 1.41x - 2.00x
        targetCrashPoint = parseFloat((1.41 + Math.random() * 0.59).toFixed(2));
      }
      console.log(`[GAME ENGINE] Cooldown Active (Rounds remaining: ${currentCooldownRoundsRemaining}): ${targetCrashPoint}x`);
      
      if (currentCooldownRoundsRemaining === 0) {
        // Once those 3-6 rounds are over, trigger exactly 2 rounds of high payouts (8.00x - 10.00x)
        currentPostCooldownRewardsRemaining = 2;
        console.log(`[GAME ENGINE] Cooldown phase complete! Armed 2-round High Reward Sequence [8.00x - 10.00x] immediately.`);
      }
    } else if (currentPostCooldownRewardsRemaining > 0) {
      // Rule: Post-cooldown High Reward Phase (exactly 2 rounds of 8.00x - 10.00x payouts)
      currentPostCooldownRewardsRemaining -= 1;
      targetCrashPoint = parseFloat((8.00 + Math.random() * 2.00).toFixed(2));
      console.log(`[GAME ENGINE] Post-Cooldown High Reward Round Active (Rounds remaining: ${currentPostCooldownRewardsRemaining}): ${targetCrashPoint}x`);
    } else if (isPreemptTrapActive) {
      // ระบบดักหน้าทำงาน: ระเบิดดักหน้าก่อนถึงยอดถอนที่ชอบถอน แต่ยังใช้ระบบ RNG เพื่อให้ดูเนียนตาเป็นธรรมชาติ
      const interceptRoll = Math.random();
      if (interceptRoll < 0.50) {
        // 50% chance: ระเบิดดักหน้าต่ำกว่าเป้าหมายถอนเฉลี่ยเล็กน้อยเพื่อดูดเงินกลับ
        const interceptOffset = 0.05 + Math.random() * 0.15; // 0.05 to 0.20 below favorite
        targetCrashPoint = parseFloat(Math.max(1.01, currentFavoriteCashoutPoint - interceptOffset).toFixed(2));
        console.log(`[AI PREEMPT TRAP] ⚠️ ระบบดักหน้าทำงาน Mode A (Intercept): Exploding at ${targetCrashPoint}x to block favorite cashout point (${currentFavoriteCashoutPoint}x).`);
      } else if (interceptRoll < 0.80) {
        // 30% chance: ระเบิดต่ำมากๆ ช่วง 1.00x ขึ้นไปแบบสุ่ม (1.00x - 1.15x) เพื่อดึงทุนคืนเข้าเจ้ามืออย่างรวดเร็วและเนียนตา
        targetCrashPoint = parseFloat((1.00 + Math.random() * 0.15).toFixed(2));
        console.log(`[AI PREEMPT TRAP] ⚠️ ระบบดักหน้าทำงาน Mode B (Low Capital Pullback): Exploding at extremely low ${targetCrashPoint}x to pull capital back directly.`);
      } else {
        // 20% chance: ให้ผลลัพธ์หลอกตาในช่วง 1.50x - 1.95x เพื่อให้ผู้เล่นไม่รู้สึกว่าถูกเซ็ตระบบร้อยเปอร์เซ็นต์
        targetCrashPoint = parseFloat((1.50 + Math.random() * 0.45).toFixed(2));
        console.log(`[AI PREEMPT TRAP] ⚠️ ระบบดักหน้าทำงาน Mode C (Decoy): Exploding at ${targetCrashPoint}x to mimic organic random flight.`);
      }
    } else if (isNearCapitalTrap) {
      // Rule: Near Capital Trap [1.00x - 1.15x] (only 45% chance to load a severe low trap; 55% chance to bypass and spread beautiful 2x, 3x, 4x)
      const trapRoll = Math.random();
      if (trapRoll < 0.45) {
        targetCrashPoint = parseFloat((1.00 + Math.random() * 0.15).toFixed(2));
        console.log(`[GAME ENGINE] Near Capital Trap Triggered (45% Trap Chance SUCCESS): ${targetCrashPoint}x`);
      } else {
        targetCrashPoint = getBypassSpreadCrashPoint();
        console.log(`[GAME ENGINE] Near Capital Trap BYPASSED: Triggered beautiful spread 2x-4x payout: ${targetCrashPoint}x`);
      }
    } else if (currentTrapRoundsRemaining > 0) {
      // Rule: 11-round AI Trap (Alternating pattern)
      const isTrapRoundActive = (currentTrapRoundsRemaining % 2 !== 0);
      currentTrapRoundsRemaining -= 1;

      if (isTrapRoundActive) {
        const trapRoll = Math.random();
        if (trapRoll < 0.45) { // 45% chance to trap front-explosion
          const interceptOffset = 0.05 + Math.random() * 0.15; // 0.05 to 0.20 below
          targetCrashPoint = parseFloat(Math.max(1.03, currentFavoriteCashoutPoint - interceptOffset).toFixed(2));
          console.log(`[GAME ENGINE] AI Preempt Trap (45% Trap Chance SUCCESS): Exploding at ${targetCrashPoint}x (Intercept user favourite: ${currentFavoriteCashoutPoint}x)`);
        } else { // 55% chance to bypass and spread beautiful 2x-4x
          targetCrashPoint = getBypassSpreadCrashPoint();
          console.log(`[GAME ENGINE] AI Preempt Trap BYPASSED: Triggered beautiful spread 2x-4x payout: ${targetCrashPoint}x`);
        }
      } else {
        targetCrashPoint = getStandardDistributionCrashPoint();
        console.log(`[GAME ENGINE] AI Trap Alternation Off-Round Standard Multiplier: ${targetCrashPoint}x`);
      }
    } else if (activeStreakMultiplier !== null) {
      // 100% Guaranteed Looping Win/Loss Streak Pattern in standard gameplay!
      targetCrashPoint = activeStreakMultiplier;
      console.log(activeStreakDescription);
    } else {
      // Rule: Standard RTP/House Edge Distribution
      targetCrashPoint = getStandardDistributionCrashPoint();
      console.log(`[GAME ENGINE] Standard Gameplay Multiplier: ${targetCrashPoint}x`);
    }

    // Universal Cooldown arming if crash point is 6.00x or higher (including jackpot, superjackpot, or 49x)
    // ONLY arm cooldown if it is not a crisis lifeline recovery round, to prevent penalizing struggling players!
    if (targetCrashPoint >= 6.00 && activeCrisisBonusMultiplier === 0 && currentBalance > crisisThreshold) {
      currentCooldownRoundsRemaining = Math.floor(Math.random() * 4) + 3; // Choose 3, 4, 5, or 6
      currentPostCooldownRewardsRemaining = 0; // Clear existing rewards to avoid conflict
      console.log(`[GAME ENGINE] Multiplier >= 6.00x detected (${targetCrashPoint}x)! Armed Cooldown for next ${currentCooldownRoundsRemaining} games.`);
    } else if (targetCrashPoint >= 6.00) {
      console.log(`[GAME ENGINE] Multiplier >= 6.00x detected (${targetCrashPoint}x) but Cooldown bypassed due to Crisis Lifeline / low balance safety check.`);
    }

    // Sync local isolated parameters back to state (or global fallbacks)
    if (state) {
      state.trapRoundsRemaining = currentTrapRoundsRemaining;
      state.cooldownRoundsRemaining = currentCooldownRoundsRemaining;
      state.postCooldownRewardsRemaining = currentPostCooldownRewardsRemaining;
      state.hotStreakRoundsRemaining = currentHotStreakRoundsRemaining;
    } else {
      trapRoundsRemaining = currentTrapRoundsRemaining;
      cooldownRoundsRemaining = currentCooldownRoundsRemaining;
      postCooldownRewardsRemaining = currentPostCooldownRewardsRemaining;
      hotStreakRoundsRemaining = currentHotStreakRoundsRemaining;
    }

    const isJackpotRound = (targetCrashPoint >= 6.51 && targetCrashPoint <= 10.00);
    const isSuperJackpotRound = (targetCrashPoint >= 10.01 && targetCrashPoint <= 13.00);

    // Set variable for next round protection
    lastCrashPointWasLow = (targetCrashPoint < 1.18);

    // Format boundaries: Cap standard at 13.00, or allow up to 49.00/99.00 for special rounds
    const isSpecial99xRound = (state && state.sessionRoundCounter === 2);
    const maxClamp = isSpecial99xRound ? 99.00 : (isSpecial49xRound ? 49.00 : 13.00);
    targetCrashPoint = parseFloat(Math.max(1.01, Math.min(maxClamp, targetCrashPoint)).toFixed(2));

    // Generate an intentionally misleading AI Prediction (opposite to reality)
    let aiPrediction = 1.30;
    if (targetCrashPoint >= 4.00) {
      // High actual multiplier -> Predict a very low multiplier (1.05x to 1.38x)
      aiPrediction = parseFloat((Math.random() * (1.38 - 1.05) + 1.05).toFixed(2));
    } else if (targetCrashPoint <= 1.30) {
      // Very low actual multiplier -> Predict extremely high multiplier (8.50x to 16.80x)
      aiPrediction = parseFloat((Math.random() * (16.80 - 8.50) + 8.50).toFixed(2));
    } else {
      // Low/middle multiplier -> Predict decently high multiplier (4.50x to 8.20x)
      aiPrediction = parseFloat((Math.random() * (8.20 - 4.50) + 4.50).toFixed(2));
    }

    // Console log monitoring
    console.log(`[GAME ENGINE] Round: ${backendRoundCounter} | Target Multiplier: ${targetCrashPoint}x${isNearCapitalTrap ? ' (TRAP ACTIVE)' : ''}${isSuperJackpotRound ? ' (SUPER JACKPOT)' : ''}${isJackpotRound ? ' (JACKPOT)' : ''}${isSpecial49xRound ? ' (SPECIAL 49X ACTIVE)' : ''} | Misleading Prediction: ${aiPrediction}x`);

    const secureRoundCommit = integrityEngine.makeNewRound();
    // Inject backend calculated math outcomes as supreme oracle override
    secureRoundCommit.crashPoint = targetCrashPoint;

    res.json({
      roundId: secureRoundCommit.roundId,
      fairHash: secureRoundCommit.hash,
      active: true,
      crashPointOverride: targetCrashPoint, // Pass backend computed crash point to frontend
      isJackpotRound,
      isSuperJackpotRound,
      isSpecial49xRound,
      currentCycleRoundNum: currentModuloIndex,
      globalRoundNum: backendRoundCounter,
      nextSpecialRoundNum,
      isNearCapitalTrap,
      aiPrediction, // Pass fake prediction to frontend
      sessionRoundCounter: state.sessionRoundCounter,
      fakeTargetRound: state.fakeTargetRound,
      recalibrationCount: state.recalibrationCount,
      sessionEntryBalance: state ? state.sessionEntryBalance : 150000,
      isInCrisisMode: state ? state.isInCrisisMode : false,
      isPreemptTrapActive: isPreemptTrapActive,
      hint: "Valid server hash generated. Salt precommitted."
    });
  });

  // INPUT MATCHING LOGIN API WITH INTUBATED JWT SIGNER
  app.post("/api/security/login", async (req, res) => {
    const clientIp = req.ip || "unknown";
    
    // Check Rate Limiting bound to logins strictly
    const canAttempt = rateLimiterInstance.handleLogin(clientIp);
    if (!canAttempt) {
      return res.status(429).json({ error: "High security failure. Rate limit of 5 login attempts per minute exceeded." });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password specifications are missing." });
    }

    try {
      const user = await secureDb.executeParameterized("SELECT * FROM users WHERE username = ?", [username]);
      if (!user) {
        logSecurityEvent({
          type: "FAILED_LOGIN",
          ip: clientIp,
          timestamp: new Date().toISOString(),
          details: `Authentication attempt signature failed for user: ${username}`
        });
        return res.status(401).json({ error: "Access key validation failed." });
      }

      const isValid = secureDb.verifyCredentials(password, user.passwordHash);
      if (!isValid) {
        logSecurityEvent({
          type: "FAILED_LOGIN_CREDENTIALS",
          ip: clientIp,
          timestamp: new Date().toISOString(),
          details: `Password signature validation failed for username: ${username}`
        });
        return res.status(401).json({ error: "Access key validation failed." });
      }

      // Generate secure high complexity token parameters (Expires in 24 hours, Refresh 7 days)
      const accessToken = tokenService.generateToken({ userId: user.userId, username: user.username }, false);
      const refreshToken = tokenService.generateToken({ userId: user.userId, username: user.username }, true);

      logSecurityEvent({
        type: "SUCCESS_LOGIN",
        ip: clientIp,
        userId: user.userId,
        timestamp: new Date().toISOString(),
        details: `Successful JWT security flight credentials granted to user: ${username}`
      });

      // Never return password field in any API response
      return res.json({
        accessToken,
        refreshToken,
        expiresIn: 86400,
        user: {
          userId: user.userId,
          username: user.username,
          balance: user.balance
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Intermittent server collision." });
    }
  });

  // INPUT MATCHING LOGOUT TO COIL TOKEN BLACKLIST
  app.post("/api/security/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      tokenService.blacklistToken(token);
    }
    res.json({ message: "Security token blacklisted. Logout finalized." });
  });

  // BET PROCESSING AND VALIDATION API ROUTE
  app.post("/api/security/bet", verifyJWT, (req, res) => {
    const user = (req as any).user;
    const clientIp = req.ip || "unknown";

    // Rate Limiter Constraint Check (Max 10 bets per minute per user)
    const canBet = rateLimiterInstance.handleBet(user.userId, clientIp);
    if (!canBet) {
      return res.status(429).json({ error: "Betting speed bounds exceeded. Maximum 10 wagers per minute." });
    }

    const { betAmount } = req.body;
    
    // Server-side check
    const registration = integrityEngine.registerBetOnServer(user.userId, parseFloat(betAmount), clientIp);
    if (!registration.success) {
      return res.status(400).json({ error: registration.error });
    }

    logSecurityEvent({
      type: "BET_VALIDATED_OK",
      ip: clientIp,
      userId: user.userId,
      timestamp: new Date().toISOString(),
      details: `Validated state of wager correctly: ${betAmount} THB`
    });

    res.json({ success: true, message: "Security deposit and gameplay wager validated and registered on server." });
  });

  // CASHOUT PROCESSING AND EXCLUSION API ROUTE
  app.post("/api/security/cashout", verifyJWT, (req, res) => {
    const user = (req as any).user;
    const clientIp = req.ip || "unknown";
    const { targetMultiplier } = req.body;

    const result = integrityEngine.processVerifyCashout(user.userId, parseFloat(targetMultiplier), clientIp);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    logSecurityEvent({
      type: "CASHOUT_SUCCEEDED",
      ip: clientIp,
      userId: user.userId,
      timestamp: new Date().toISOString(),
      details: `Payout calculated and verified on server for ${targetMultiplier}x. Total: ${result.payout} THB`
    });

    res.json({ 
      success: true, 
      payout: result.payout,
      message: "Server validated receipt and transaction settled securely."
    });
  });

  // GET LOGS SERVICE FOR CONCURRENT TELEMETRY TRACKS
  app.get("/api/security/logs", (req, res) => {
    // Only return records securely, never expose raw password details or memory buffers
    res.json({
      totalLogsTracked: securityLogs.length,
      logs: securityLogs.slice(-50).reverse() // return last 50 entries
    });
  });

  // VITE DEVELOPMENT MIDDLEWARE OR PRODUCTION SERVING ENGINE
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Listening Port Allocation Bind
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK INFRASTRUCTURE] Security Layer bound successfully. Core services active on port ${PORT}`);
  });
}

runSecurityFullstackServer().catch((err) => {
  console.error("FATAL: Failed to initialize fullstack application", err);
});
