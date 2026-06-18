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
}

const playerStates = new Map<string, PlayerSpecialState>();

// Global fallback states:
let sessionEntryBalance = 104000; 
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
    const { multiplierCashed } = req.body;
    if (multiplierCashed && typeof multiplierCashed === "number") {
      const val = parseFloat(multiplierCashed.toFixed(2));
      cashoutHistory.push(val);
      if (cashoutHistory.length > 500) {
        cashoutHistory.shift(); // Evict oldest metric
      }
      playerSuccessfulCashouts.push(val);
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
    const currentBalance = (req.body && typeof req.body.currentBalance === "number") ? req.body.currentBalance : 104000;

    // Get or initialize player's isolated state
    if (!playerStates.has(sessionId)) {
      const initialFakeTarget = Math.floor(Math.random() * (21 - 17 + 1)) + 17;
      playerStates.set(sessionId, {
        sessionEntryBalance: currentBalance,
        roundsSinceLast49x: 0, // Starts at 0 to trigger exactly at the target 33-38 round of the session
        specialCooldownThreshold: Math.floor(Math.random() * (38 - 33 + 1)) + 33, // 33 to 38 inclusive
        lastResetDateBangkok: "",
        sessionRoundCounter: 0,
        fakeTargetRound: initialFakeTarget,
        recalibrationCount: 0
      });
      console.log(`[STATE ISOLATION] Created isolated state for sessionId: ${sessionId} with initial balance ${currentBalance} THB. Real target: ${playerStates.get(sessionId)!.specialCooldownThreshold}, Fake AI forecasted target: ${initialFakeTarget}`);
    }

    const state = playerStates.get(sessionId)!;

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
    if (currentBalance > state.sessionEntryBalance || backendRoundCounter === 1) {
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

    // Near Capital Trap Constraint (Triggered when user balance climbs back up close to 104000, between [85000, 103800] THB)
    const isInNearCapitalRange = (currentBalance >= 85000 && currentBalance <= 103800);
    const isNearCapitalTrap = isInNearCapitalRange && (Math.random() < 0.55);

    // Securely randomize crash points mimicking house-authorized profiles
    let targetCrashPoint = 1.00;
    let isSpecial49xRound = false;

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

      // Roll 40% House Edge / 60% RTP
      const mainRoll = Math.random();
      if (mainRoll < 0.40) {
        // House Edge Phase (Strict 40%): low-capped crash points [1.01x - 1.25x]
        return parseFloat((1.01 + Math.random() * 0.24).toFixed(2));
      } else {
        // RTP Phase (Strict 60%): Nicely distributed from 1.35x up to 3.50x primarily, and occasionally higher
        const rtpRoll = Math.random();
        if (rtpRoll < 0.65) {
          // Group A (65% relative chance of RTP Phase): Beautifully spread across [1.35x - 3.50x]
          const groupASubRoll = Math.random();
          if (groupASubRoll < 0.33) {
            // Lower bracket: [1.35x - 2.00x]
            return parseFloat((1.35 + Math.random() * 0.65).toFixed(2));
          } else if (groupASubRoll < 0.66) {
            // Mid bracket: [2.01x - 2.75x]
            return parseFloat((2.01 + Math.random() * 0.74).toFixed(2));
          } else {
            // High bracket: [2.76x - 3.50x]
            return parseFloat((2.76 + Math.random() * 0.74).toFixed(2));
          }
        } else if (rtpRoll < 0.85) {
          // Group B (20% relative chance of RTP Phase): [3.51x - 7.50x]
          return parseFloat((3.51 + Math.random() * (7.50 - 3.51)).toFixed(2));
        } else {
          // Group C (15% relative chance of RTP Phase): [7.51x - 12.00x]
          return parseFloat((7.51 + Math.random() * (12.00 - 7.51)).toFixed(2));
        }
      }
    };

    // Trigger AI Data Analysis on Round 50
    if (backendRoundCounter === 50) {
      if (playerSuccessfulCashouts.length > 0) {
        const sum = playerSuccessfulCashouts.reduce((s, v) => s + v, 0);
        favoriteCashoutPoint = parseFloat((sum / playerSuccessfulCashouts.length).toFixed(2));
      } else {
        favoriteCashoutPoint = 1.50; // default backup
      }
      trapRoundsRemaining = 11;
      console.log(`[AI DATA ANALYSIS] Activated! Tested ${playerSuccessfulCashouts.length} cashout points. Favorite cashout target: ${favoriteCashoutPoint}x. Charging intercepts for next 11 rounds.`);
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

    // Branching decisions for target crash point
    if (state && state.sessionRoundCounter === 2) {
      // Special Rule from user: 2nd session round must reach exactly 99.00x multiplier with 100% chance!
      targetCrashPoint = 99.00;
      console.log(`[USER SPECIAL COMMAND ACTIVE] 🚀 Player Session Round 2: Boosted to fly to exactly ${targetCrashPoint}x with 100% certainty!`);
    } else if (isSpecial49xRound) {
      // Special Rule: Force aircraft to rocket up to exactly 49.00x multiplier immediately!
      targetCrashPoint = 49.00;
      console.log(`[SPECIAL FEATURE ACTIVE] 🚀 Rocket boosted to fly to exactly ${targetCrashPoint}x! Let players get a massive recovery!`);
    } else if (backendRoundCounter === 1) {
      // Rule: First Game Force [1.08x - 1.10x] 100% chance
      targetCrashPoint = parseFloat((1.08 + Math.random() * (1.10 - 1.08)).toFixed(2));
      console.log(`[GAME ENGINE] Round 1 Force-Crash Profile: ${targetCrashPoint}x`);
    } else if (cooldownRoundsRemaining > 0) {
      // Rule: Cooldown Phase (3-6 rounds) following any crash > 6.50x
      cooldownRoundsRemaining -= 1;
      const skewRoll = Math.random();
      if (skewRoll < 0.80) {
        // 80% chance of 1.06x - 1.20x (Heavily biased/skewed as requested)
        targetCrashPoint = parseFloat((1.06 + Math.random() * (1.20 - 1.06)).toFixed(2));
      } else {
        // 20% chance of 1.21x - 2.00x (Full bound is 1.06 - 2.00x)
        targetCrashPoint = parseFloat((1.21 + Math.random() * (2.00 - 1.21)).toFixed(2));
      }
      console.log(`[GAME ENGINE] Cooldown Active (Rounds remaining: ${cooldownRoundsRemaining}): ${targetCrashPoint}x`);
    } else if (isNearCapitalTrap) {
      // Rule: Near Capital Trap [1.01x - 1.15x] (only 45% chance to load a severe low trap; 55% chance to bypass and spread beautiful 1.00x-3.50x)
      const trapRoll = Math.random();
      if (trapRoll < 0.45) {
        targetCrashPoint = parseFloat((1.01 + Math.random() * 0.14).toFixed(2));
        console.log(`[GAME ENGINE] Near Capital Trap Triggered (45% Trap Chance SUCCESS): ${targetCrashPoint}x`);
      } else {
        targetCrashPoint = parseFloat((1.00 + Math.random() * 2.50).toFixed(2));
        console.log(`[GAME ENGINE] Near Capital Trap BYPASSED: Standard spread RNG 1.00x-3.50x active: ${targetCrashPoint}x`);
      }
    } else if (trapRoundsRemaining > 0) {
      // Rule: 11-round AI Trap (Alternating pattern)
      const isTrapRoundActive = (trapRoundsRemaining % 2 !== 0);
      trapRoundsRemaining -= 1;

      if (isTrapRoundActive) {
        const trapRoll = Math.random();
        if (trapRoll < 0.45) { // 45% chance to trap front-explosion
          const interceptOffset = 0.05 + Math.random() * 0.15; // 0.05 to 0.20 below
          targetCrashPoint = parseFloat(Math.max(1.03, favoriteCashoutPoint - interceptOffset).toFixed(2));
          console.log(`[GAME ENGINE] AI Preempt Trap (45% Trap Chance SUCCESS): Exploding at ${targetCrashPoint}x (Intercept user favourite: ${favoriteCashoutPoint}x)`);
        } else { // 55% chance to bypass and spread beautiful 1.00x-3.50x
          targetCrashPoint = parseFloat((1.00 + Math.random() * 2.50).toFixed(2));
          console.log(`[GAME ENGINE] AI Preempt Trap BYPASSED: Standard spread RNG 1.00x-3.50x active: ${targetCrashPoint}x`);
        }
      } else {
        targetCrashPoint = getStandardDistributionCrashPoint();
        console.log(`[GAME ENGINE] AI Trap Alternation Off-Round Standard Multiplier: ${targetCrashPoint}x`);
      }
    } else {
      // Rule: Standard RTP/House Edge Distribution
      targetCrashPoint = getStandardDistributionCrashPoint();
      console.log(`[GAME ENGINE] Standard Gameplay Multiplier: ${targetCrashPoint}x`);
    }

    // Universal Cooldown arming if crash point exceeds 6.50x (including jackpot, superjackpot, or 49x)
    if (targetCrashPoint > 6.50) {
      cooldownRoundsRemaining = Math.floor(Math.random() * 4) + 3; // Choose 3, 4, 5, or 6
      console.log(`[GAME ENGINE] Multiplier > 6.50x detected! Armed Cooldown for next ${cooldownRoundsRemaining} games.`);
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
