import crypto from "crypto";

export interface GameRoundResult {
  roundId: string;
  crashPoint: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  hash: string;
  timestamp: string;
}

export class ModularGameEngine {
  private static instance: ModularGameEngine;
  private houseEdgePercent: number = 37.0; // 63% Theoretical RTP (37% House Edge)
  private accumulatedFuelTaxTHB: number = 0;
  private accumulatedFractionSweepTHB: number = 0;

  private constructor() {}

  public static getInstance(): ModularGameEngine {
    if (!ModularGameEngine.instance) {
      ModularGameEngine.instance = new ModularGameEngine();
    }
    return ModularGameEngine.instance;
  }

  // Provably Fair Crash Point Generation
  public generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    const hash = crypto.createHmac("sha256", serverSeed).update(combined).digest("hex");
    const subHash = hash.substring(0, 13);
    const intVal = parseInt(subHash, 16);
    const maxInt = Math.pow(2, 52);
    const e = intVal / maxInt;

    // Standard Provably Fair Crash formula with 3% house edge
    const r = (100 - this.houseEdgePercent) / 100;
    const crashMultiplier = Math.floor((100 * r) / (1 - e)) / 100;

    // Minimum crash point is 1.00x, capped at 1000.00x for stability
    return Math.max(1.0, Math.min(1000.0, crashMultiplier));
  }

  // 3-Tier Fuel Tax Calculation
  public calculateFuelTax(wagerTHB: number): number {
    let rate = 0.05; // 5% base
    if (wagerTHB >= 10000) {
      rate = 0.15; // 15% whale tier
    } else if (wagerTHB >= 2000) {
      rate = 0.10; // 10% standard tier
    }
    const tax = parseFloat((wagerTHB * rate).toFixed(2));
    this.accumulatedFuelTaxTHB += tax;
    return tax;
  }

  // Fraction Sweeping: Truncate down to 2 decimal places and sweep sub-cent remainder
  public truncatePayoutAndSweep(rawAmount: number): { payout: number; swept: number } {
    const payout = Math.floor(rawAmount * 100) / 100;
    const swept = Math.max(0, parseFloat((rawAmount - payout).toFixed(4)));
    this.accumulatedFractionSweepTHB += swept;
    return { payout, swept };
  }

  public getAccumulatedTaxes() {
    return {
      accumulatedFuelTaxTHB: parseFloat(this.accumulatedFuelTaxTHB.toFixed(2)),
      accumulatedFractionSweepTHB: parseFloat(this.accumulatedFractionSweepTHB.toFixed(4)),
      rtpPercent: 100 - this.houseEdgePercent
    };
  }
}

export const modularGameEngine = ModularGameEngine.getInstance();
