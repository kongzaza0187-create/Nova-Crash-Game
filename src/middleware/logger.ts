import crypto from "crypto";
import { getMaltaIsoString } from "../lib/timeUtils";

export interface FinancialAuditLog {
  timestamp: string;
  trace_id: string;
  user_id: string;
  transaction_id: string;
  ref_transaction_id?: string | null;
  amount: number;
  gross_amount?: number;
  fee?: number;
  cashback?: number;
  action_type: "DEPOSIT_BANKING" | "BET" | "WIN" | "CASHBACK_10%" | "ROLLBACK" | "BALANCE_QUERY";
  http_status: number;
  balance_before?: number;
  balance_after?: number;
  currency: string;
  game_id?: string;
  ip: string;
  duration_ms?: number;
  status: "SUCCESS" | "FAILED" | "REJECTED";
  error_message?: string;
}

const SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "authorization",
  "x-signature",
  "signature",
  "credit_card",
  "apikey",
  "api_key"
];

export function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item));
  }

  const masked: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
      key.toLowerCase().includes(sensitiveKey)
    );

    if (isSensitive) {
      masked[key] = "***MASKED***";
    } else if (val && typeof val === "object") {
      masked[key] = maskSensitiveData(val);
    } else {
      masked[key] = val;
    }
  }
  return masked;
}

class StructuredLogger {
  private isProduction = process.env.NODE_ENV === "production";
  private inMemoryAuditLedger: FinancialAuditLog[] = [];

  public generateTraceId(): string {
    return `trc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  public info(message: string, meta: Record<string, any> = {}) {
    const logPayload = {
      level: "INFO",
      timestamp: getMaltaIsoString(),
      timezone: "Europe/Malta",
      message,
      ...maskSensitiveData(meta)
    };
    console.log(JSON.stringify(logPayload));
  }

  public warn(message: string, meta: Record<string, any> = {}) {
    const logPayload = {
      level: "WARN",
      timestamp: getMaltaIsoString(),
      timezone: "Europe/Malta",
      message,
      ...maskSensitiveData(meta)
    };
    console.warn(JSON.stringify(logPayload));
  }

  public error(message: string, error?: Error | any, meta: Record<string, any> = {}) {
    const logPayload = {
      level: "ERROR",
      timestamp: getMaltaIsoString(),
      timezone: "Europe/Malta",
      message,
      error_name: error?.name || "Error",
      error_message: error?.message || String(error),
      stack: this.isProduction ? undefined : error?.stack,
      ...maskSensitiveData(meta)
    };
    console.error(JSON.stringify(logPayload));
  }

  public logFinancialAudit(auditEntry: FinancialAuditLog) {
    this.inMemoryAuditLedger.push(auditEntry);
    if (this.inMemoryAuditLedger.length > 5000) {
      this.inMemoryAuditLedger.shift();
    }

    const logPayload = {
      audit_type: "FINANCIAL_TRANSACTION",
      level: auditEntry.status === "SUCCESS" ? "INFO" : "WARN",
      timezone: "Europe/Malta",
      ...auditEntry
    };
    console.log(JSON.stringify(logPayload));
  }

  public getRecentAuditLogs(limit: number = 100): FinancialAuditLog[] {
    return this.inMemoryAuditLedger.slice(-limit).reverse();
  }
}

export const logger = new StructuredLogger();
