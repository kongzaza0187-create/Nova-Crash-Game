export interface BetSlip {
  userId: string;
  betAmountTHB: number;
}

export interface GameRoomState {
  totalRealLiabilityTHB: number;
  globalCrashMultiplier: number;
}

export class SkyRushEngine {
  private static instance: SkyRushEngine;
  
  // Platform financial trace pools (simulated)
  public accumulatedFuelTaxTHB: number = 0;
  public accumulatedFractionSweepTHB: number = 0;
  public consecutiveLossesCount: number = 0;
  public userMartingaleMultiplierTracker: number = 0; // tracking user doubling count
  public postHighCrashCounter: number = 0; // continuous re-arming loop counter

  public static getInstance(): SkyRushEngine {
    if (!SkyRushEngine.instance) {
      SkyRushEngine.instance = new SkyRushEngine();
    }
    return SkyRushEngine.instance;
  }

  /**
   * 1. 3.5% flat commission fee for all bet amounts from 30 THB to 1,000,000 THB.
   */
  public processAsymmetricTax(bet: BetSlip): number {
    const taxRate = 0.035; // Flat 3.5% commission fee
    const fuelTaxAmount = bet.betAmountTHB * taxRate;
    const roundedTax = Math.floor(fuelTaxAmount * 100) / 100; // Truncate fractional sub-Satang
    
    this.accumulatedFuelTaxTHB += roundedTax;
    return roundedTax;
  }

  /**
   * 2. Double-Precision Floating-Point Truncation (Satang Floor Mechanism)
   * Gross payouts are floored directly to 2 decimal places. 
   * Residual fractions are swept to platform reserves.
   */
  public truncatePayoutAndSweep(grossPayout: number): { payout: number; swept: number } {
    const netPayout = Math.floor(grossPayout * 100) / 100;
    const sweptFraction = Math.max(0, grossPayout - netPayout);
    
    this.accumulatedFractionSweepTHB += sweptFraction;
    
    return {
      payout: netPayout,
      swept: sweptFraction
    };
  }

  /**
   * 3. Probability Outcome Generator (Server Authoritative)
   * Overhauled with a 4-Stage Piecewise Partition Model and a strict sequence of priority overrides.
   */
  public generateSecureGlobalOutcome(
    roomState: GameRoomState,
    targetMarginBreached: boolean,
    isMartingaleAbuse: boolean,
    activeEntitiesCount: number
  ): { multiplier: number; mode: "NORMAL" | "RECOVERY" | "MARTINGALE_OVERRIDE" } {
    
    // STEP 2.1 (Anti-Martingale Check): Flag user attempting progressive doubling after losses.
    if (isMartingaleAbuse) {
      const penaltyRoll = Math.random();
      // Tight clamp between [1.00x - 1.02x]
      const multiplier = parseFloat((Math.floor((1.00 + (penaltyRoll * 0.02)) * 100) / 100).toFixed(2));
      return {
        multiplier,
        mode: "MARTINGALE_OVERRIDE"
      };
    }

    // STEP 2.2 (Total Liability Monitor & Manual Switch): Recovery sequence settling between [1.00x - 1.05x]
    if (targetMarginBreached || roomState.totalRealLiabilityTHB > 50000) {
      const recoveryRoll = Math.random();
      const multiplier = parseFloat((Math.floor((1.00 + (recoveryRoll * 0.05)) * 100) / 100).toFixed(2));
      return {
        multiplier,
        mode: "RECOVERY"
      };
    }

    // STEP 2.3 (Organic Allocation & Infinite Re-Arming Protocol): Execute 4-Stage Piecewise Partition Model or Post-High Crash override
    let X_raw = 1.00;

    if (this.postHighCrashCounter > 0) {
      // STATE B: Forced Execution Mode (lock strictly within Bracket 1 [1.00x - 2.00x])
      const R_early = Math.random();
      X_raw = 1.00 + R_early * (2.00 - 1.00);
      
      // Decrement the counter after this cycle
      this.postHighCrashCounter--;
    } else {
      // STATE A: Standard Monitoring Mode
      const R = Math.random(); // single, secure global random variable R strictly within [0.0, 1.0)

      if (R >= 0.0000 && R < 0.6750) {
        // STAGE 1: Early House Margin Bracket (67.5% frequency, uniform 1.00x to 2.00x)
        X_raw = 1.00 + (R / 0.6750) * (2.00 - 1.00);
      } 
      else if (R >= 0.6750 && R < 0.8550) {
        // STAGE 2: Intermediate Breathing Bracket A (18.0% frequency, non-linear 2.00x to 5.50x)
        const R_normalized = (R - 0.6750) / (0.8550 - 0.6750);
        X_raw = 2.00 + (Math.pow(R_normalized, 1.2) * (5.50 - 2.00));
      } 
      else if (R >= 0.8550 && R < 0.9950) {
        // STAGE 3: Intermediate Breathing Bracket B (14.0% frequency, skewed non-linear 5.50x to 10.00x)
        const R_normalized = (R - 0.8550) / (0.9950 - 0.8550);
        X_raw = 5.50 + (Math.pow(R_normalized, 1.5) * (10.00 - 5.50));
      } 
      else {
        // STAGE 4: Hard-Capped Bot Jackpot Trigger (0.50% frequency, R >= 0.9950)
        if (activeEntitiesCount >= 20) {
          // Hardlock to exactly 50.00x
          X_raw = 50.00;
        } else {
          // Fallback Safeguard Protocol: abort Stage 4 and re-route directly into Stage 1 with recalculated uniform [1.00x, 2.00x]
          X_raw = 1.00 + (Math.random() * (2.00 - 1.00));
        }
      }
    }

    // Double-Precision Truncation (Satang Floor Mechanism equivalent on outcomes)
    const multiplier = parseFloat((Math.floor(X_raw * 100) / 100).toFixed(2));

    // Continuous Monitoring check in STATE A: If multiplier > 5.50x, immediately transition the server state to STATE B (counter = 3)
    // Note that if we were in STATE B, the counter was already decremented and cannot trigger a new post-high loop during dampening.
    if (multiplier > 5.50 && this.postHighCrashCounter === 0) {
      this.postHighCrashCounter = 3;
    }

    return {
      multiplier,
      mode: "NORMAL"
    };
  }
}
