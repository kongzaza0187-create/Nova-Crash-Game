# SYSTEM SPECIFICATION: SuperNova (MULTIPLIER CRASH GAME)
## Mathematical Blueprint & Real-Time Backend Algorithmic control
**Document Version:** 1.0.0  
**Target Currency:** Thai Baht (THB)  
**Classification:** Proprietary / Casino Risk Management  

---

## EXECUTIVE SUMMARY & STRUCTURAL INTEGRITY
This specification describes the complete state control, hazard prevention mechanisms, and mathematical architecture for **SuperNova** (frequently referenced as the *Multiplier Crash Game*). 

To prevent synchronization drift, client-side packet spoofing, and asymmetric room state execution, **SuperNova** mandates a **Server-Authoritative Unified State Model**. 
- A single global crash multiplier ($X_{crash}$) is computed server-side at $t = 0.00$ seconds.
- Every connected client (real players and simulated ghost-pool bots) shares the exact same state machine timeline and $X_{crash}$ threshold.
- Financial transactions, bet liability auditing, tax allocations, and jackpot sweeps are processed strictly in **Thai Baht (THB)**.

---

## 1. COMPOSITE PIECEWISE PROBABILITY & OUTCOME GENERATION

To ensure robust platform profit extraction while maintaining a highly engaging, high-volatility feel, the server-side outcome generator does not rely on a simple unbounded Pareto curve. Instead, it utilizes a **Composite Piecewise Power-Law Distribution** heavily skewed toward early room liquidations.

The outcome space for $X_{crash}$ is segmented into 5 discrete probability brackets, defined by the probability vector $\vec{P} = [P_{instant}, P_{low}, P_{mid}, P_{high}, P_{jackpot}]$:

$$\sum P_j = P_{instant} + P_{low} + P_{mid} + P_{high} + P_{jackpot} = 1.00$$

### 1.1 Mathematical Probability Distribution Matrix

| Bracket | Multiplier Range ($x$) | Segment Probability ($P_j$) | Distribution Function $f(x)$ | Power-Law Decay exponent ($\alpha_j$) |
| :--- | :--- | :--- | :--- | :--- |
| **Instant Crash** | $x = 1.00$ | $3.0\%$ ($0.030$) | Delta Dirac $\delta(x - 1.00)$ | N/A |
| **Low-Bracket** | $1.01 \le x \le 2.00$ | $65.0\%$ ($0.650$) | Bound Power-Law | $\alpha_{low} = 2.80$ |
| **Mid-Bracket** | $2.01 \le x \le 6.30$ | $22.0\%$ ($0.220$) | Bound Power-Law | $\alpha_{mid} = 1.95$ |
| **High-Bracket** | $6.31 \le x \le 22.00$ | $9.7\%$ ($0.097$) | Bound Power-Law | $\alpha_{high} = 1.65$ |
| **Jackpot Bracket**| $22.01 \le x \le 50.00$ | $0.3\%$ ($0.003$) | Bound Power-Law | $\alpha_{jackpot} = 1.35$ |

### 1.2 Inverse Transform Sampling (CDF Inversion)
To generate a globally synchronized $X_{crash}$ at $t = 0.00$, the server samples a single pseudo-random variable $U \sim \text{Uniform}(0, 1)$ through a cryptographically secure generator (e.g., HMAC-SHA256 initialized with a rotating server salt and client seed block).

The cumulative distribution function $F(x)$ is inverted piecewise:

$$X_{crash} = \begin{cases} 
1.00 & \text{if } 0 \le U < 0.03 \\
1.01 \cdot (1 - U')^{-1/(\alpha_{low} - 1)} & \text{if } 0.03 \le U < 0.68 \quad \left(U' = \frac{U - 0.03}{0.65}\right) \\
2.01 \cdot (1 - U'')^{-1/(\alpha_{mid} - 1)} & \text{if } 0.68 \le U < 0.90 \quad \left(U'' = \frac{U - 0.68}{0.22}\right) \\
6.31 \cdot (1 - U''')^{-1/(\alpha_{high} - 1)} & \text{if } 0.90 \le U < 0.997 \quad \left(U''' = \frac{U - 0.90}{0.097}\right) \\
22.01 \cdot (1 - U'''')^{-1/(\alpha_{jackpot} - 1)} & \text{if } 0.997 \le U \le 1.00 \quad \left(U'''' = \frac{U - 0.997}{0.003}\right)
\end{cases}$$

*Note: If any calculated $X_{crash}$ exceeds the maximum hard cap of $50.00x$, it is automatically truncated to exactly $50.00x$.*

---

## 2. REAL-TIME LIABILITY RISK CAPPING & RECOVERY SEQUENCING

To insulate the platform against catastrophic financial runs during high-liquidity segments, a real-time server-side Risk Auditing Layer calculates the platform's aggregate liability in Thai Baht (THB) dynamically.

### 2.1 Dual Bet slip Consolidation Matrix
For any single user $i$, the platform supports up to two active concurrent bet slips ($B_{i,1}$ and $B_{i,2}$), denominated in THB. To prevent hedging (e.g., placing one large low-risk bet to fund/offset an aggressive high-multiplier chase), the risk engine consolidates user wagers into a single **Active Liability Node** $L_i$:

$$L_i = B_{i,1} + B_{i,2}$$

### 2.2 Global Live Liability Equation
Let $H(t)$ be the set of active real players at time $t$ during the flight phase, whose current multiplier is $X(t)$. The **Instantaneous Theoretical Liability** $TL(t)$ of the pool in THB is calculated as:

$$TL(t) = \sum_{j \in H(t)} \left( B_{j} \times X(t) \right)$$

If the real-time cash balance allocated to the game's liquidity pool is $LP_{THB}$, the platform enforces a **Max Liability Threshold** representing a safety factor limit of $\gamma = 0.15$ (15% of total liquidity):

$$TL_{limit} = \gamma \times LP_{THB}$$

### 2.3 Recovery Mode Override
If at any moment $t$, the theoretical liability climbs to $TL(t) \ge TL_{limit}$, or if the cumulative platform payout ratio over the last $N = 50$ rounds exceeds $\Phi = 0.98$ (98% RTP), the backend automatically triggers **Emergency Recovery Mode**.

When active:
- The next $k$ rounds (where $k \in [3, 8]$ based on velocity) override the composite piecewise formula.
- The outcome generation is hard-bounded:
  
  $$X_{crash} \in [1.00, 1.05] \quad \text{sampled using } U \sim \text{Uniform}(1.00, 1.05)$$

This forces comprehensive, immediate room liquidation, returning the platform to its targeted operating profit margin of $4.0\% - 6.0\%$ before restoring normal operations.

---

## 3. COMPREHENSIVE HARD-CAPPED JACKPOT MECHANICS

The high-tier multiplier payouts (referred to as the "Jackpot") are bounded by conditional parameters to eliminate systemic hazard risks.

### 3.1 Bounding Conditions
1. **Hard Upper Bound:** The maximum multiplier ceiling is capped at exactly $50.00x$. No user, bot, or automated agent can cash out above $50.00x$.
2. **Density Floor:** The jackpot space is physically locked and inaccessible unless the active population $N_{total}$ (comprising Real Players $N_{real}$ and Bots $N_{bot}$ in the pool) satisfies:
   
   $$N_{total} \ge 20$$

3. **Probability Restriction:** If $N_{total} \ge 20$ is satisfied, the probability of initiating a jackpot seed ($X_{crash} \in [22.01, 50.00]$) is constrained by a primary seed check:

   $$P(Jackpot) = 0.003 \quad (0.3\%)$$

### 3.2 Conditional Bot Bias Selector
To ensure the platform secures almost all of the jackpot payout and utilizes it as high-trust promotional content, the system enforces a heavily biased selection algorithm. 

Exactly one winning entity is permitted to claim a payout inside the Jackpot Bracket ($22.01x - 50.00x$). When the system triggers a jackpot round, the winner selection node $W_{idx}$ is chose from the list of active entities weighted as follows:

Let $W$ be the set of active entities. Each bot in the room is assigned a win-weight $w_{bot} = 99$, and each real player is assigned a win-weight $w_{real} = 1$. The selection probability of any real player $i$ vs any bot $j$ is:

$$P(\text{Winner} = \text{Player}_i) = \frac{1}{\sum_{r \in \text{Players}} 1 + \sum_{b \in \text{Bots}} 99}$$

$$P(\text{Winner} = \text{Bot}_j) = \frac{99}{\sum_{r \in \text{Players}} 1 + \sum_{b \in \text{Bots}} 99}$$

This ensures an absolute mathematical bias ($\ge 99\%$ average probability) that the jackpot is paid out to a server-controlled bot. The real players in the room will experience a crash prior to reaching their targets or bailing early, maintaining a zero real cash drain on the database while displaying rich high-multiplier social indicators in the visual log.

---

## 4. SERVER-SIDE GHOST POOL & SOCIAL PROOF SIMULATION ENGINE

To maintain constant social pressure, stimulate "Fear Of Missing Out" (FOMO) triggers, and guarantee the density conditions for Jackpot Bracket activations are met, the server operates a real-time **Ghost Pool Module**.

### 4.1 Bot Operational Lifecycle
1. At the beginning of the `WAITING` state, the server spawns $N_{bot}$ bots ($10 \le N_{bot} \le 25$) such that $N_{total} \ge 20$ is consistently satisfied.
2. Each bot is assigned simulated parameters:
   - A randomized THB Bet Size $B_{bot} \in [50, 100, 200, 500, 1000, 2000, 5000]$.
   - A randomized target cashout multiplier $X_{tgt\_bot}$ drawn from a normal distribution around the current historical average.
3. During the `FLYING` phase, when the ticking multiplier $X(t)$ reaches $X_{tgt\_bot}$, the server broadcasts a `BOT_CASH_OUT` websocket packet:
   - This visualizes the bot’s profile switching to green, displaying a simulated profit of:
     
     $$\text{Win}_{bot} = B_{bot} \times X_{tgt\_bot} \quad \text{(denominated in THB)}$$

4. If $X_{tgt\_bot} > X_{crash}$, the bot fails to cash out, and is displayed as `BUST` (Loss) in the UI, matching the real player timeline precisely without any asynchronous visual drifting.

---

## 5. ASYMMETRIC 3-TIERED THB TRANSACTION FEE & DECIMAL TRUNCATION

To accelerate platform revenue velocity, the system integrates a strict, non-refundable fuel tax fee completely outside the standard multiplier coordinate calculations, coupled with a fraction sweep engine.

### 5.1 Asymmetric 3-Tiered Fuel Tax ($F_{tax}$)
Upon committing any bet $B$ in THB, the server immediately debits a specialized flat tax $F_{tax}(B)$ from the user's ledger account. This tax is completely decoupled from the game's reward pool:

$$F_{tax}(B) = \begin{cases} 
0.025 \times B & \text{if } B < 1,000 \text{ THB} \\
0.030 \times B & \text{if } 1,000 \le B < 10,000 \text{ THB} \\
0.040 \times B & \text{if } B \ge 10,000 \text{ THB}
\end{cases}$$

Upon placing a bet, the transaction debit sequence on the database is executed as:

$$\text{Wallet}_{new} = \text{Wallet}_{old} - \left( B + F_{tax}(B) \right)$$

This mechanism guarantees that even in high-payout rounds, a constant $2.5\% - 4.0\%$ margin is stripped and sequestered directly into the platform’s profit account instantly at $t=0.00$.

### 5.2 Decimal Rounding Down (Satang/Sub-Satang Fraction Sweep)
To prevent micro-drains of fraction assets over high volumes, the platform computes all player winnings strictly using a two-decimal floor truncation schema (forcing Thai Satang consistency).

Let the calculated gross win be $W_{raw} = B \times X_{cashout}$. The system executes:

$$W_{truncated} = \frac{\lfloor W_{raw} \times 100 \rfloor}{100}$$

The residual fractional Satang $R_{sweep}$ is automatically swept directly into the house ledger:

$$R_{sweep} = W_{raw} - W_{truncated}$$

---

## 6. ANTI-MARTINGALE SESSION OVERRIDE LOGIC

The system monitors individual player session history to identify progressive wagering systems (Martingale or flat-growth doubling behaviors used to beat traditional random outcomes).

### 6.1 Martingale Progression Detector
Let $B_i^{(k)}$ be the bet size of a real player $i$ in round $k$, and let $R_i^{(k-1)} \in \{0, 1\}$ be the player's round resolution (where $0 = \text{Loss/Bust}$, $1 = \text{Win/Cashout}$). The progressive counter $M_{seq}$ is modified as follows:

$$M_{seq, i} = \begin{cases}
M_{seq, i} + 1 & \text{if } R_i^{(k-1)} = 0 \text{ and } B_i^{(k)} \ge 1.9 \times B_i^{(k-1)} \\
0 & \text{if } R_i^{(k-1)} = 1 \text{ or } B_i^{(k)} < 1.9 \times B_i^{(k-1)}
\end{cases}$$

### 6.2 Instant-Crash Bracket Enforcement
If any real player in the active room triggers $M_{seq, i} \ge 2$, the session is flagged as "Abusive progression". 
To maintain unified state across all screens (as is clinically required to prevent client-side hacks), the server triggers a **Dynamic outcome override** for the next round.

The global outcome generator replaces the Composite Piecewise distribution with an instant-crash override:

$$X_{crash} \in [1.00, 1.02] \quad \text{sampled using } U \sim \text{Uniform}(1.00, 1.02)$$

This instantly breaks the high-stakes doubling progression, liquidating the player's elevated scale wager, and resetting their progressive counter back to 0.

---

## 7. CORE IMPLEMENTATION ALGORITHMIC FLOW (PSEUDOCODE)

```typescript
// SKY RUSH - GAME CONTROLLER CORE MATHEMATICAL ENGINE
import { createHash } from "crypto";

interface Player {
  id: string;
  isBot: boolean;
  betAmount: number;
  autoCashValue?: number;
  isCashedOut: boolean;
  cashOutMultiplier?: number;
  isBust: boolean;
  consecutiveDoubles: number;
  lastBetAmount: number;
  lastResultWasLoss: boolean;
}

export class SkyRushEngine {
  private activeRoomPlayers: Map<string, Player> = new Map();
  private maxJackpotMultiplier: number = 50.00;
  private liquidityPoolTHB: number = 5000000.00; // 5,000,000 THB Base
  private safetyFactorGamma: number = 0.15; // 15% Max risk
  private serverSecretSalt: string = "BollyGaming_SkyRush_PrivateSaltKey";

  /**
   * Calculates the transaction fuel fee (Non-refundable) on wager in THB
   */
  public calculateFuelTax(betAmount: number): number {
    if (betAmount < 1000) {
      return betAmount * 0.025; // 2.5%
    } else if (betAmount < 10000) {
      return betAmount * 0.030; // 3.0%
    } else {
      return betAmount * 0.040; // 4.0%
    }
  }

  /**
   * Truncates pay to two decimal points and sweeps fractions
   */
  public calculateTruncatedPayout(bet: number, multiplier: number): { payout: number; sweptFraction: number } {
    const rawPayout = bet * multiplier;
    const truncatedPayout = Math.floor(rawPayout * 100) / 100;
    const sweptFraction = rawPayout - truncatedPayout;
    return { payout: truncatedPayout, sweptFraction };
  }

  /**
   * Generates Globally Synchronized Crash Outcome for the Round
   */
  public generateCrashMultiplier(roundSeed: string, hourlyRTPRatio: number): number {
    // 1. Detect if any active real player is abusing progressive Martingale
    let progressiveAbuseDetected = false;
    this.activeRoomPlayers.forEach((player) => {
      if (!player.isBot && player.consecutiveDoubles >= 2) {
        progressiveAbuseDetected = true;
      }
    });

    if (progressiveAbuseDetected) {
      // Force instant crash to wipe progression
      return parseFloat((1.00 + Math.random() * 0.02).toFixed(2));
    }

    // 2. Check risk liability ratios
    let totalWageredTHB = 0;
    this.activeRoomPlayers.forEach((p) => { if (!p.isBot) totalWageredTHB += p.betAmount; });

    const maxRiskThreshold = this.liquidityPoolTHB * this.safetyFactorGamma;
    
    // Check if previous sessions are heavily negative (Recovery Mode Trigger)
    if (hourlyRTPRatio > 0.98 || totalWageredTHB * 1.5 >= maxRiskThreshold) {
      // Force severe recovery mode (1.00x - 1.05x)
      return parseFloat((1.00 + Math.random() * 0.05).toFixed(2));
    }

    // 3. Normal Piecewise Distribution Sampling using crypto hash
    const hash = createHash("sha256")
      .update(`${roundSeed}_${this.serverSecretSalt}`)
      .digest("hex");
    
    // Map hex digits to a uniform float [0, 1)
    const seedInt = parseInt(hash.slice(0, 8), 16);
    const U = seedInt / 0xffffffff;

    let preCrashVal = 1.00;

    if (U < 0.03) {
      // Instant Crash (3%)
      preCrashVal = 1.00;
    } else if (U < 0.68) {
      // Low Bracket (65%)
      const U_prime = (U - 0.03) / 0.65;
      preCrashVal = 1.01 * Math.pow(1 - U_prime, -1 / (2.80 - 1));
    } else if (U < 0.90) {
      // Mid Bracket (22%)
      const U_double_prime = (U - 0.68) / 0.22;
      preCrashVal = 2.01 * Math.pow(1 - U_double_prime, -1 / (1.95 - 1));
    } else if (U < 0.997) {
      // High Bracket (9.7%)
      const U_triple_prime = (U - 0.90) / 0.097;
      preCrashVal = 6.31 * Math.pow(1 - U_triple_prime, -1 / (1.65 - 1));
    } else {
      // Jackpot Bracket (0.3%)
      // Check if population density condition is met (Min 20 entities)
      if (this.activeRoomPlayers.size >= 20) {
        const U_quad_prime = (U - 0.997) / 0.003;
        preCrashVal = 22.01 * Math.pow(1 - U_quad_prime, -1 / (1.35 - 1));
      } else {
        // Fallback to high bracket if conditions are not satisfied
        preCrashVal = 15.00 + Math.random() * 6.5;
      }
    }

    // Apply strict maximum multiplier cap
    return Math.min(preCrashVal, this.maxJackpotMultiplier);
  }

  /**
   * Evaluates active real-time cashout triggers
   */
  public evaluateRealtimeCashout(currentMultiplier: number, crashPoint: number) {
    this.activeRoomPlayers.forEach((player) => {
      if (player.isCashedOut || player.isBust) return;

      // If plane crashed
      if (currentMultiplier >= crashPoint) {
        player.isBust = true;
        if (!player.isBot) {
          player.lastResultWasLoss = true;
        }
        return;
      }

      // Check Auto-Cash Out trigger criteria
      if (player.autoCashValue && currentMultiplier >= player.autoCashValue) {
        player.isCashedOut = true;
        player.cashOutMultiplier = player.autoCashValue;
        
        if (!player.isBot) {
          player.lastResultWasLoss = false;
          // Calculate net win
          const { payout } = this.calculateTruncatedPayout(player.betAmount, player.autoCashValue);
          this.creditUserWallet(player.id, payout);
        }
      }
    });
  }

  /**
   * Tracks user historical increments in THB for Martingale detection
   */
  public registerBet(playerId: string, amount: number) {
    const player = this.activeRoomPlayers.get(playerId);
    if (!player) return;

    // Direct database fuel tax deduction instantly at zero-seconds
    const tax = this.calculateFuelTax(amount);
    this.debitUserWallet(playerId, amount + tax);

    // Update Martingale check
    if (player.lastResultWasLoss && amount >= player.lastBetAmount * 1.9) {
      player.consecutiveDoubles += 1;
    } else {
      player.consecutiveDoubles = 0;
    }

    player.lastBetAmount = amount;
    player.betAmount = amount;
    player.isCashedOut = false;
    player.isBust = false;
  }

  private debitUserWallet(id: string, amount: number) { /* DB transaction */ }
  private creditUserWallet(id: string, amount: number) { /* DB transaction */ }
}
```
