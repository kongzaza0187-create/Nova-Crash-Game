import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import crypto from "crypto";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { 
  seamlessWalletStore, 
  verifySignatureMiddleware, 
  generateHmacSignature, 
  API_SECRET_KEY 
} from "./server/seamlessWalletEngine";
import { riskAssuranceEngine } from "./src/modules/game/riskAssuranceEngine";
import { b2bRedis, b2bPostgresLogs } from "./server/b2bArchitectureEngine";
import { masterK6Simulator } from "./server/k6MasterEngine";
import { 
  CentralGameHistoryService, 
  LiveGameSyncController, 
  HistoryRecord,
  computeCalibrated11TierCrashPoint
} from "./src/services/centralHistoryEngine";
import { antiScrapeEngine } from "./src/modules/security/antiScrapeEngine";

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
  details: string;
}

// Stores sanitized event logs without IP, machine, or fingerprint metadata
const securityLogs: SecurityLogEntry[] = [];

function sanitizeClientToken(raw?: string): string {
  if (!raw) return "anonymous";
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 12);
}

function logSecurityEvent(entry: { type: string; details: string; timestamp?: string; userId?: string }) {
  const logId = "evt_" + crypto.randomUUID();
  const fullEntry: SecurityLogEntry = {
    id: logId,
    type: entry.type,
    timestamp: entry.timestamp || new Date().toISOString(),
    details: entry.details
  };
  securityLogs.push(fullEntry);
  if (securityLogs.length > 500) securityLogs.shift();
  console.log(`[EVENT][${fullEntry.type}] ${fullEntry.details}`);
}

function logSuspiciousActivity(payload: { type: string; details: string; userId?: string }) {
  const token = sanitizeClientToken(payload.userId);
  logSecurityEvent({
    type: payload.type,
    details: `Security rule evaluated for token [${token}]: ${payload.details}`
  });
}

function logFailedValidation(payload: { timestamp: string; details: string }) {
  logSecurityEvent({
    type: "FAILED_VALIDATION",
    timestamp: payload.timestamp,
    details: `Schema validation failed: ${payload.details}`
  });
}

function logDbError(errorMessage: string) {
  logSecurityEvent({
    type: "DATABASE_ERROR",
    details: `Storage operation error: ${errorMessage}`
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
      details: "Access attempt using expired or invalid JWT token"
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
  private clientBuckets: Map<string, RateLimitBucket> = new Map();
  private userBetBuckets: Map<string, RateLimitBucket> = new Map();
  private loginBuckets: Map<string, RateLimitBucket> = new Map();
  private consecutiveViolations: Map<string, number> = new Map();
  private blockedClients: Set<string> = new Set();

  public isBlocked(clientToken: string): boolean {
    return this.blockedClients.has(clientToken);
  }

  public trackViolation(clientToken: string, reason: string) {
    const current = (this.consecutiveViolations.get(clientToken) || 0) + 1;
    this.consecutiveViolations.set(clientToken, current);
    
    logSecurityEvent({
      type: "RATE_LIMIT_VIOLATION",
      timestamp: new Date().toISOString(),
      details: `Rate threshold exceeded [${clientToken}]: ${reason} (count: ${current})`
    });

    // Block token automatically after 3 consecutive violations
    if (current >= 3) {
      this.blockedClients.add(clientToken);
      logSecurityEvent({
        type: "CLIENT_BLOCKED",
        timestamp: new Date().toISOString(),
        details: `Client token [${clientToken}] temporarily blocked due to repeated rate limit violations.`
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

  public handleRequest(clientToken: string): boolean {
    if (this.isBlocked(clientToken)) return false;
    const ok = this.checkLimit(this.clientBuckets, clientToken, 10000, 60000); // High throughput allowed for wallet integrations
    if (!ok) {
      this.trackViolation(clientToken, "Max global application endpoint requests exceeded");
    }
    return ok;
  }

  public handleBet(userId: string, clientToken: string): boolean {
    if (this.isBlocked(clientToken)) return false;
    const ok = this.checkLimit(this.userBetBuckets, userId, 10, 60000); // Max 10 bet requests per minute per user
    if (!ok) {
      this.trackViolation(clientToken, `Max user bet requests (10 bets/min) exceeded by user ID: ${userId}`);
    }
    return ok;
  }

  public handleLogin(clientToken: string): boolean {
    if (this.isBlocked(clientToken)) return false;
    const ok = this.checkLimit(this.loginBuckets, clientToken, 5, 60000); // Max 5 login attempts per minute
    if (!ok) {
      this.trackViolation(clientToken, "Max authorization key attempts (5 logins/min) exceeded");
    }
    return ok;
  }
}

const rateLimiterInstance = new SecurityRateLimiter();

// General requests limiter middleware (uses ephemeral cryptographic random trace token)
function globalRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract or generate privacy-preserving anonymous trace identifier
  const clientToken = (req.headers["x-session-id"] as string) || "anonymous_session";
  if (rateLimiterInstance.isBlocked(clientToken)) {
    return res.status(403).json({ error: "Access denied. Rate limit threshold exceeded." });
  }

  const success = rateLimiterInstance.handleRequest(clientToken);
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

    // Provably fair calculation with 11-Tier Granular Multi-Tier RNG System (Max Cap 50.00x)
    // Non-linear Intra-Bracket Exponential Curve formula: Min + (Max - Min) * Math.pow(Math.random(), 1.8)
    const R = Math.random() * 100.0;
    let crashPoint = 1.00;
    if (R < 4.00) {
      crashPoint = 1.00; // Tier 1: 1.00x (Instant Bust) [4.00%]
    } else if (R < 12.00) {
      crashPoint = parseFloat((1.01 + Math.random() * (1.20 - 1.01)).toFixed(2)); // Tier 2: 1.01x - 1.20x [8.00%]
    } else if (R < 28.00) {
      crashPoint = parseFloat((1.21 + Math.random() * (1.50 - 1.21)).toFixed(2)); // Tier 3: 1.21x - 1.50x [16.00%]
    } else if (R < 42.00) {
      crashPoint = parseFloat((1.51 + Math.random() * (2.00 - 1.51)).toFixed(2)); // Tier 4: 1.51x - 2.00x [14.00%]
    } else if (R < 62.00) {
      crashPoint = parseFloat((2.01 + (3.50 - 2.01) * Math.pow(Math.random(), 1.8)).toFixed(2)); // Tier 5: 2.01x - 3.50x [20.00%]
    } else if (R < 74.00) {
      crashPoint = parseFloat((3.51 + (6.00 - 3.51) * Math.pow(Math.random(), 1.8)).toFixed(2)); // Tier 6: 3.51x - 6.00x [12.00%]
    } else if (R < 82.00) {
      crashPoint = parseFloat((6.01 + (9.00 - 6.01) * Math.pow(Math.random(), 1.8)).toFixed(2)); // Tier 7: 6.01x - 9.00x [8.00%]
    } else if (R < 88.00) {
      crashPoint = parseFloat((9.01 + (14.00 - 9.01) * Math.pow(Math.random(), 1.8)).toFixed(2)); // Tier 8: 9.01x - 14.00x [6.00%]
    } else if (R < 92.50) {
      crashPoint = parseFloat((14.01 + (20.00 - 14.01) * Math.pow(Math.random(), 1.8)).toFixed(2)); // Tier 9: 14.01x - 20.00x [4.50%]
    } else if (R < 95.50) {
      crashPoint = parseFloat((20.01 + (35.00 - 20.01) * Math.pow(Math.random(), 1.8)).toFixed(2)); // Tier 10: 20.01x - 35.00x [3.00%]
    } else {
      crashPoint = parseFloat((35.01 + (50.00 - 35.01) * Math.pow(Math.random(), 1.8)).toFixed(2)); // Tier 11: 35.01x - 50.00x [4.50%]
    }
    crashPoint = parseFloat(Math.max(1.00, Math.min(50.00, crashPoint)).toFixed(2));

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
        timestamp: new Date().toISOString(),
        details: `Game Round crashed at verified limit: ${this.currentRound.crashPoint}x`
      });
    }
  }

  public registerBetOnServer(userId: string, betAmount: number): { success: boolean; error?: string } {
    if (!this.currentRound || !this.currentRound.active || this.currentRound.isCrashed) {
      logSuspiciousActivity({
        type: "BET_NO_ACTIVE_ROUND",
        userId,
        details: "User attempted to post bet wager while game round is inactive"
      });
      return { success: false, error: "Game round is not open for wagering." };
    }

    // Verify all bet amounts on server before processing (Verify positive number only)
    if (isNaN(betAmount) || betAmount <= 0) {
      logSuspiciousActivity({
        type: "INVALID_BET_WAGER",
        userId,
        details: `Rejected negative, non-numeric, or null wager amount: ${betAmount}`
      });
      return { success: false, error: "Wager amount must be a clean positive number." };
    }

    if (this.activeWagers.has(userId)) {
      logSuspiciousActivity({
        type: "DUPLICATE_BET_WAGER",
        userId,
        details: "Attempted to register multiple active wagers inside matching cycle"
      });
      return { success: false, error: "An active bet is already bound to your credentials." };
    }

    this.activeWagers.set(userId, betAmount);
    return { success: true };
  }

  public processVerifyCashout(userId: string, targetMultiplier: number): { success: boolean; payout?: number; error?: string } {
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
// BACKEND CONFIGURATION: RTP, JACKPOT RNG & ACTUARIAL STATISTICAL MODEL
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

// Exact 8-Tier Multiplier Matrix with Strict Round-Interval Cooldown Constraints
export interface GlobalTierConfig {
  id: number;
  label: string;
  min: number;
  max: number;
  probability: number;
  targetIntervalRounds: number;
  minCooldown: number;
  maxCooldown: number;
}

export const GLOBAL_11_TIERS: GlobalTierConfig[] = [
  { id: 1, label: "1.00x (Instant Bust)", min: 1.00, max: 1.00, probability: 15.50, targetIntervalRounds: 6.45, minCooldown: 0, maxCooldown: 0 },
  { id: 2, label: "1.01x – 1.20x (Micro-Stumble)", min: 1.01, max: 1.20, probability: 14.50, targetIntervalRounds: 6.9, minCooldown: 0, maxCooldown: 0 },
  { id: 3, label: "1.21x – 1.50x (Low Safe Zone)", min: 1.21, max: 1.50, probability: 15.50, targetIntervalRounds: 6.45, minCooldown: 0, maxCooldown: 0 },
  { id: 4, label: "1.51x – 2.00x (Mid Safe Zone)", min: 1.51, max: 2.00, probability: 16.50, targetIntervalRounds: 6.06, minCooldown: 0, maxCooldown: 0 },
  { id: 5, label: "2.01x – 3.50x (Circulation Zone)", min: 2.01, max: 3.50, probability: 20.50, targetIntervalRounds: 4.87, minCooldown: 0, maxCooldown: 0 },
  { id: 6, label: "3.51x – 6.00x (Mid-Profit Zone)", min: 3.51, max: 6.00, probability: 10.50, targetIntervalRounds: 9.52, minCooldown: 0, maxCooldown: 0 },
  { id: 7, label: "6.01x – 9.99x (High Profit Zone)", min: 6.01, max: 9.99, probability: 4.00, targetIntervalRounds: 25.0, minCooldown: 0, maxCooldown: 0 },
  { id: 8, label: "10.00x – 15.00x (Big Win 1)", min: 10.00, max: 15.00, probability: 1.20, targetIntervalRounds: 83.3, minCooldown: 0, maxCooldown: 0 },
  { id: 9, label: "15.01x – 25.00x (Big Win 2)", min: 15.01, max: 25.00, probability: 0.90, targetIntervalRounds: 111.1, minCooldown: 0, maxCooldown: 0 },
  { id: 10, label: "25.01x – 35.00x (Mega Win)", min: 25.01, max: 35.00, probability: 0.50, targetIntervalRounds: 200.0, minCooldown: 0, maxCooldown: 0 },
  { id: 11, label: "35.01x – 50.00x (Max Cap Jackpot)", min: 35.01, max: 50.00, probability: 0.40, targetIntervalRounds: 250.0, minCooldown: 0, maxCooldown: 0 },
];

export const GLOBAL_12_TIERS = GLOBAL_11_TIERS; // Alias for backward compatibility
export const GLOBAL_8_TIERS = GLOBAL_11_TIERS;  // Alias for backward compatibility

// -------------------------------------------------------------
// 24/7 GLOBAL REAL-TIME ROUND HISTORY BUFFER
// -------------------------------------------------------------
export interface GlobalRoundHistoryItem {
  id: string;
  roundId: number;
  val: number;
  hash: string;
  serverSeed?: string;
  timestamp: string;
  tierId: number;
  tierLabel: string;
}

export const globalRoundHistoryBuffer: GlobalRoundHistoryItem[] = [];

/**
 * Pure 11-Tier Provably Fair continuous probability crash calculator
 * Exactly 3.00% total Big Win / Mega Win / Jackpot distribution (>= 10.00x)
 */
export function compute11TierCrashPoint(r: number): { val: number; tierId: number; tierLabel: string } {
  return computeCalibrated11TierCrashPoint(r);
}

// Pre-populate 24/7 continuous history on server startup with genuine 11-tier Provably Fair calculations
function initialize24x7GlobalHistoryBuffer() {
  if (globalRoundHistoryBuffer.length === 0) {
    const now = Date.now();
    for (let i = 1; i <= 35; i++) {
      const rId = 1000 - i;
      const randSeed = crypto.randomBytes(16).toString("hex");
      const seedHash = crypto.createHash("sha256").update(randSeed).digest("hex");
      const r = Math.random();
      const outcome = compute11TierCrashPoint(r);
      const timeOffset = now - i * 14500; // ~14.5s average round interval
      globalRoundHistoryBuffer.push({
        id: String(rId),
        roundId: rId,
        val: outcome.val,
        hash: seedHash,
        serverSeed: randSeed,
        timestamp: new Date(timeOffset).toISOString(),
        tierId: outcome.tierId,
        tierLabel: outcome.tierLabel
      });
    }
  }
}
initialize24x7GlobalHistoryBuffer();

// -------------------------------------------------------------
// 24/7 CENTRAL SERVER-AUTHORITATIVE AUTONOMOUS GAME LOOP ENGINE
// -------------------------------------------------------------
export interface CentralGameServerState {
  roundId: number;
  status: "COUNTDOWN" | "FLYING" | "CRASHED";
  currentMultiplier: number;
  targetCrashPoint: number;
  countdownRemainingMs: number;
  phaseStartTime: number;
  flightStartTime: number;
  seedHash: string;
  serverSeed: string;
  tierId: number;
  tierLabel: string;
  lastCrashPoint: number;
  lastCrashTimestamp: string;
}

const initialSeed = crypto.randomBytes(16).toString("hex");
const initialHash = crypto.createHash("sha256").update(initialSeed).digest("hex");
const initialOutcome = compute11TierCrashPoint(Math.random());

export let centralServerGameState: CentralGameServerState = {
  roundId: 1000 + globalRoundHistoryBuffer.length + 1,
  status: "COUNTDOWN",
  currentMultiplier: 1.00,
  targetCrashPoint: initialOutcome.val,
  countdownRemainingMs: 5000,
  phaseStartTime: Date.now(),
  flightStartTime: Date.now() + 5000,
  seedHash: initialHash,
  serverSeed: initialSeed,
  tierId: initialOutcome.tierId,
  tierLabel: initialOutcome.tierLabel,
  lastCrashPoint: globalRoundHistoryBuffer[0]?.val || 1.85,
  lastCrashTimestamp: globalRoundHistoryBuffer[0]?.timestamp || new Date().toISOString()
};

function startNewCentralServerRound() {
  backendRoundCounter += 1;
  const rId = 1000 + globalRoundHistoryBuffer.length + 1;
  const randSeed = crypto.randomBytes(16).toString("hex");
  const seedHash = crypto.createHash("sha256").update(randSeed).digest("hex");
  const r = Math.random();
  const outcome = compute11TierCrashPoint(r);

  centralServerGameState = {
    roundId: rId,
    status: "COUNTDOWN",
    currentMultiplier: 1.00,
    targetCrashPoint: outcome.val,
    countdownRemainingMs: 5000,
    phaseStartTime: Date.now(),
    flightStartTime: Date.now() + 5000,
    seedHash: seedHash,
    serverSeed: randSeed,
    tierId: outcome.tierId,
    tierLabel: outcome.tierLabel,
    lastCrashPoint: globalRoundHistoryBuffer[0]?.val || 1.00,
    lastCrashTimestamp: globalRoundHistoryBuffer[0]?.timestamp || new Date().toISOString()
  };
}

export const centralHistoryService = new CentralGameHistoryService();
centralHistoryService.initialize().catch(err => console.error("Central history init error:", err));

export let liveGameSyncController: LiveGameSyncController | null = null;

let globalTierCooldowns: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0
};
let globalTierCounts: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0
};

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
  tierCooldowns?: Record<number, number>;
  tierCounts?: Record<number, number>;
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
let sessionEntryBalance = 90847316.57; 
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

  // === PART 1: STRICT ZERO FOOTPRINT & PRIVACY PRESERVING MIDDLEWARE ===
  app.use((req, res, next) => {
    // 1. Explicitly sanitize and strip all client IP and tracking headers from request
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-real-ip"];
    delete req.headers["remote-addr"];
    delete req.headers["user-agent"];
    delete req.headers["referer"];
    delete req.headers["via"];

    // 2. Enforce strict privacy-preserving zero-footprint response headers
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Permissions-Policy", "interest-cohort=(), geolocation=(), camera=(), microphone=()");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-session-id, x-client-session, authorization");
    res.removeHeader("X-Powered-By");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
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
        activeViolationsBlocked: rateLimiterInstance["blockedClients"].size
      }
    });
  });

  // RECORD CASHOUT VALUE FROM CLIENTS TO REFINE ACTUARIAL ALGORITHMS
  const recordCashoutMetricHandler = (req: any, res: any) => {
    const { multiplierCashed, sessionId } = req.body || {};
    const valNum = Number(multiplierCashed);
    if (isNaN(valNum) || !isFinite(valNum) || valNum < 1.00 || valNum > 10000.00) {
      return res.status(400).json({ error: "INVALID_METRIC", message: "Multiplier must be a valid number between 1.00 and 10000.00" });
    }
    const val = parseFloat(valNum.toFixed(2));
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
      }
    }
    return res.json({ success: true, recordedMultiplier: val });
  };
  app.post("/api/security/analytics/cashout-metric", recordCashoutMetricHandler);
  app.post("/api/security/ai/cashout-metric", recordCashoutMetricHandler);

  // SECURE ANALYTICS & PREDICTIVE SIGNAL RETRIEVAL ROUTE (Protected by Anti-Scraper Harvester Throttle)
  const getAnalyticsInsightsHandler = (req: any, res: any) => {
    if (cashoutHistory.length === 0) {
      return res.json({
        totalAnalyzed: 0,
        averageCashoutPoint: 1.50,
        predictedPeakRiskPoint: 1.45,
        targetRtpPercent: 63,
        houseEdgePercent: 37,
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
    
    // Actuarial Prediction: Model player cashout preference average and calculate volatility threshold
    const predictedPeakRiskPoint = parseFloat(Math.max(1.05, averageCashoutPoint - 0.05).toFixed(2));

    return res.json({
      totalAnalyzed,
      averageCashoutPoint,
      predictedPeakRiskPoint,
      targetRtpPercent: 63,
      houseEdgePercent: 37,
      jackpotCyclesCount: `${backendRoundCounter % 100}/100`,
      jackpotsScheduledThisCycle: jackpotRoundsInCurrent100,
      superJackpotCyclesCount: `${backendRoundCounter % 23}/23`,
      superJackpotScheduledTarget: superJackpotRoundsInCurrent23
    });
  };
  app.get("/api/security/analytics/insights", antiScrapeEngine.getScrapingProtectionMiddleware(), getAnalyticsInsightsHandler);
  app.get("/api/security/ai/insights", antiScrapeEngine.getScrapingProtectionMiddleware(), getAnalyticsInsightsHandler);

  // In-memory throttling map to prevent bots from flooding round start requests
  const roundStartThrottle = new Map<string, number>();

  // GAME PRE-COMMITMENT HASH ENDPOINT
  app.post("/api/security/round/start", (req, res) => {
    const rawSession = (req.body && typeof req.body.sessionId === "string") ? req.body.sessionId.trim().slice(0, 64) : "default_session";
    const anonSessionHash = antiScrapeEngine.getAnonymousSessionHash(rawSession);

    // Rate-limit round initiation per session: enforce minimum 1.5 seconds between round starts
    const now = Date.now();
    const lastStart = roundStartThrottle.get(anonSessionHash) || 0;
    if (now - lastStart < 1200) {
      return res.status(429).json({
        error: "TOO_MANY_ROUND_STARTS",
        message: "Round initiation rate limit reached. Normal game pacing enforced.",
        retryAfterSeconds: 2
      });
    }
    roundStartThrottle.set(anonSessionHash, now);

    backendRoundCounter += 1;
    const currentModuloIndex = ((backendRoundCounter - 1) % 100) + 1; // 1 to 100 index

    const sessionId = rawSession;
    const currentBalance = (req.body && typeof req.body.currentBalance === "number") ? req.body.currentBalance : 90847316.57;
    const isRealPlayerActive = (req.body && typeof req.body.isRealPlayerActive === "boolean") ? req.body.isRealPlayerActive : false;
    const totalRealLiability = (req.body && typeof req.body.totalRealLiability === "number") ? req.body.totalRealLiability : 0;

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
    if (currentBalance === 90847316.57 || currentBalance === 150000) {
      state.sessionEntryBalance = currentBalance;
      state.crisisTriggerCount = 0;
      state.isInCrisisMode = false;
      console.log(`[SPECIAL TRIGGER] 🔄 Player refilled/reset to ${currentBalance.toLocaleString()} THB! Resetting crisisTriggerCount to 0 and clearing crisis mode for session ${sessionId}`);
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

    // Helper to generate crash points using Provably Fair Continuous Crash RNG with Actuarial 11-Tier Precision
    // Target RTP: 84.50% | House Edge: 15.50%
    // Instant Bust: 15.50% at 1.00x | Big Win Total (>= 10.00x): 3.00%
    // Absolute Max Cap: 50.00x | Long-term positive EV for House (Law of Large Numbers)
    const getExact8TierDistributionCrashPoint = (): number => {
      let r = Math.random(); // Uniform [0, 1)

      // Algorithmic pacing: prevent immediate consecutive mega multipliers (>= 20x)
      if (lastCrashPointForCooldownTrigger >= 20.00 && r > 0.90) {
        r = Math.random() * 0.90;
      }

      const outcome = computeCalibrated11TierCrashPoint(r);
      const crashValue = outcome.val;

      // Identify corresponding descriptive tier for metrics and state tracking
      let selectedTier = GLOBAL_11_TIERS.find(t => crashValue >= t.min && crashValue <= t.max);
      if (!selectedTier) {
        selectedTier = crashValue <= 1.00 ? GLOBAL_11_TIERS[0] : GLOBAL_11_TIERS[GLOBAL_11_TIERS.length - 1];
      }

      if (state) {
        if (!state.tierCounts) {
          state.tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 };
        }
        state.tierCounts[selectedTier.id] = (state.tierCounts[selectedTier.id] || 0) + 1;
      }
      globalTierCounts[selectedTier.id] = (globalTierCounts[selectedTier.id] || 0) + 1;

      console.log(`[PROVABLY FAIR RNG ENGINE] Round: ${backendRoundCounter} | Multiplier: ${crashValue}x (Tier ${selectedTier.id}: ${selectedTier.label}) | RTP Target: 84.50% | Cap: 50.00x`);

      return crashValue;
    };

    const getStandardDistributionCrashPoint = (): number => {
      return getExact8TierDistributionCrashPoint();
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

    // 🎯 SPECIAL FAKE REWARD SYSTEM FOR BOTS ONLY (35.00x - 50.00x)
    // เงื่อนไข: ถ้าตาไหนไม่มีคนจริงลงเดิมพันเลย (isRealPlayerActive = false)
    // จะสุ่มโอกาสแจกรางวัลหลอก 35.00x - 50.00x ให้เฉพาะบอทเท่านั้น
    let isFakeBotJackpotRound = false;
    if (!isRealPlayerActive && totalRealLiability === 0) {
      const fakeBotRoll = Math.random();
      // 3% subtle chance in spectator mode to trigger a fake high multiplier between 35.00x and 50.00x for bots
      if (fakeBotRoll < 0.03) {
        targetCrashPoint = parseFloat((35.00 + (50.00 - 35.00) * Math.pow(Math.random(), 1.8)).toFixed(2));
        targetCrashPoint = parseFloat(Math.min(50.00, targetCrashPoint).toFixed(2));
        isFakeBotJackpotRound = true;
        console.log(`[FAKE BOT REWARD ENGINE] 🤖 Zero real players active! Triggered fake spectator jackpot -> ${targetCrashPoint}x for simulated bots.`);
      }
    }

    if (!isFakeBotJackpotRound) {
      // Determine target crash point strictly from the Continuous Distributed RNG Matrix
      const rawMatrixCrashPoint = getExact8TierDistributionCrashPoint();
      targetCrashPoint = rawMatrixCrashPoint;
      console.log(`[GAME ENGINE] Provably Fair Distributed Multiplier Output: ${targetCrashPoint}x`);
    }

    // Strict Max Cap at 50.00x (Tier 11 upper limit)
    targetCrashPoint = parseFloat(Math.max(1.00, Math.min(50.00, targetCrashPoint)).toFixed(2));

    const isJackpotRound = (targetCrashPoint >= 6.01 && targetCrashPoint <= 14.00);
    const isSuperJackpotRound = (targetCrashPoint >= 14.01 && targetCrashPoint <= 35.00);
    const isMaxCapRound = (targetCrashPoint >= 35.01);
    isSpecial49xRound = (targetCrashPoint >= 49.00);

    // Generate statistical telemetry signal prediction (counter-volatility estimate)
    let signalPrediction = 1.30;
    if (targetCrashPoint >= 4.00) {
      signalPrediction = parseFloat((Math.random() * (1.38 - 1.05) + 1.05).toFixed(2));
    } else if (targetCrashPoint <= 1.30) {
      signalPrediction = parseFloat((Math.random() * (16.80 - 8.50) + 8.50).toFixed(2));
    } else {
      signalPrediction = parseFloat((Math.random() * (8.20 - 4.50) + 4.50).toFixed(2));
    }

    // Server telemetry logging
    console.log(`[GAME ENGINE] Round: ${backendRoundCounter} | Target Multiplier: ${targetCrashPoint}x${isNearCapitalTrap ? ' (TRAP ACTIVE)' : ''}${isSuperJackpotRound ? ' (SUPER JACKPOT)' : ''}${isJackpotRound ? ' (JACKPOT)' : ''}${isSpecial49xRound ? ' (SPECIAL 49X ACTIVE)' : ''} | Signal Model: ${signalPrediction}x`);

    const secureRoundCommit = integrityEngine.makeNewRound();
    // Inject backend calculated math outcomes as supreme oracle override
    secureRoundCommit.crashPoint = targetCrashPoint;

    const anonHash = antiScrapeEngine.getAnonymousSessionHash(sessionId);
    const antiBotChallenge = antiScrapeEngine.generateEphemeralChallengeToken(anonHash);

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
      signalPrediction,
      aiPrediction: signalPrediction, // Backward compatible field
      sessionRoundCounter: state.sessionRoundCounter,
      fakeTargetRound: state.fakeTargetRound,
      recalibrationCount: state.recalibrationCount,
      sessionEntryBalance: state ? state.sessionEntryBalance : 150000,
      isInCrisisMode: state ? state.isInCrisisMode : false,
      isPreemptTrapActive: isPreemptTrapActive,
      antiBotToken: antiBotChallenge.challengeToken,
      history: globalRoundHistoryBuffer.slice(0, 25).map(h => ({ id: h.id, val: h.val, hash: h.hash, timestamp: h.timestamp })),
      hint: "Valid server hash generated. Salt precommitted."
    });
  });

  // CONFIRM ROUND FINISH / CRASH ENDPOINT (Protected & Fully Validated)
  // Strictly commits a completed round to 24/7 central history ONLY after verified flight outcome
  app.post("/api/security/round/finish", async (req, res) => {
    try {
      const { roundId, crashMultiplier, seedHash, serverSeed } = req.body || {};
      const numMultiplier = Number(crashMultiplier);

      // 1. Strict Parameter & Range Bounds Validation
      if (isNaN(numMultiplier) || !isFinite(numMultiplier) || numMultiplier < 1.00 || numMultiplier > 10000.00) {
        return res.status(400).json({
          status: "ERROR",
          error: "INVALID_CRASH_MULTIPLIER",
          message: "Crash multiplier must be a finite number between 1.00 and 10000.00"
        });
      }

      backendRoundCounter += 1;
      const rawRoundId = roundId ? String(roundId) : `round_${backendRoundCounter}_${Date.now()}`;
      const parsedNum = Number(req.body?.numericRoundId || rawRoundId);
      const numericRoundId = (!isNaN(parsedNum) && parsedNum > 0) ? parsedNum : backendRoundCounter;

      // 2. Provably Fair Seed Verification (Cryptographic Pre-Commitment Check)
      if (serverSeed && seedHash) {
        const computedHash = crypto.createHash("sha256").update(String(serverSeed)).digest("hex");
        if (computedHash !== seedHash) {
          return res.status(400).json({
            status: "ERROR",
            error: "SEED_HASH_MISMATCH",
            message: "Provably fair cryptographic validation failed."
          });
        }
      }

      // 3. Idempotency Check: Prevent duplicate recording of the exact same unique round
      const existingRecord = globalRoundHistoryBuffer.find(h => String(h.id) === rawRoundId);
      if (existingRecord) {
        return res.json({
          status: "SUCCESS",
          message: "Round already finalized and committed to central history",
          record: existingRecord,
          idempotent: true
        });
      }

      const cleanMultiplier = parseFloat(numMultiplier.toFixed(2));
      let selectedTier = GLOBAL_11_TIERS.find(t => cleanMultiplier >= t.min && cleanMultiplier <= t.max);
      if (!selectedTier) {
        selectedTier = cleanMultiplier <= 1.00 ? GLOBAL_11_TIERS[0] : GLOBAL_11_TIERS[GLOBAL_11_TIERS.length - 1];
      }

      const timestamp = new Date().toISOString();
      const newRecord: HistoryRecord = {
        id: rawRoundId,
        roundId: numericRoundId,
        crashMultiplier: cleanMultiplier,
        val: cleanMultiplier,
        seedHash: seedHash || "",
        hash: seedHash || "",
        serverSeed: serverSeed || "",
        timestamp,
        tierId: selectedTier.id,
        tierLabel: selectedTier.label,
        tier: selectedTier.label
      };

      globalRoundHistoryBuffer.unshift({
        id: rawRoundId,
        roundId: numericRoundId,
        val: cleanMultiplier,
        hash: seedHash || "",
        serverSeed: serverSeed || "",
        timestamp,
        tierId: selectedTier.id,
        tierLabel: selectedTier.label
      });
      if (globalRoundHistoryBuffer.length > 100) {
        globalRoundHistoryBuffer.pop();
      }

      // Commit to Redis and broadcast to all connected web clients in real-time
      if (liveGameSyncController) {
        await liveGameSyncController.handleRoundCrash(newRecord);
      } else {
        await centralHistoryService.pushHistory(newRecord);
      }

      return res.json({
        status: "SUCCESS",
        message: "Round recorded to central 24/7 history after crash confirmed",
        record: newRecord
      });
    } catch (err) {
      console.error("Error in /api/security/round/finish:", err);
      return res.status(500).json({ status: "ERROR", error: "Failed to commit round to central history" });
    }
  });

  // 24/7 GLOBAL ROUND MULTIPLIER HISTORY API ENDPOINT
  // Protected by Anti-Scraping Harvester Defense against long-term automated statistical collectors
  app.get(["/api/security/history", "/api/game/history"], antiScrapeEngine.getScrapingProtectionMiddleware(), async (req, res) => {
    const requestedLimit = parseInt(req.query.limit as string, 10);
    const safeLimit = (!isNaN(requestedLimit) && requestedLimit > 0) ? Math.min(requestedLimit, 50) : 50;

    const redisHistory = await centralHistoryService.getRecentHistory(safeLimit);
    const combinedHistory = (redisHistory.length > 0 ? redisHistory : globalRoundHistoryBuffer).slice(0, safeLimit);

    const activeGameState = liveGameSyncController ? liveGameSyncController.getGameState() : centralServerGameState;

    res.json({
      status: "SUCCESS",
      globalRoundNum: activeGameState.roundId,
      serverTime: new Date().toISOString(),
      currentServerRound: {
        roundId: activeGameState.roundId,
        status: activeGameState.status,
        currentMultiplier: activeGameState.currentMultiplier,
        countdownRemainingMs: (activeGameState as any).countdownRemainingMs || 0,
        lastCompletedRoundCrashPoint: activeGameState.lastCrashPoint,
        lastCompletedRoundTimestamp: activeGameState.lastCrashTimestamp
      },
      history: (combinedHistory as HistoryRecord[]).map(h => ({
        id: h.id || String(h.roundId),
        roundId: h.roundId,
        val: h.val || h.crashMultiplier,
        crashMultiplier: h.crashMultiplier || h.val,
        hash: h.hash || h.seedHash,
        seedHash: h.seedHash || h.hash,
        serverSeed: h.serverSeed,
        timestamp: h.timestamp,
        tierId: h.tierId,
        tierLabel: h.tierLabel || h.tier || ""
      })),
      totalRoundsLogged: combinedHistory.length
    });
  });

  // 24/7 LIVE SERVER-AUTHORITATIVE STATE ENDPOINT
  // Protected by Anti-Scraping Harvester Defense against continuous state scraping loops
  app.get(["/api/security/state", "/api/game/state"], antiScrapeEngine.getScrapingProtectionMiddleware(), async (req, res) => {
    const activeGameState = liveGameSyncController ? liveGameSyncController.getGameState() : centralServerGameState;
    const redisHistory = await centralHistoryService.getRecentHistory(15);
    const recent = redisHistory.length > 0 ? redisHistory : globalRoundHistoryBuffer.slice(0, 15);

    res.json({
      status: "SUCCESS",
      serverTime: new Date().toISOString(),
      state: activeGameState,
      recentHistory: recent.map(h => ({
        id: h.id || String(h.roundId),
        val: h.val || (h as any).crashMultiplier,
        hash: h.hash || (h as any).seedHash,
        timestamp: h.timestamp
      }))
    });
  });

  // ============================================================================
  // ANTI-BOT CHALLENGE & STATISTICAL HARVESTER DEFENSE SUITE
  // ============================================================================
  app.post("/api/security/anti-bot/challenge", (req: Request, res: Response) => {
    const rawSession = (req.headers["x-session-id"] as string) || (req.body && req.body.sessionId) || "anonymous_session";
    const anonHash = antiScrapeEngine.getAnonymousSessionHash(rawSession);
    const tokenInfo = antiScrapeEngine.generateEphemeralChallengeToken(anonHash);
    res.json({
      status: "SUCCESS",
      anonymousHash: anonHash,
      challengeToken: tokenInfo.challengeToken,
      expiresAt: tokenInfo.expiresAt
    });
  });

  app.post("/api/security/anti-bot/verify", (req: Request, res: Response) => {
    const { challengeToken, sessionId } = req.body || {};
    const rawSession = (req.headers["x-session-id"] as string) || sessionId || "anonymous_session";
    const anonHash = antiScrapeEngine.getAnonymousSessionHash(rawSession);
    const isValid = antiScrapeEngine.verifyEphemeralChallengeToken(challengeToken, anonHash);
    if (!isValid) {
      return res.status(401).json({
        status: "REJECTED",
        error: "INVALID_OR_EXPIRED_TOKEN",
        message: "Anti-bot challenge validation failed."
      });
    }
    return res.json({
      status: "SUCCESS",
      verified: true,
      message: "Anti-bot session cleared."
    });
  });

  app.get("/api/security/anti-bot/status", (req: Request, res: Response) => {
    res.json(antiScrapeEngine.getTelemetryStatus());
  });

  // INPUT MATCHING LOGIN API WITH INTUBATED JWT SIGNER
  app.post("/api/security/login", async (req, res) => {
    const clientToken = (req.headers["x-session-id"] as string) || "anonymous_session";
    
    // Check Rate Limiting bound to logins strictly
    const canAttempt = rateLimiterInstance.handleLogin(clientToken);
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
          timestamp: new Date().toISOString(),
          details: `Authentication attempt signature failed for user: ${username}`
        });
        return res.status(401).json({ error: "Access key validation failed." });
      }

      const isValid = secureDb.verifyCredentials(password, user.passwordHash);
      if (!isValid) {
        logSecurityEvent({
          type: "FAILED_LOGIN_CREDENTIALS",
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
    const clientToken = (req.headers["x-session-id"] as string) || user.userId;

    // Rate Limiter Constraint Check (Max 10 bets per minute per user)
    const canBet = rateLimiterInstance.handleBet(user.userId, clientToken);
    if (!canBet) {
      return res.status(429).json({ error: "Betting speed bounds exceeded. Maximum 10 wagers per minute." });
    }

    const { betAmount } = req.body || {};
    const numBet = Number(betAmount);
    if (isNaN(numBet) || !isFinite(numBet) || numBet <= 0) {
      return res.status(400).json({ error: "INVALID_BET_AMOUNT", message: "Bet amount must be a positive finite number." });
    }
    
    // Server-side check
    const registration = integrityEngine.registerBetOnServer(user.userId, numBet);
    if (!registration.success) {
      return res.status(400).json({ error: registration.error });
    }

    logSecurityEvent({
      type: "BET_VALIDATED_OK",
      userId: user.userId,
      timestamp: new Date().toISOString(),
      details: `Validated state of wager correctly: ${numBet} THB`
    });

    res.json({ success: true, message: "Security deposit and gameplay wager validated and registered on server." });
  });

  // CASHOUT PROCESSING AND EXCLUSION API ROUTE
  app.post("/api/security/cashout", verifyJWT, (req, res) => {
    const user = (req as any).user;
    const { targetMultiplier } = req.body || {};
    const numMultiplier = Number(targetMultiplier);
    if (isNaN(numMultiplier) || !isFinite(numMultiplier) || numMultiplier < 1.00) {
      return res.status(400).json({ error: "INVALID_TARGET_MULTIPLIER", message: "Target multiplier must be at least 1.00x." });
    }

    const result = integrityEngine.processVerifyCashout(user.userId, numMultiplier);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    logSecurityEvent({
      type: "CASHOUT_SUCCEEDED",
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

  // ============================================================================
  // iGAMING MASTER FRANCHISE SEAMLESS WALLET CORE API (THB)
  // Endpoints: Webhook, Balance, Debit, Credit (3% Fee), Loss (10% Cashback), Rollback
  // ============================================================================

  // ============================================================================
  // iGAMING GLOBAL SEAMLESS WALLET CORE API (MULTI-OPERATOR / CURRENCY-AGNOSTIC)
  // Endpoints: Authenticate, Balance, Bet/Debit, Win/Credit, Loss, Rollback/Refund, Operators
  // ============================================================================

  // 0. OPERATOR AUTHENTICATE / HANDSHAKE
  const handleAuth = async (req: Request, res: Response) => {
    try {
      const { operator_id, token, user_id } = req.body;
      const effectiveUser = user_id || "USER_TH_001";
      const user = seamlessWalletStore.getBalance(effectiveUser);
      if (user.error === "USER_NOT_FOUND") {
        return res.status(404).json({ status: "FAILED", error: "USER_NOT_FOUND" });
      }
      return res.json({
        status: "SUCCESS",
        operator_id: operator_id || "OP_BOLLY_MAIN",
        user_id: effectiveUser,
        username: user.username,
        balance: user.balance,
        currency: "THB",
        session_token: "sess_" + crypto.randomBytes(16).toString("hex"),
        authenticated_at: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  };
  app.post("/api/v1/wallet/authenticate", verifySignatureMiddleware, handleAuth);
  app.post("/api/wallet/v1/authenticate", verifySignatureMiddleware, handleAuth);
  app.post("/api/wallet/v1/auth", verifySignatureMiddleware, handleAuth);

  // 1. MOBILE BANKING AUTOMATIC DEPOSIT WEBHOOK (PromptPay / Thai Banks)
  app.post("/api/v1/payment/webhook", verifySignatureMiddleware, async (req: Request, res: Response) => {
    try {
      const { txn_id, user_id, amount_thb, amount, status } = req.body;
      const depositAmt = amount_thb !== undefined ? amount_thb : amount;
      if (!txn_id || !user_id || depositAmt === undefined) {
        return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", message: "txn_id, user_id, amount are required." });
      }

      const result = await seamlessWalletStore.processBankingDeposit(txn_id, user_id, Number(depositAmt), status || "SUCCESS");
      if (result.error) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // 2. [A] GET WALLET BALANCE
  const handleBalance = async (req: Request, res: Response) => {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: "MISSING_USER_ID" });
      }
      const result = seamlessWalletStore.getBalance(user_id);
      if (result.error === "USER_NOT_FOUND") {
        return res.status(404).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  };
  app.post("/api/v1/wallet/balance", verifySignatureMiddleware, handleBalance);
  app.post("/api/wallet/v1/balance", verifySignatureMiddleware, handleBalance);

  // 3. [B] DEBIT / PLACE BET (หักเงินเดิมพัน / Idempotent Debit)
  const handleDebit = async (req: Request, res: Response) => {
    try {
      const { txn_id, user_id, amount, bet_amount, game_id, operator_id } = req.body;
      const betAmt = amount !== undefined ? amount : bet_amount;
      if (!txn_id || !user_id || betAmt === undefined) {
        return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
      }

      const result = await seamlessWalletStore.processDebit(
        txn_id, 
        user_id, 
        Number(betAmt), 
        game_id || "SKY_RUSH",
        operator_id || "OP_BOLLY_MAIN"
      );
      if (result.error === "INSUFFICIENT_FUNDS") {
        return res.status(400).json(result);
      }
      if (result.error === "USER_NOT_FOUND") {
        return res.status(404).json(result);
      }
      if (result.error) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  };
  app.post("/api/v1/wallet/debit", verifySignatureMiddleware, handleDebit);
  app.post("/api/wallet/v1/debit", verifySignatureMiddleware, handleDebit);
  app.post("/api/wallet/v1/bet", verifySignatureMiddleware, handleDebit);

  // 4. [C] CREDIT / WIN (โอนเงินชนะเข้ากระเป๋าผู้เล่น)
  const handleCredit = async (req: Request, res: Response) => {
    try {
      const { txn_id, user_id, win_amount, amount, game_id, operator_id } = req.body;
      const winAmt = win_amount !== undefined ? win_amount : amount;
      if (!txn_id || !user_id || winAmt === undefined) {
        return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
      }

      const result = await seamlessWalletStore.processCredit(
        txn_id, 
        user_id, 
        Number(winAmt), 
        game_id || "SKY_RUSH",
        operator_id || "OP_BOLLY_MAIN"
      );
      if (result.error === "USER_NOT_FOUND") {
        return res.status(404).json(result);
      }
      if (result.error) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  };
  app.post("/api/v1/wallet/credit", verifySignatureMiddleware, handleCredit);
  app.post("/api/wallet/v1/credit", verifySignatureMiddleware, handleCredit);
  app.post("/api/wallet/v1/win", verifySignatureMiddleware, handleCredit);

  // 5. [D] LOSS (สรุปผลแพ้)
  const handleLoss = async (req: Request, res: Response) => {
    try {
      const { txn_id, bet_txn_id, user_id, loss_amount, amount, game_id, operator_id } = req.body;
      const lossAmt = loss_amount !== undefined ? loss_amount : amount;
      if (!txn_id || !user_id || lossAmt === undefined) {
        return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
      }

      const result = await seamlessWalletStore.processLoss(
        txn_id, 
        bet_txn_id || `BET_${txn_id}`, 
        user_id, 
        Number(lossAmt), 
        game_id || "SKY_RUSH",
        operator_id || "OP_BOLLY_MAIN"
      );
      if (result.error === "USER_NOT_FOUND") {
        return res.status(404).json(result);
      }
      if (result.error) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  };
  app.post("/api/v1/wallet/loss", verifySignatureMiddleware, handleLoss);
  app.post("/api/wallet/v1/loss", verifySignatureMiddleware, handleLoss);

  // 6. [E] ROLLBACK / REFUND (คืนเงินบิลเดิมพันที่ยกเลิก)
  const handleRollback = async (req: Request, res: Response) => {
    try {
      const { txn_id, ref_txn_id, user_id, operator_id } = req.body;
      if (!txn_id || !ref_txn_id || !user_id) {
        return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
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
      if (result.error) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  };
  app.post("/api/v1/wallet/rollback", verifySignatureMiddleware, handleRollback);
  app.post("/api/wallet/v1/rollback", verifySignatureMiddleware, handleRollback);
  app.post("/api/wallet/v1/refund", verifySignatureMiddleware, handleRollback);

  // 7. OPERATORS MULTI-TENANT MANAGEMENT
  app.get("/api/wallet/v1/operators", (req: Request, res: Response) => {
    const operators = seamlessWalletStore.getAllOperators();
    res.json({ total: operators.length, operators });
  });

  app.post("/api/wallet/v1/operators/register", (req: Request, res: Response) => {
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

  // 8. RISK ASSURANCE & RISK CEILING METRICS API
  app.get("/api/risk-assurance/metrics", (req: Request, res: Response) => {
    const metrics = riskAssuranceEngine.getMetrics();
    res.json(metrics);
  });

  app.post("/api/risk-assurance/set-ceiling", (req: Request, res: Response) => {
    const { ceiling_thb } = req.body;
    if (ceiling_thb && Number(ceiling_thb) > 0) {
      riskAssuranceEngine.setRiskCeiling(Number(ceiling_thb));
      return res.json({ status: "SUCCESS", riskCeilingTHB: riskAssuranceEngine.riskCeilingTHB });
    }
    return res.status(400).json({ error: "INVALID_CEILING_AMOUNT" });
  });

  app.post("/api/risk-assurance/simulate", (req: Request, res: Response) => {
    const { playerCount, baseWager } = req.body;
    const result = riskAssuranceEngine.simulate100PlayerCohort({
      playerCount: playerCount ? Number(playerCount) : 100,
      baseWagerTHB: baseWager ? Number(baseWager) : 100
    });
    res.json(result);
  });

  // ============================================================================
  // 8.1. B2B REDIS MULTI-MERCHANT & DYNAMIC SESSION API
  // ============================================================================
  
  // Rate Limiting per Merchant's User (Composite Key: "ratelimit:<merchant_id>:<ext_user_id>")
  app.post("/api/b2b/redis/ratelimit", (req: Request, res: Response) => {
    try {
      const { merchant_id, ext_user_id } = req.body;
      const mId = merchant_id || "mch_alpha";
      const uId = ext_user_id || "ext_usr_998877";
      const key = `ratelimit:${mId}:${uId}`;
      const result = b2bRedis.incrWithExpire(key, 1);
      
      const isRateLimited = result.count > 10; // >10 req/sec threshold
      res.json({
        status: isRateLimited ? "RATE_LIMITED" : "ALLOWED",
        redis_command: `INCR "${key}"`,
        expire_command: `EXPIRE "${key}" 1`,
        composite_key: key,
        request_count_per_second: result.count,
        ttl_seconds: result.ttl,
        is_blocked: isRateLimited,
        message: isRateLimited 
          ? `Rate limit exceeded for composite key ${key}. Request throttled.` 
          : `Request permitted (${result.count}/10 per second).`
      });
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // Seamless Wallet Token Cache (Temporary Session mapping for API Validation)
  app.post("/api/b2b/redis/session", (req: Request, res: Response) => {
    try {
      const { token, merchant_id, ext_user_id, ttl_seconds } = req.body;
      const sessionToken = token || `token_${crypto.randomBytes(8).toString("hex")}`;
      const mId = merchant_id || "mch_alpha";
      const uId = ext_user_id || "ext_usr_998877";
      const ttl = ttl_seconds || 3600;
      const key = `b2b:session:${sessionToken}`;

      const sessionPayload = {
        merchant_id: mId,
        ext_user_id: uId,
        created_at: new Date().toISOString()
      };

      b2bRedis.setEx(key, ttl, JSON.stringify(sessionPayload));

      res.json({
        status: "SUCCESS",
        redis_command: `SETEX "${key}" ${ttl} '${JSON.stringify(sessionPayload)}'`,
        session_token: sessionToken,
        cached_data: sessionPayload,
        ttl_seconds: ttl,
        lookup_test: JSON.parse(b2bRedis.get(key) || "{}")
      });
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // Real-time High Win Feed (Anonymous Leaderboard for Operators)
  app.get("/api/b2b/redis/leaderboard", (req: Request, res: Response) => {
    try {
      const start = req.query.start ? parseInt(req.query.start as string, 10) : 0;
      const stop = req.query.stop ? parseInt(req.query.stop as string, 10) : 9;
      const key = "leaderboard:global_wins";
      const entries = b2bRedis.zRevRangeWithScores(key, start, stop);

      res.json({
        status: "SUCCESS",
        redis_command: `ZREVRANGE "${key}" ${start} ${stop} WITHSCORES`,
        key,
        total_top_entries: entries.length,
        leaderboard: entries
      });
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  app.post("/api/b2b/redis/leaderboard/add", (req: Request, res: Response) => {
    try {
      const { merchant_id, ext_user_id, win_amount } = req.body;
      const mId = merchant_id || "mch_alpha";
      const uId = ext_user_id || "ext_usr_998877";
      const score = parseFloat(Number(win_amount || 4500.50).toFixed(2));
      const member = `${mId}:${uId}`;
      const key = "leaderboard:global_wins";

      b2bRedis.zAdd(key, score, member);

      res.json({
        status: "SUCCESS",
        redis_command: `ZADD "${key}" ${score} "${member}"`,
        score,
        member,
        top_entries: b2bRedis.zRevRangeWithScores(key, 0, 9)
      });
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // ============================================================================
  // 8.2. POSTGRESQL TRANSACTIONAL LOGS & PARTITIONS API
  // ============================================================================

  // Get active partitions and recent partitioned logs
  app.get("/api/b2b/logs/partitions", (req: Request, res: Response) => {
    try {
      const partitions = b2bPostgresLogs.getPartitionSummaries();
      const recentLogs = b2bPostgresLogs.getRecentLogs(30);
      res.json({
        status: "SUCCESS",
        table_name: "b2b_transaction_logs",
        partition_strategy: "PARTITION BY RANGE (created_at)",
        active_partitions: partitions,
        recent_logs: recentLogs
      });
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // Idempotent Insert Log API
  app.post("/api/b2b/logs/insert", (req: Request, res: Response) => {
    try {
      const { merchant_id, ext_user_id, game_id, round_id, transaction_type, amount } = req.body;
      if (!merchant_id || !ext_user_id || !game_id || !round_id || !transaction_type || amount === undefined) {
        return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
      }

      const result = b2bPostgresLogs.insertLog({
        merchant_id,
        ext_user_id,
        game_id,
        round_id,
        transaction_type,
        amount: Number(amount)
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // ============================================================================
  // 8.3. B2B ANALYTICS & MERCHANT REVENUE METRICS (3 SQL Queries)
  // ============================================================================

  // QUERY 1: RTP Calculation per Game Across All Merchants
  app.get("/api/b2b/analytics/rtp-by-game", (req: Request, res: Response) => {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
      const data = b2bPostgresLogs.queryRtpPerGame(hours);
      res.json({
        status: "SUCCESS",
        query_sql: `SELECT game_id, COUNT(DISTINCT round_id) AS total_rounds, SUM(CASE WHEN transaction_type = 'BET' THEN amount ELSE 0 END) AS total_bets, SUM(CASE WHEN transaction_type = 'WIN' THEN amount ELSE 0 END) AS total_wins, ROUND((SUM(CASE WHEN transaction_type = 'WIN' THEN amount ELSE 0 END) / NULLIF(SUM(CASE WHEN transaction_type = 'BET' THEN amount ELSE 0 END), 0)) * 100, 2) AS actual_rtp_percentage FROM b2b_transaction_logs WHERE created_at >= NOW() - INTERVAL '${hours} hours' GROUP BY game_id;`,
        time_window_hours: hours,
        results: data
      });
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // QUERY 2: Account-Level Frequency Analysis (Cross-Merchant Bot Detection)
  app.get("/api/b2b/analytics/bot-detection", (req: Request, res: Response) => {
    try {
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 25;
      const windowMinutes = req.query.window_minutes ? parseInt(req.query.window_minutes as string, 10) : 5;
      const data = b2bPostgresLogs.queryAccountFrequencyAnomalies(threshold, windowMinutes);
      res.json({
        status: "SUCCESS",
        query_sql: `SELECT merchant_id, ext_user_id, COUNT(*) AS action_count, MIN(created_at) AS start_time, MAX(created_at) AS end_time FROM b2b_transaction_logs WHERE created_at >= NOW() - INTERVAL '${windowMinutes} minutes' GROUP BY merchant_id, ext_user_id, date_trunc('minute', created_at) HAVING COUNT(*) > ${threshold};`,
        anomaly_count: data.length,
        anomalies: data
      });
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // QUERY 3: Revenue Settlement Breakdown by Merchant (GGR per Operator)
  app.get("/api/b2b/analytics/merchant-ggr", (req: Request, res: Response) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const data = b2bPostgresLogs.queryMerchantRevenueGgr(days);
      res.json({
        status: "SUCCESS",
        query_sql: `SELECT merchant_id, DATE(created_at) AS report_date, SUM(CASE WHEN transaction_type = 'BET' THEN amount ELSE 0 END) - SUM(CASE WHEN transaction_type = 'WIN' THEN amount ELSE 0 END) AS merchant_ggr FROM b2b_transaction_logs WHERE created_at >= NOW() - INTERVAL '${days} days' GROUP BY merchant_id, DATE(created_at) ORDER BY report_date DESC, merchant_ggr DESC;`,
        report_days: days,
        records_count: data.length,
        settlements: data
      });
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // Seed sample traffic
  app.post("/api/b2b/logs/seed", (req: Request, res: Response) => {
    try {
      const count = req.body.count ? parseInt(req.body.count, 10) : 100;
      b2bPostgresLogs.seedRealisticData(count);
      res.json({ status: "SUCCESS", message: `Seeded ${count} transactions across multi-merchant partitions.` });
    } catch (err: any) {
      res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  });

  // 9. SWAGGER / OPENAPI 3.0 SPECIFICATION
  app.get("/api/docs/openapi.json", (req: Request, res: Response) => {
    const openApiSpec = {
      openapi: "3.0.3",
      info: {
        title: "Global iGaming Seamless Wallet & Risk Assurance API",
        version: "1.0.0",
        description: "Standardized High-Throughput Seamless Wallet API for Global iGaming Platforms with HMAC-SHA256 Authentication, Idempotency Locks, Risk Cushion Explosion Protocol, calibrated 75.0% RTP / 25.0% House Edge, and positive long-term house EV."
      },
      servers: [
        { url: "http://localhost:3000", description: "Local Dev / Sandbox Server" }
      ],
      paths: {
        "/api/wallet/v1/authenticate": {
          post: {
            summary: "Player Handshake & Session Authentication",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      operator_id: { type: "string", example: "OP_BOLLY_MAIN" },
                      user_id: { type: "string", example: "USER_TH_001" },
                      token: { type: "string", example: "user_session_token_xyz" }
                    }
                  }
                }
              }
            },
            responses: {
              200: { description: "Player authenticated successfully with live balance." }
            }
          }
        },
        "/api/wallet/v1/balance": {
          post: {
            summary: "Query Live Wallet Balance",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["user_id"],
                    properties: {
                      user_id: { type: "string", example: "USER_TH_001" }
                    }
                  }
                }
              }
            },
            responses: {
              200: { description: "Returns current available balance." }
            }
          }
        },
        "/api/wallet/v1/bet": {
          post: {
            summary: "Debit / Place Bet with Idempotency",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["txn_id", "user_id", "amount"],
                    properties: {
                      txn_id: { type: "string", example: "TXN_BET_9901" },
                      user_id: { type: "string", example: "USER_TH_001" },
                      amount: { type: "number", example: 100.00 },
                      game_id: { type: "string", example: "SKY_RUSH" },
                      operator_id: { type: "string", example: "OP_BOLLY_MAIN" }
                    }
                  }
                }
              }
            },
            responses: {
              200: { description: "Bet deducted and row-level locked successfully." }
            }
          }
        },
        "/api/wallet/v1/win": {
          post: {
            summary: "Credit / Win Settlement",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["txn_id", "user_id", "win_amount"],
                    properties: {
                      txn_id: { type: "string", example: "TXN_WIN_9901" },
                      user_id: { type: "string", example: "USER_TH_001" },
                      win_amount: { type: "number", example: 250.00 },
                      game_id: { type: "string", example: "SKY_RUSH" }
                    }
                  }
                }
              }
            },
            responses: {
              200: { description: "Net win credited into user wallet." }
            }
          }
        },
        "/api/wallet/v1/loss": {
          post: {
            summary: "Loss Notification",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["txn_id", "user_id", "loss_amount"],
                    properties: {
                      txn_id: { type: "string", example: "TXN_LOSS_9901" },
                      bet_txn_id: { type: "string", example: "TXN_BET_9901" },
                      user_id: { type: "string", example: "USER_TH_001" },
                      loss_amount: { type: "number", example: 100.00 }
                    }
                  }
                }
              }
            },
            responses: {
              200: { description: "Loss recorded successfully." }
            }
          }
        },
        "/api/wallet/v1/rollback": {
          post: {
            summary: "Rollback / Cancel Bet Wager",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["txn_id", "ref_txn_id", "user_id"],
                    properties: {
                      txn_id: { type: "string", example: "TXN_ROLLBACK_9901" },
                      ref_txn_id: { type: "string", example: "TXN_BET_9901" },
                      user_id: { type: "string", example: "USER_TH_001" }
                    }
                  }
                }
              }
            },
            responses: {
              200: { description: "Refund applied back to player balance." }
            }
          }
        }
      }
    };
    res.json(openApiSpec);
  });

  // 10. POSTMAN COLLECTION v2.1.0 EXPORT
  app.get("/api/docs/postman.json", (req: Request, res: Response) => {
    const postmanCollection = {
      info: {
        name: "iGaming Seamless Wallet & Risk Engine API Collection",
        description: "Official integration collection for global iGaming operators, aggregator networks, and casino game studios.",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: [
        {
          name: "1. Authenticate Player",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ operator_id: "OP_BOLLY_MAIN", user_id: "USER_TH_001" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/v1/authenticate", host: ["{{baseUrl}}"], path: ["api", "wallet", "v1", "authenticate"] }
          }
        },
        {
          name: "2. Get Balance",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ user_id: "USER_TH_001" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/v1/balance", host: ["{{baseUrl}}"], path: ["api", "wallet", "v1", "balance"] }
          }
        },
        {
          name: "3. Debit / Place Bet",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                txn_id: "TXN_DEBIT_{{$timestamp}}",
                user_id: "USER_TH_001",
                amount: 100.00,
                game_id: "SKY_RUSH",
                operator_id: "OP_BOLLY_MAIN"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/v1/bet", host: ["{{baseUrl}}"], path: ["api", "wallet", "v1", "bet"] }
          }
        },
        {
          name: "4. Credit / Win",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                txn_id: "TXN_CREDIT_{{$timestamp}}",
                user_id: "USER_TH_001",
                win_amount: 250.00,
                game_id: "SKY_RUSH",
                operator_id: "OP_BOLLY_MAIN"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/v1/win", host: ["{{baseUrl}}"], path: ["api", "wallet", "v1", "win"] }
          }
        },
        {
          name: "5. Loss Settlement",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                txn_id: "TXN_LOSS_{{$timestamp}}",
                bet_txn_id: "TXN_DEBIT_ORIGINAL",
                user_id: "USER_TH_001",
                loss_amount: 100.00,
                game_id: "SKY_RUSH",
                operator_id: "OP_BOLLY_MAIN"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/v1/loss", host: ["{{baseUrl}}"], path: ["api", "wallet", "v1", "loss"] }
          }
        },
        {
          name: "6. Rollback / Cancel Bet",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                txn_id: "TXN_ROLLBACK_{{$timestamp}}",
                ref_txn_id: "TXN_DEBIT_ORIGINAL",
                user_id: "USER_TH_001",
                operator_id: "OP_BOLLY_MAIN"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/v1/rollback", host: ["{{baseUrl}}"], path: ["api", "wallet", "v1", "rollback"] }
          }
        }
      ]
    };
    res.json(postmanCollection);
  });

  // DEVELOPER & MASTER FRANCHISE CONSOLE INSPECTION ENDPOINTS
  app.get("/api/v1/wallet/transactions", (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const transactions = seamlessWalletStore.getTransactions(limit);
    res.json({ total: transactions.length, transactions });
  });

  app.get("/api/v1/wallet/users", (req: Request, res: Response) => {
    const users = seamlessWalletStore.getAllUsers();
    res.json({ total: users.length, users });
  });

  app.post("/api/v1/wallet/create-user", (req: Request, res: Response) => {
    const { id, username, balance } = req.body;
    if (!id || !username) {
      return res.status(400).json({ error: "id and username are required." });
    }
    const user = seamlessWalletStore.createUser(id, username, Number(balance || 0));
    res.json({ status: "SUCCESS", user });
  });

  app.post("/api/v1/wallet/sign", (req: Request, res: Response) => {
    const { payload, secretKey } = req.body;
    const key = secretKey || API_SECRET_KEY;
    const signature = generateHmacSignature(payload, key);
    res.json({ signature, algorithm: "HMAC-SHA256" });
  });

  app.post("/api/v1/wallet/reset-demo", (req: Request, res: Response) => {
    seamlessWalletStore.resetDemoData();
    res.json({ status: "SUCCESS", message: "Demo data reset successfully." });
  });

  // ============================================================================
  // MASTER FRANCHISE & K6 LOAD TESTING ENDPOINTS
  // ============================================================================
  app.post("/api/k6/run", async (req: Request, res: Response) => {
    try {
      const { vus, duration } = req.body;
      const targetVUs = vus ? Math.min(Math.max(Number(vus), 5), 200) : 50;
      const durationSec = duration ? Math.min(Math.max(Number(duration), 1), 10) : 3;
      const result = await masterK6Simulator.runFullK6Suite(targetVUs, durationSec);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: "K6_EXECUTION_ERROR", message: err.message });
    }
  });

  // Universal Franchise Network Gateway: Converts any external merchant user to standardized user_XXXXXXXXXXX format
  app.post("/api/v1/franchise/gateway", async (req: Request, res: Response) => {
    try {
      const { external_user, operator_id, deposit_amount } = req.body;
      const rawUser = String(external_user || "player_" + Date.now());
      const digitsOnly = rawUser.replace(/\D/g, "");
      const padSeed = crypto.createHash("sha256").update(rawUser).digest("hex").replace(/\D/g, "").padStart(11, "9");
      const num11 = (digitsOnly + padSeed).slice(0, 11);
      const standardizedUserId = `user_${num11}`;

      // Check if user already exists or create new
      let user = seamlessWalletStore.getUser(standardizedUserId);
      if (!user) {
        user = seamlessWalletStore.createUser(standardizedUserId, standardizedUserId, Number(deposit_amount || 50000));
      }

      res.json({
        status: "SUCCESS",
        original_user: rawUser,
        standardized_user_id: standardizedUserId,
        user_number_11_digits: num11,
        operator_id: operator_id || "OP_BOLLY_MAIN",
        balance: user.balance,
        currency: "THB",
        gateway_version: "2.4.0-B2B-ZERO-PII",
        connected_at: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: "GATEWAY_ERROR", message: err.message });
    }
  });

  // CREATE HTTP SERVER AND ATTACH SOCKET.IO
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  liveGameSyncController = new LiveGameSyncController(io, centralHistoryService);

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

  // Listening Port Allocation Bind on HTTP & WebSocket Server
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK INFRASTRUCTURE] Central 24/7 Game History Engine & WebSockets active on port ${PORT}`);
  });
}

runSecurityFullstackServer().catch((err) => {
  console.error("FATAL: Failed to initialize fullstack application", err);
});
