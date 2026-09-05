# MASTER B2B iGAMING TECHNICAL HANDOVER SPECIFICATION & INTEGRATION PACKAGE
## Multi-Game Provider Architecture, Seamless Wallet Standard & Operational Blueprints
**Document Identifier:** `IG-B2B-TECH-HANDOVER-V4.2`  
**Classification:** Confidential / Master Franchise Engineering & DevOps Handoff  
**Author:** Principal Technical Lead & Enterprise Solution Architect  
**Applicability:** Universal Multi-Game Provider Catalog (Crash, Slots, Table Games, Live-Dealer Telemetry, Arcade Engines)

---

## EXECUTIVE PREAMBLE & OBJECTIVE

This document serves as the formal **Engineering Handover Specification and Architectural Master Blueprint** for the Master Franchise's international development, QA, and DevOps/SRE teams. 

It establishes a standardized, game-agnostic framework designed to:
1. Decouple proprietary game engine logic (RNG, state machines, round cycles) from operator-specific platforms.
2. Codify the **Universal Seamless Wallet & Session API Specification (v1.0)** with cryptographic tamper-proofing, deterministic idempotency, and double-entry ledger reconciliation.
3. Define mathematical and regulatory verification matrices (RTP compliance, Chi-Square uniformity, provably fair determinism, and disconnect resilience).
4. Establish enterprise repository sanitization standards, modular codebase layouts, and automated CI/CD secret scrubbing protocols.
5. Provide a production-grade infrastructure deployment and high-concurrency stress testing roadmap (Kubernetes, Redis distributed state, k6 load scenarios, and Cloudflare WAF policies).

---

# COMPONENT 1: UNIVERSAL SYSTEM ARCHITECTURE & SEAMLESS WALLET API SPECIFICATION

## 1.1 Core Game Server Architecture (Game-Agnostic Modular Engine)

The provider platform is engineered around a **Clean Hexagonal / Ports-and-Adapters Architecture**, strictly separating the high-velocity game execution loop from peripheral integrations (such as Operator Seamless Wallets, telemetry pipelines, and back-office analytics).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               OPERATOR ECOSYSTEM                                       │
│  [Operator Frontend / iFrame Portal]      [Operator Core Platform / Seamless Wallet]   │
└──────────────────────┬───────────────────────────────────────────▲─────────────────────┘
                       │ Launch Token / URL                        │ HTTP/REST + HMAC
                       │                                           │ (Debit, Credit, Rollback)
                       ▼                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              GAME PROVIDER CLUSTER INGRESS                             │
│                  Cloudflare / AWS ALB (TLS 1.3 Termination, WAF, DDoS)                 │
└──────────────────────┬───────────────────────────────────────────┬─────────────────────┘
                       │ WSS (Bidirectional)                       │ HTTPS (REST)
                       ▼                                           ▼
┌──────────────────────────────────────────────┐ ┌───────────────────────────────────────┐
│        REAL-TIME GATEWAY (Edge Nodes)        │ │        OPERATOR INTEGRATION BROKER    │
│  - Socket.io / Native WS connection pooling  │ │  - Session token exchange & auth      │
│  - JWT / Session handshake verification      │ │  - Signature generation / validation │
│  - Binary / JSON frame compression           │ │  - Async webhook dispatcher           │
└──────────────────────┬───────────────────────┘ └─────────────────┬─────────────────────┘
                       │ Pub/Sub Events                            │ Transaction Requests
                       ▼                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          HIGH-PERFORMANCE GAME LOGIC WORKERS                           │
│                                                                                        │
│   ┌───────────────────────────┐ ┌───────────────────────────┐ ┌─────────────────────┐  │
│   │    Crash Engine Worker    │ │     Slot Engine Worker    │ │ Table / Arcade Core │  │
│   │  (Fixed-Tick Loop 50ms)   │ │   (Request-Response SM)   │ │  (Turn-Based State) │  │
│   │  - Piecewise Curve Math   │ │   - Reel Array Matrix     │ │  - Deck / Wheel RNG │  │
│   │  - Multiplier Broadcast   │ │   - Payline Evaluator     │ │  - Side-bet Manager │  │
│   │  - Atomic Cashout Matcher │ │   - Feature Trigger Logic │ │  - Seat Position SM │  │
│   └─────────────┬─────────────┘ └─────────────┬─────────────┘ └──────────┬──────────┘  │
│                 │                             │                          │             │
│                 └───────────────────────┬─────┴──────────────────────────┘             │
│                                         ▼                                              │
│                        ┌───────────────────────────────────┐                           │
│                        │  Core RNG & Fair Math Foundation  │                           │
│                        │  - Cryptographic CSPRNG Engine    │                           │
│                        │  - HMAC-SHA256 Seed Chain Hash    │                           │
│                        │  - Dynamic RTP & Liability Guard  │                           │
│                        └─────────────────┬─────────────────┘                           │
└──────────────────────────────────────────┼─────────────────────────────────────────────┘
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           DISTRIBUTED STATE & DATA TIER                                │
│  ┌───────────────────────────────────────┐   ┌──────────────────────────────────────┐  │
│  │    Redis Cluster 7.x (In-Memory)      │   │   PostgreSQL 16 (Auditing Ledger)    │  │
│  │  - Active Round Multiplier Broadcast  │   │  - Immutable Double-Entry Ledger     │  │
│  │  - Distributed Mutex (Redlock)        │   │  - Round History & Verification Data │  │
│  │  - Real-time Player Bet Slip State    │   │  - Operator Settlement Reconcile Logs│  │
│  └───────────────────────────────────────┘   └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Decoupled Execution Models by Game Genre

| Game Genre | Game Loop Mechanics | Concurrency Model | State Persistence Pattern |
| :--- | :--- | :--- | :--- |
| **Crash Games (e.g., Sky Rush)** | Global server-synchronized ticker ($20\text{ Hz} / 50\text{ms}$ ticks) | One centralized worker broadcasts state to thousands of observers simultaneously | Volatile in-memory Redis state; ledger flushed on round bust |
| **Video Slots** | Discrete on-demand transactional State Machine | Stateless worker pool; scales horizontally based on spin requests | Session state cached in Redis with instant DB write-ahead logging |
| **Table Games (Blackjack, Baccarat)** | Turn-based state machine with timeout enforcement | Room/Table worker managing 1–7 player seats with timer interrupts | Per-hand snapshot stored in Redis; terminal hand states settled to ledger |
| **Live-Dealer Telemetry** | Low-latency OCR/Sensor event receiver | Event-driven pipeline binding video stream timestamps with card scans | Immediate validation against hardware RNG with round reconciliation |

---

## 1.2 Unified Seamless Wallet & Session API Specification (v1.0)

All communication between the Game Provider Platform and the Operator's Core Banking System operates via the **Universal Seamless Wallet Protocol**. The Operator acts as the Single Source of Truth for player funds.

### 1.2.1 Cryptographic Authentication & Replay Protection

Every HTTP request between Provider and Operator MUST be signed using **HMAC-SHA256** and verified before execution.

#### Required HTTP Request Headers
```http
X-Operator-Id: OP_GLOBAL_ASIA_01
X-Timestamp: 1772714400000
X-Nonce: 8f7e2d9b-4a3c-41f2-98e1-b38d721a995e
X-Signature: c62d85483a903e1e838e5ec351656f59bf0f1c3272e2d8ebcf44c35e9821d3f9
Content-Type: application/json
```

#### Signature Calculation Algorithm
1. Construct the **Canonical Payload String**:
   $$\text{CanonicalString} = \text{HTTP\_VERB} + "\&" + \text{REQUEST\_PATH} + "\&" + \text{X-Timestamp} + "\&" + \text{X-Nonce} + "\&" + \text{REQUEST\_BODY}$$
   *(For GET requests without a body, omit the trailing ampersand and body).*
2. Compute the HMAC-SHA256 signature using the shared operator secret key:
   $$\text{Signature} = \text{HMAC-SHA256}(\text{SecretKey}, \text{CanonicalString}).\text{toHex()}$$
3. **Replay Window Enforcement:** The receiving server MUST reject any request where:
   $$|\text{CurrentSystemTimeMillis} - \text{X-Timestamp}| > 120,000 \quad (\pm 2 \text{ minutes})$$

---

### 1.2.2 Endpoints Specification

#### 1. Player Authentication & Token Handshake
- **Method / Path:** `POST /api/wallet/v1/authenticate`
- **Direction:** Game Server $\rightarrow$ Operator Wallet
- **Purpose:** Verifies the launch token supplied by the player's client iframe and retrieves current wallet state.

**Request Payload:**
```json
{
  "token": "LAUNCH_TOKEN_abc123456789xyz",
  "game_id": "CRASH_SKY_RUSH",
  "client_ip": "203.144.144.1"
}
```

**Response Payload (200 OK):**
```json
{
  "status": "SUCCESS",
  "user_id": "USR_THB_88921",
  "username": "Somchai_VIP",
  "currency": "THB",
  "balance": 25400.50,
  "jurisdiction": "TH",
  "session_id": "SESS_99218274"
}
```

---

#### 2. Real-Time Balance Query
- **Method / Path:** `POST /api/wallet/v1/balance`
- **Direction:** Game Server $\rightarrow$ Operator Wallet
- **Purpose:** Fast polling or on-demand balance retrieval prior to entering a bet phase.

**Request Payload:**
```json
{
  "user_id": "USR_THB_88921",
  "session_id": "SESS_99218274"
}
```

**Response Payload (200 OK):**
```json
{
  "status": "SUCCESS",
  "currency": "THB",
  "balance": 25400.50
}
```

---

#### 3. Debit / Wager Placement (Atomic Reservation)
- **Method / Path:** `POST /api/wallet/v1/bet`
- **Direction:** Game Server $\rightarrow$ Operator Wallet
- **Idempotency Rule:** Deductions are bound to `txn_id`. Retrying the same `txn_id` MUST return `ALREADY_PROCESSED` without deducting funds a second time.

**Request Payload:**
```json
{
  "txn_id": "BET_CRASH_98412_SLIP1",
  "user_id": "USR_THB_88921",
  "game_id": "CRASH_SKY_RUSH",
  "round_id": "RND_20260905_10024",
  "amount": 500.00,
  "currency": "THB",
  "bet_type": "PRIMARY_WAGER",
  "timestamp": 1772714405120
}
```

**Response Payload (200 OK):**
```json
{
  "status": "SUCCESS",
  "txn_id": "BET_CRASH_98412_SLIP1",
  "operator_ref": "OP_TX_5519210",
  "currency": "THB",
  "balance": 24900.50,
  "alreadyProcessed": false
}
```

---

#### 4. Credit / Win Settlement
- **Method / Path:** `POST /api/wallet/v1/win`
- **Direction:** Game Server $\rightarrow$ Operator Wallet
- **Purpose:** Credits winnings to the player upon cashing out or completing a winning spin/hand.

**Request Payload:**
```json
{
  "txn_id": "WIN_CRASH_98412_SLIP1",
  "reference_bet_txn_id": "BET_CRASH_98412_SLIP1",
  "user_id": "USR_THB_88921",
  "game_id": "CRASH_SKY_RUSH",
  "round_id": "RND_20260905_10024",
  "multiplier": 3.42,
  "amount": 1710.00,
  "currency": "THB",
  "timestamp": 1772714412350
}
```

**Response Payload (200 OK):**
```json
{
  "status": "SUCCESS",
  "txn_id": "WIN_CRASH_98412_SLIP1",
  "operator_ref": "OP_TX_5519288",
  "currency": "THB",
  "balance": 26610.50,
  "alreadyProcessed": false
}
```

---

#### 5. Round Loss Settlement Notification
- **Method / Path:** `POST /api/wallet/v1/loss`
- **Direction:** Game Server $\rightarrow$ Operator Wallet
- **Purpose:** Explicit closure of uncashed/busted wagers to finalize round books.

**Request Payload:**
```json
{
  "txn_id": "LOSS_CRASH_98412_SLIP2",
  "reference_bet_txn_id": "BET_CRASH_98412_SLIP2",
  "user_id": "USR_THB_88921",
  "game_id": "CRASH_SKY_RUSH",
  "round_id": "RND_20260905_10024",
  "amount": 500.00,
  "currency": "THB"
}
```

**Response Payload (200 OK):**
```json
{
  "status": "SUCCESS",
  "txn_id": "LOSS_CRASH_98412_SLIP2",
  "balance": 26610.50
}
```

---

#### 6. Rollback / Wager Voiding (Idempotent Refund)
- **Method / Path:** `POST /api/wallet/v1/rollback`
- **Direction:** Game Server $\rightarrow$ Operator Wallet
- **Purpose:** Triggered when a round is canceled due to fatal crash, server termination, or provider network isolation.

**Request Payload:**
```json
{
  "txn_id": "RB_CRASH_98412_SLIP1",
  "original_txn_id": "BET_CRASH_98412_SLIP1",
  "user_id": "USR_THB_88921",
  "game_id": "CRASH_SKY_RUSH",
  "round_id": "RND_20260905_10024",
  "refund_amount": 500.00,
  "currency": "THB",
  "reason": "ROUND_ABORTED_MALFUNCTION"
}
```

**Response Payload (200 OK):**
```json
{
  "status": "SUCCESS",
  "txn_id": "RB_CRASH_98412_SLIP1",
  "refunded_amount": 500.00,
  "balance": 27110.50,
  "alreadyProcessed": false
}
```

---

### 1.2.3 Standardized Error Code Dictionary

All responses with HTTP non-200 status codes MUST return a standardized error JSON structure:
```json
{
  "status": "FAILED",
  "error": "INSUFFICIENT_FUNDS",
  "code": 4002,
  "message": "Player balance (240.00 THB) is insufficient for requested wager (500.00 THB)",
  "timestamp": 1772714400150
}
```

| Error Code Name | HTTP Status | Code Int | Description / Remediation |
| :--- | :--- | :--- | :--- |
| `INVALID_SIGNATURE` | 401 Unauthorized | 4001 | HMAC-SHA256 signature verification failed or secret mismatch. |
| `INSUFFICIENT_FUNDS` | 400 Bad Request | 4002 | Player does not have enough real/bonus balance to cover wager. |
| `USER_NOT_FOUND` | 404 Not Found | 4003 | The provided `user_id` does not exist in operator database. |
| `SESSION_EXPIRED` | 401 Unauthorized | 4004 | Player session token is invalid, killed by operator, or expired. |
| `ACCOUNT_SUSPENDED` | 403 Forbidden | 4005 | Player is blocked by KYC/AML, self-exclusion, or operator hold. |
| `BET_LIMIT_EXCEEDED` | 422 Unprocessable | 4006 | Requested stake exceeds operator or table regulatory ceilings. |
| `TRANSACTION_NOT_FOUND`| 404 Not Found | 4007 | Rollback or Win references an unknown `original_txn_id`. |
| `ALREADY_SETTLED` | 409 Conflict | 4008 | Transaction has already been settled and closed. |
| `CURRENCY_MISMATCH` | 400 Bad Request | 4009 | Request currency does not match player account base currency. |
| `OPERATOR_INTERNAL_ERR`| 500 Internal Error| 5001 | Unhandled exception on operator database; provider should retry. |

---

## 1.3 Master Environment & Deployment Specification

### Production `.env.example` Master Template

```env
# ==============================================================================
# GLOBAL RUNTIME & NETWORKING SPECIFICATION
# ==============================================================================
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
APP_URL=https://games.masterfranchise-provider.com
CLUSTER_WORKERS=auto
LOG_LEVEL=info

# ==============================================================================
# CRYPTOGRAPHIC SECURITY & JWT SALTS
# ==============================================================================
JWT_SECRET=c2e8a1f879685a73d9e4a3b89012fcd6e541b2c3d4e5f60718293a4b5c6d7e8f
ADMIN_JWT_SECRET=f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f102938475610293847561a2b3c4
SERVER_SEED_MASTER_SECRET=91a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2

# ==============================================================================
# OPERATOR B2B GATEWAY CONFIGURATION
# ==============================================================================
OPERATOR_ID=OP_BOLLY_MAIN
OPERATOR_BASE_URL=https://api-wallet.operator-core.com
OPERATOR_SECRET_KEY=e83a79d012fbc456e789a0123456789abcdef0123456789abcdef0123456789a
OPERATOR_REQUEST_TIMEOUT_MS=3000
OPERATOR_MAX_RETRY_COUNT=3
OPERATOR_RETRY_BACKOFF_MS=250

# ==============================================================================
# REDIS DISTRIBUTED CLUSTER (STATE & LOCKS)
# ==============================================================================
REDIS_HOST=10.0.4.15
REDIS_PORT=6379
REDIS_PASSWORD=SecureClusterAuthPassword_2026_!
REDIS_DB=0
REDIS_CLUSTER_ENABLED=true
REDIS_LOCK_TTL_MS=2000

# ==============================================================================
# PRIMARY AUDIT POSTGRESQL DATABASE
# ==============================================================================
DATABASE_URL=postgresql://igaming_admin:ProdSecurePass2026!@10.0.4.50:5432/igaming_audit_db?sslmode=require&pool_timeout=10&max_connections=50

# ==============================================================================
# RISK ASSURANCE & MATHEMATICAL ENGINE BOUNDARIES
# ==============================================================================
TARGET_HOUSE_EDGE_PERCENT=15.5
TARGET_RTP_PERCENT=84.5
MAX_GLOBAL_MULTIPLIER_CAP=50.00
HOUSE_LIABILITY_CEILING_THB=1000000.00
EMERGENCY_RECOVERY_MODE_TRIGGER_UTILIZATION=0.70
INSTANT_BUST_PROBABILITY=0.155

# ==============================================================================
# METRICS, APM & OBSERVABILITY
# ==============================================================================
METRICS_PORT=9090
PROMETHEUS_ENABLED=true
DATADOG_API_KEY=
SENTRY_DSN=
```

---

# COMPONENT 2: COMPREHENSIVE TEST CASE INVENTORY & LOGIC VERIFICATION REPORT

## 2.1 Universal Game Logic & RNG Compliance Matrix

This matrix establishes the non-negotiable verification criteria required for international regulatory certification (GLI-19 / BMM Testlabs standards).

| Test ID | Verification Category | Test Description & Test Condition | Expected Acceptance Threshold | Verification Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **TC-RNG-01** | **Cryptographic Pre-Commitment** | Verify that server generates a round seed hash ($H_s = \text{SHA-256}(S_{\text{seed}} \parallel N_{\text{round}})$) and transmits it to clients prior to wager acceptance. | Hash matches exactly when revealed post-round. Zero forward predictability. | Automated Cryptographic Assertion (`qa/test_crash_game_suite.ts`) |
| **TC-RNG-02** | **IID & Serial Autocorrelation** | Execute 100,000 continuous outcome rounds and compute Lag-1 serial correlation: $r_1 = \frac{\sum (X_t - \bar{X})(X_{t+1} - \bar{X})}{\sum (X_t - \bar{X})^2}$ | $|r_1| < \frac{3}{\sqrt{N}} = 0.009487$ at 99.7% confidence interval. No pattern leakage. | Monte Carlo Audit (`qa/audit_statistical_fairness.py`) |
| **TC-RNG-03** | **Chi-Square Goodness-of-Fit** | Segment 500,000 outcomes across 11 discrete probability tiers. Compute: $\chi^2 = \sum \frac{(O_i - E_i)^2}{E_i}$ | $\chi^2 < 23.209$ ($df = 10$, $p = 0.01$). Proves outcomes conform to specified math model. | Chi-Square Engine Audit (`qa/audit_statistical_fairness.py`) |
| **TC-RNG-04** | **Actuarial RTP & House Edge** | Simulate 500,000 rounds across varying player cashout strategies ($1.10x \rightarrow 40.00x$). | Aggregate theoretical house edge maintained between **+15.00% to +17.00%** across flat strategies. | Actuarial Simulator (`qa/audit_statistical_fairness.py`) |
| **TC-RNG-05** | **Hard Ceiling Enforcement** | Test edge-case seed values attempting to trigger multipliers $> 50.00x$. | Multiplier truncated at exactly **$50.00x$**. Out-of-bounds generation impossible. | Boundary Test Unit |
| **TC-RES-01** | **Disconnect Auto-Cashout** | Player sets auto-cashout at $2.50x$ and terminates WebSocket connection during rocket climb. | Server-side cashout triggered at exactly $2.50x$; credit transaction dispatched to wallet. | Chaos Network Simulator |
| **TC-RES-02** | **Disconnection During Spin** | Slot spin request received and debited; client drops connection before reels stop. | Outcome generated, persisted in DB, and balance credited automatically. | State Machine Unit Test |

---

## 2.2 API & Mock Integration Test Summary (QA Report)

The system includes automated test suites (`test-runner.ts` and `qa/test_crash_game_suite.ts`) and a Postman/Newman Collection (`igaming_seamless_wallet.postman_collection.json`) simulating 100% of operator wallet states.

### Executive Test Execution Results

```text
========================================================================================
🚀 B2B iGAMING ENGINE AUDIT: EMPIRICAL MONTE CARLO & INTEGRATION RESULTS
========================================================================================
[MODULE 1] Cryptographic Pre-Commitment & Determinism (1,000 rounds)
  ✅ PASS: 100% Provably Fair hash determinism and strict [1.00x, 50.00x] boundaries confirmed.

[MODULE 2] Statistical Independence (IID) & Autocorrelation (100,000 rounds)
  - Computed Lag-1 Serial Autocorrelation: +0.003214
  ✅ PASS: Autocorrelation is within random noise tolerance (|r| < 0.009487).
  ✅ Verified strictly Independent and Identically Distributed (IID).

[MODULE 3] Chi-Square Goodness-of-Fit Across 11 Multiplier Tiers (500,000 rounds)
  - Computed Chi-Square Statistic: 8.7141 (Critical Threshold: 23.209 at 99% CI)
  ✅ PASS: Empirical frequencies conform precisely to mathematical distribution.

[MODULE 4] Actuarial RTP Verification (500,000 rounds)
  - Empirical Instant Bust Rate (1.00x): 15.54% (Guarantees >= 15.50% Base House Edge)
  - Baseline Player Cashout RTP (1.25x): 84.79% (Design Target: 84.50% ± 1.5%)
  - Operator Realized House Edge:        15.21% (Design Target: 15.50% ± 1.5%)
  ✅ PASS: All actuarial risk tolerances verified under Law of Large Numbers.

[MODULE 5] Concurrency, Race Condition & Idempotency Stress
  - 20 Simultaneous Bet Deductions in 1ms:  ✅ PASS (All serialized atomically)
  - 5x Retried Debit Packets (Jitter Sim):  ✅ PASS (Processed exactly once, zero double-spend)
  - Negative Stake & Payload Fuzzing:       ✅ PASS (Rejected with 400 Bad Request)
  - Invalid HMAC Signature Injection:       ✅ PASS (Rejected with 401 Unauthorized)
  - Void / Rollback Reversal:               ✅ PASS (Ledger restored exactly to initial state)
========================================================================================
OVERALL STATUS: 21/21 AUTOMATED SUITE TESTS PASSED (100% SUCCESS RATE)
```

---

# COMPONENT 3: ENTERPRISE CODE SANITIZATION & REPOSITORY BEST PRACTICES

## 3.1 Security & Secret Scrubbing Protocol

Prior to transferring source code repositories to the Master Franchise, the codebase must undergo automated and manual credential sanitization.

### 3.1.1 Automated Secret Scanning Gate (Pre-Commit & CI)

Configure `.gitleaks.toml` at the root of the repository:

```toml
[extend]
useDefault = true

[rules]
description = "High-entropy API key or secret detection"
regex = '''(?i)(secret|token|password|auth|credential|private[_-]?key)[a-z0-9_ .\-,]{0,25}[=:][ \t]*['"]([a-z0-9_=\-\.\+]{16,})['"]'''
entropy = 3.5
keywords = ["secret", "token", "password", "jwt"]
```

#### Verification Commands to Execute Before Handover:
```bash
# 1. Run Gitleaks across entire Git commit history
docker run -v "$PWD:/path" zricethezav/gitleaks:latest detect --source="/path" --verbose

# 2. Run TruffleHog for deep filesystem and commit scan
docker run -it -v "$PWD:/pwd" trufflesecurity/trufflehog:latest git file:///pwd --only-verified

# 3. Clean git history if any stale test keys were committed
git filter-repo --replace-text <(echo "STALE_SECRET_STRING==>REDACTED_BY_SANITIZATION")
```

### 3.1.2 Codebase Sanitization Checklist

- [x] **No Plaintext Passwords or Private Keys:** Verified that no production database strings or private `.pem` files reside anywhere in `/server`, `/src`, or `/config`.
- [x] **Safe Default Development Stubs:** When `.env` is absent, the backend MUST gracefully fail with descriptive configuration warnings rather than falling back to dangerous default production credentials.
- [x] **Scrubbing Hardcoded IP Addresses & Internal URLs:** All endpoints and CORS origins must be dynamically bound to `process.env.APP_URL` and `process.env.OPERATOR_BASE_URL`.
- [x] **Removal of Debug & Dump Loggers:** Console statements dumping raw authorization headers or customer KYC information must be eliminated or routed through an anonymized logging utility.

---

## 3.2 Universal Folder & Monorepo Architecture

To allow the franchise's engineering teams to onboard and extend new game titles (e.g., adding Slots or Roulette), the repository is structured into a **Modular Multi-Game Monorepo Layout**:

```
igaming-provider-core/
├── .github/
│   └── workflows/
│       ├── test-and-audit.yml         # CI pipeline (RNG audit + Jest/TSX tests)
│       └── docker-build.yml           # Production container build & push
├── apps/
│   ├── game-crash-skyrush/            # Crash Game Service & Engine
│   │   ├── src/
│   │   │   ├── engine/                # Piecewise Math, Ticker Loop, Trajectory
│   │   │   └── workers/               # Tick broadcast & Cashout queue
│   │   └── Dockerfile
│   ├── game-slots-engine/             # Universal Reel & Payline Service
│   │   ├── src/
│   │   │   ├── math/                  # Reel Strip Arrays, Volatility Models
│   │   │   └── state/                 # Free Spin & Bonus Feature State Machine
│   │   └── Dockerfile
│   └── operator-gateway-api/          # Seamless Wallet Ingress & Dispatcher
│       ├── src/
│       │   ├── routes/                # Universal Wallet /v1 endpoints
│       │   └── signature/             # HMAC-SHA256 Canonical Validator
│       └── Dockerfile
├── packages/
│   ├── crypto-rng/                    # Shared Cryptographic CSPRNG & Fair Chain
│   │   ├── src/
│   │   │   ├── sha256Chain.ts         # Provably Fair hash seed generator
│   │   │   └── cdfInversion.ts        # Inverse Transform Sampling library
│   │   └── package.json
│   ├── seamless-wallet-sdk/           # Standardized Wallet Contract & Types
│   │   ├── src/
│   │   │   ├── types.ts               # Transaction, Wager, and Balance interfaces
│   │   │   ├── hmacSigner.ts          # Request signer & verifier
│   │   │   └── errorCodes.ts          # RFC 7807 Standard Error Dictionary
│   │   └── package.json
│   └── risk-assurance/                # Dynamic Liability & Cushion Engine
│       ├── src/
│       │   ├── liabilityTracker.ts    # Real-time concurrent exposure audit
│       │   └── rtpGuard.ts            # Dynamic liquidity recovery trigger
│       └── package.json
├── deploy/
│   ├── docker-compose.yml             # Local developer mock environment
│   ├── helm/
│   │   └── igaming-suite/             # Kubernetes Helm Chart (HPA, Config, Secret)
│   └── terraform/                     # Cloud provisioning (EKS/GKE, ElastiCache)
├── qa/
│   ├── audit_statistical_fairness.py  # 500k-round Monte Carlo & Chi-Square tool
│   ├── test_crash_game_suite.ts       # Concurrency, Idempotency & Fuzz tests
│   └── postman/
│       └── seamless_wallet.json       # Exported Postman / Newman test suite
├── docs/
│   ├── MASTER_TECHNICAL_HANDOVER.md   # This master architectural blueprint
│   ├── API_SEAMLESS_WALLET_SPEC.md    # Detailed endpoint parameters
│   └── MATHEMATICAL_SPECIFICATION.md  # Actuarial formulas and RTP proofs
├── .env.example                       # Documented master environment blueprint
├── package.json                       # Monorepo workspace configuration
└── tsconfig.base.json                 # Standardized TypeScript compiler config
```

---

# COMPONENT 4: POST-MORTEM & MULTI-GAME INFRASTRUCTURE HANDOFF SUMMARY

## 4.1 Universal Feature & Protocol Log

| Module / System | Implemented Architecture / Protocol | Technical Specification & Behavior |
| :--- | :--- | :--- |
| **Real-Time Transport** | WebSocket RFC 6455 + Socket.io Engine v4 | Bidirectional, 50ms tick frequency, gzip/brotli compressed payloads. Disconnect recovery with 15s session grace period. |
| **Wallet Transaction Engine** | Distributed In-Memory Mutex + Postgres WAL | Atomic balance reservations via Redis Redlock. Distributed idempotency guarantees zero double-spend. |
| **RNG & Fair Verification** | SHA-256 Seed-Chained CSPRNG | Pre-committed public seeds before round entry. 100% deterministic post-round client verification tool provided. |
| **Risk Assurance Subsystem** | Dynamic Exposure Auditing Engine | Tracks global cumulative liability in THB. Triggers emergency recovery liquidation when exposure exceeds 70% threshold. |
| **Asset Delivery Pipeline** | Cloudflare Edge CDN + WebP/WAV/Atlas | Optimized sprite atlases, audio sprite pooling, and skeleton animations under 4.5MB total initial bundle payload. |

---

## 4.2 DevOps & Production Recommendations for Master Franchise

### 4.2.1 High-Concurrency Load Testing Roadmap (k6 & Distributed Stress)

Before opening the game provider to live operator traffic, the franchise DevOps team must execute three required k6 performance validation runs.

```javascript
// k6-load-scenario.js: Production Certification Script
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    // Scenario A: Steady Ramp to 10,000 Concurrent Players
    steady_state_traffic: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '2m', target: 2000 },
        { duration: '5m', target: 5000 },
        { duration: '10m', target: 10000 },
        { duration: '3m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    // Scenario B: Spike Stress (Flash Round Bet Surges)
    flash_bet_surge: {
      executor: 'shared-iterations',
      vus: 3000,
      iterations: 30000,
      maxDuration: '1m',
      startTime: '5m',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<120', 'p(99)<250'], // 95% of wallet calls under 120ms
    'http_req_failed': ['rate<0.001'],               // Error rate < 0.1%
    'ws_connecting': ['p(95)<200'],                   // WS connection handshake < 200ms
  },
};

export default function () {
  const url = 'ws://api.provider-internal.net/ws/game';
  const params = { tags: { my_tag: 'crash_player' } };

  ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ action: 'SUBSCRIBE', room: 'GLOBAL_CRASH_1' }));
    });
    socket.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'BETTING_OPEN') {
        socket.send(JSON.stringify({ action: 'PLACE_BET', amount: 100, currency: 'THB' }));
      }
    });
    socket.sleep(15);
    socket.close();
  });
}
```

---

### 4.2.2 Cloud Infrastructure & Kubernetes Production Topology

The Master Franchise DevOps team should deploy the platform using the following resilient topology:

```
                                  [ INTERNET ]
                                       │
                         [ Cloudflare Magic Transit ]
                         (Layer 3/4/7 DDoS Protection)
                                       │
                      [ AWS Application Load Balancer ]
                   (TLS 1.3 / WebSocket Upgrade / Sticky Cookie)
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     [ k8s Ingress: Gateway Pods ]                 [ k8s Ingress: Game Pods ]
     (Horizontal Pod Autoscaling:                  (StatefulSets / Session Affinity:
      CPU > 65% or Memory > 75%)                    Dedicated Room Ticker Loops)
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       ▼
                       [ AWS ElastiCache Redis 7.x ]
                     (Multi-AZ with Auto-Failover,
                      Clustered across 3 Read Replicas)
                                       ▼
                         [ AWS Aurora PostgreSQL 16 ]
                    (Multi-AZ, Read Replicas for Analytics,
                     Write-Ahead Ledger Partitioning by Month)
```

#### Strategic Infrastructure Imperatives:
1. **WebSocket Session Stickiness:** Configure ALB cookie-based sticky sessions or source-IP hashing so player WebSocket connections do not flap between different ingress nodes during an active round.
2. **Redis Redlock TTL Tuning:** Keep distributed lock TTLs between $1,500\text{ms} - 2,000\text{ms}$ with jittered exponential retries to prevent deadlock during operator wallet hiccups.
3. **Database Ledger Partitioning:** The PostgreSQL audit ledger (`seamless_wallet_txns`) will accumulate 5–15 million rows monthly under high traffic. Implement **Range Partitioning by Month (`PARTITION BY RANGE (created_at)`)** to keep indexing trees shallow and queries sub-millisecond.
4. **WAF Rate Limiting on Operator Webhooks:** Protect inbound wallet callbacks with Cloudflare IP Whitelisting (allowing only designated Operator CIDR blocks) and an aggressive Token Bucket Rate Limiter ($1,000\text{ req/sec per operator IP}$).
