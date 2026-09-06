import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

/**
 * Ephemeral Anonymous Scraper & Bot Defense State
 * Note: Zero IP addresses, zero device fingerprints, zero User-Agent strings.
 * Identification is done strictly through ephemeral cryptographic hashes of session tokens.
 */
interface SessionScrapeProfile {
  anonymousHash: string;
  historyQueryTimestamps: number[];
  cadenceIntervals: number[];
  totalQueries: number;
  quarantinedUntil: number;
  violationCount: number;
  lastActive: number;
}

export class AntiScrapeEngine {
  private static instance: AntiScrapeEngine;
  private readonly secretSalt: string;
  private profiles: Map<string, SessionScrapeProfile> = new Map();
  private totalInterceptions: number = 0;
  private totalCadenceAnomalies: number = 0;

  private readonly MAX_HISTORY_QUERIES_PER_MINUTE = 60; // 1 query per second allowable for live synchronized clients
  private readonly MIN_BOT_CADENCE_STD_DEV_MS = 15; // Less than 15ms variance indicates automated programmatic loop
  private readonly QUARANTINE_DURATION_MS = 30000; // 30 seconds penalty

  private constructor() {
    this.secretSalt = crypto.randomBytes(32).toString("hex");

    // Periodic cleanup of stale sessions (> 10 minutes inactive)
    setInterval(() => {
      const now = Date.now();
      for (const [key, profile] of this.profiles.entries()) {
        if (now - profile.lastActive > 600000) {
          this.profiles.delete(key);
        }
      }
    }, 180000);
  }

  public static getInstance(): AntiScrapeEngine {
    if (!AntiScrapeEngine.instance) {
      AntiScrapeEngine.instance = new AntiScrapeEngine();
    }
    return AntiScrapeEngine.instance;
  }

  /**
   * Derive a non-reversible cryptographic hash from an anonymous session token or header.
   * Completely avoids storing or reading network IP / device identity.
   */
  public getAnonymousSessionHash(rawToken?: string): string {
    const seed = (typeof rawToken === "string" && rawToken.trim().length > 0)
      ? rawToken.trim()
      : "ephemeral_default_session";
    return crypto
      .createHmac("sha256", this.secretSalt)
      .update(seed)
      .digest("hex")
      .substring(0, 24);
  }

  /**
   * Generate an Ephemeral Anti-Bot Challenge Token for legitimate web clients.
   * Valid for 60 seconds with HMAC signature.
   */
  public generateEphemeralChallengeToken(anonymousHash: string): { challengeToken: string; expiresAt: number } {
    const timestamp = Date.now();
    const expiresAt = timestamp + 60000;
    const payload = `${anonymousHash}:${timestamp}:${expiresAt}`;
    const signature = crypto.createHmac("sha256", this.secretSalt).update(payload).digest("hex").substring(0, 16);
    const challengeToken = `${Buffer.from(payload).toString("base64url")}.${signature}`;
    return { challengeToken, expiresAt };
  }

  /**
   * Validate an Ephemeral Challenge Token
   */
  public verifyEphemeralChallengeToken(token: string, anonymousHash: string): boolean {
    if (!token || typeof token !== "string" || !token.includes(".")) {
      return false;
    }
    const [encodedPayload, providedSig] = token.split(".");
    try {
      const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
      const [tokenHash, , expiresAtStr] = payload.split(":");
      if (tokenHash !== anonymousHash) {
        return false;
      }
      const expiresAt = parseInt(expiresAtStr, 10);
      if (isNaN(expiresAt) || Date.now() > expiresAt) {
        return false;
      }
      const expectedSig = crypto.createHmac("sha256", this.secretSalt).update(payload).digest("hex").substring(0, 16);
      return crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig));
    } catch {
      return false;
    }
  }

  /**
   * Calculate standard deviation of intervals between requests
   */
  private calculateStandardDeviation(intervals: number[]): number {
    if (intervals.length < 3) return 999;
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    return Math.sqrt(variance);
  }

  /**
   * Evaluate request for statistical scraping patterns & robotic cadence.
   * Returns true if request is allowed, false if blocked/quarantined.
   */
  public inspectHistoryScrapeRequest(anonymousHash: string): {
    allowed: boolean;
    reason?: string;
    retryAfterSeconds?: number;
  } {
    const now = Date.now();
    let profile = this.profiles.get(anonymousHash);

    if (!profile) {
      profile = {
        anonymousHash,
        historyQueryTimestamps: [now],
        cadenceIntervals: [],
        totalQueries: 1,
        quarantinedUntil: 0,
        violationCount: 0,
        lastActive: now
      };
      this.profiles.set(anonymousHash, profile);
      return { allowed: true };
    }

    profile.lastActive = now;
    profile.totalQueries++;

    // Check if session is actively quarantined
    if (profile.quarantinedUntil > now) {
      const retryAfter = Math.ceil((profile.quarantinedUntil - now) / 1000);
      return {
        allowed: false,
        reason: "SESSION_IN_SCRAPER_QUARANTINE",
        retryAfterSeconds: retryAfter
      };
    }

    // Record interval between current and last query
    const lastTimestamp = profile.historyQueryTimestamps[profile.historyQueryTimestamps.length - 1] || now;
    const intervalMs = Math.max(0, now - lastTimestamp);
    profile.historyQueryTimestamps.push(now);

    // Prune history queries older than 60 seconds
    const oneMinuteAgo = now - 60000;
    profile.historyQueryTimestamps = profile.historyQueryTimestamps.filter(t => t >= oneMinuteAgo);

    if (intervalMs > 0 && intervalMs < 30000) {
      profile.cadenceIntervals.push(intervalMs);
      if (profile.cadenceIntervals.length > 8) {
        profile.cadenceIntervals.shift();
      }
    }

    // 1. High-frequency harvester detection (> 15 queries in 60s for historical telemetry)
    if (profile.historyQueryTimestamps.length > this.MAX_HISTORY_QUERIES_PER_MINUTE) {
      profile.violationCount++;
      profile.quarantinedUntil = now + this.QUARANTINE_DURATION_MS;
      this.totalInterceptions++;
      return {
        allowed: false,
        reason: "EXCESSIVE_HISTORY_QUERY_FREQUENCY",
        retryAfterSeconds: Math.ceil(this.QUARANTINE_DURATION_MS / 1000)
      };
    }

    // 2. Robotic cadence detection (strict millisecond loops with negligible variance)
    if (profile.cadenceIntervals.length >= 5) {
      const stdDev = this.calculateStandardDeviation(profile.cadenceIntervals);
      // If intervals are extremely uniform (e.g. exactly 500ms ± 15ms or 1000ms ± 15ms), it's a programmatic scraper
      if (stdDev < this.MIN_BOT_CADENCE_STD_DEV_MS) {
        profile.violationCount++;
        profile.quarantinedUntil = now + this.QUARANTINE_DURATION_MS;
        this.totalCadenceAnomalies++;
        this.totalInterceptions++;
        return {
          allowed: false,
          reason: "ROBOTIC_CADENCE_DETECTED",
          retryAfterSeconds: Math.ceil(this.QUARANTINE_DURATION_MS / 1000)
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Express Middleware to enforce Anti-Scraping protection on history and analytics routes
   */
  public getScrapingProtectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Derive anonymous session identifier without capturing or logging IP/fingerprint
      const cookieSession = (req as any).cookies?.session_id || (req as any).cookies?.supernova_session || (req as any).cookies?.skyrush_session;
      const rawSession = (req.headers["x-session-id"] as string) || 
                         (req.headers["x-client-session"] as string) ||
                         (req.query.sessionId as string) ||
                         cookieSession ||
                         "client_session_" + (req.headers["accept-language"] || "th").substring(0, 5);
      const anonHash = this.getAnonymousSessionHash(rawSession);

      const check = this.inspectHistoryScrapeRequest(anonHash);
      if (!check.allowed) {
        res.setHeader("Retry-After", String(check.retryAfterSeconds || 30));
        return res.status(429).json({
          status: "REJECTED",
          error: "RATE_LIMIT_EXCEEDED",
          code: "ERR_STATISTICAL_SCRAPING_QUARANTINE",
          message: "Automated statistical scraping defense active. Query cadence throttled to prevent mass data harvesting.",
          retryAfterSeconds: check.retryAfterSeconds || 30
        });
      }

      // Attach anonymous hash to request for downstream handlers
      (req as any).anonymousSessionHash = anonHash;
      next();
    };
  }

  /**
   * Anti-Bot Metrics Summary (Zero-PII compliant)
   */
  public getTelemetryStatus() {
    let activeQuarantines = 0;
    const now = Date.now();
    for (const p of this.profiles.values()) {
      if (p.quarantinedUntil > now) {
        activeQuarantines++;
      }
    }

    return {
      status: "ARMED",
      zeroPiiCompliant: true,
      activeProfilesMonitored: this.profiles.size,
      activeQuarantinedScrapers: activeQuarantines,
      totalInterceptions: this.totalInterceptions,
      totalCadenceAnomaliesNeutralized: this.totalCadenceAnomalies,
      protectionThresholds: {
        maxQueriesPerMinute: this.MAX_HISTORY_QUERIES_PER_MINUTE,
        cadenceStdDevToleranceMs: this.MIN_BOT_CADENCE_STD_DEV_MS,
        quarantinePenaltySeconds: this.QUARANTINE_DURATION_MS / 1000
      }
    };
  }
}

export const antiScrapeEngine = AntiScrapeEngine.getInstance();
