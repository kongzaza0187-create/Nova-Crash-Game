export interface BetSlip {
  userId: string;
  betAmountTHB: number;
  operatorId?: string;
}

export interface GameRoomState {
  totalRealLiabilityTHB: number;
  globalCrashMultiplier: number;
  riskCeilingTHB?: number;
}

export class SkyRushEngine {
  private static instance: SkyRushEngine;
  
  // Platform financial trace pools (simulated)
  public accumulatedFuelTaxTHB: number = 0;
  public accumulatedFractionSweepTHB: number = 0;
  public consecutiveLossesCount: number = 0;
  public userMartingaleMultiplierTracker: number = 0; // tracking user doubling count
  public postHighCrashCounter: number = 0; // continuous re-arming loop counter
  
  // Dynamic Risk Assurance Config & Tracking
  public riskCeilingTHB: number = 100000.00;
  public totalSimulatedWagerTHB: number = 0;
  public totalSimulatedPayoutTHB: number = 0;
  public totalCohortLosers: number = 0;
  public totalCohortWinners: number = 0;

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
   * 3. Probability Outcome Generator (Server Authoritative) with Dynamic Risk Assurance Cushion
   * - Approaching or exceeding risk ceiling triggers periodic 1.02x - 1.05x explosions.
   * - Maintains ~59% losers vs ~41% winners macro balance to guarantee house profit supremacy.
   */
  public generateSecureGlobalOutcome(
    roomState: GameRoomState,
    targetMarginBreached: boolean,
    isMartingaleAbuse: boolean,
    activeEntitiesCount: number
  ): { multiplier: number; mode: "NORMAL" | "RECOVERY" | "MARTINGALE_OVERRIDE" | "RISK_CUSHION_EXPLOSION" } {
    
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

    // STEP 2.2 (Dynamic Risk Assurance Cushion Protocol):
    // If active liability approaches (>=70%) or exceeds risk ceiling (default 100,000 THB),
    // trigger periodic explosions in the [1.02x - 1.05x] range with elevated probability (65-75%),
    // allowing 25-35% natural breathing rounds so it feels organic and seamless.
    const ceiling = roomState.riskCeilingTHB || this.riskCeilingTHB;
    const liabilityRatio = ceiling > 0 ? (roomState.totalRealLiabilityTHB / ceiling) : 0;
    const isRiskCeilingBreached = targetMarginBreached || liabilityRatio >= 1.0;
    const isRiskCeilingNear = liabilityRatio >= 0.70;

    if (isRiskCeilingBreached || isRiskCeilingNear) {
      const explosionTriggerChance = isRiskCeilingBreached ? 0.75 : 0.60;
      if (Math.random() < explosionTriggerChance) {
        // Precise Risk Cushion Explosion [1.02x - 1.05x]
        const mult = parseFloat((Math.floor((1.02 + (Math.random() * 0.03)) * 100) / 100).toFixed(2));
        return {
          multiplier: mult,
          mode: "RISK_CUSHION_EXPLOSION"
        };
      }
    }

    // STEP 2.3 (Organic Allocation & Infinite Re-Arming Protocol): Execute 4-Stage Piecewise Partition Model (63% RTP / 37% House Edge)
    let X_raw = 1.00;

    if (this.postHighCrashCounter > 0) {
      // STATE B: Forced Execution Mode (lock strictly within Bracket 1 [1.00x - 1.40x] for house recovery)
      const R_early = Math.random();
      X_raw = 1.00 + R_early * (1.40 - 1.00);
      
      // Decrement the counter after this cycle
      this.postHighCrashCounter--;
    } else {
      // STATE A: Standard Monitoring Mode calibrated for 63% RTP / 37% House Edge
      // Macro balancing: ~59% losers vs ~41% winners across player cohorts
      const R = Math.random(); // single, secure global random variable R strictly within [0.0, 1.0)

      if (R >= 0.0000 && R < 0.3700) {
        // STAGE 1: House Edge Front Bracket (37.0% frequency, uniform 1.01x to 1.35x)
        X_raw = 1.01 + (R / 0.3700) * (1.35 - 1.01);
      } 
      else if (R >= 0.3700 && R < 0.7500) {
        // STAGE 2: Intermediate Breathing Bracket A (38.0% frequency, smooth 1.36x to 2.40x)
        const R_normalized = (R - 0.3700) / (0.7500 - 0.3700);
        X_raw = 1.36 + (Math.pow(R_normalized, 1.1) * (2.40 - 1.36));
      } 
      else if (R >= 0.7500 && R < 0.9300) {
        // STAGE 3: Intermediate Breathing Bracket B (18.0% frequency, non-linear 2.41x to 4.50x)
        const R_normalized = (R - 0.7500) / (0.9300 - 0.7500);
        X_raw = 2.41 + (Math.pow(R_normalized, 1.3) * (4.50 - 2.41));
      } 
      else {
        // STAGE 4: High Excitement & Jackpot Trigger (7.0% frequency, R >= 0.9300)
        const R_normalized = (R - 0.9300) / (1.0000 - 0.9300);
        if (activeEntitiesCount >= 20) {
          // Hardlock to high multiplier up to 50.00x
          X_raw = 50.00;
        } else {
          // Organic high payout [4.51x - 9.50x]
          X_raw = 4.51 + (Math.pow(R_normalized, 1.6) * (9.50 - 4.51));
        }
      }
    }

    // Double-Precision Truncation (Satang Floor Mechanism equivalent on outcomes)
    const multiplier = parseFloat((Math.floor(X_raw * 100) / 100).toFixed(2));

    // Continuous Monitoring check in STATE A: If multiplier > 5.50x, immediately transition the server state to STATE B (counter = 3)
    if (multiplier > 5.50 && this.postHighCrashCounter === 0) {
      this.postHighCrashCounter = 3;
    }

    return {
      multiplier,
      mode: "NORMAL"
    };
  }
}
