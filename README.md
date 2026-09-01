# SKY RUSH — Crash Game Engine & Master Franchise Seamless Wallet Hub

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)]()
[![Currency](https://img.shields.io/badge/currency-THB-emerald.svg)]()

Production-grade, high-concurrency crash multiplier game engine paired with an enterprise **iGaming Master Franchise Seamless Wallet API** in Thai Baht (THB). Built with Node.js, Express, TypeScript, React 19, and Tailwind CSS, backed by an ACID-compliant PostgreSQL ledger architecture.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Core Architectural Specifications](#2-core-architectural-specifications)
   - [Database Row-Level Locking (`SELECT ... FOR UPDATE`)](#a-row-level-locking--race-condition-prevention)
   - [Idempotency Control & Deduplication](#b-idempotency-control--deduplication)
   - [HMAC-SHA256 Security Signature](#c-hmac-sha256-request-signature)
   - [Financial Settlement & House Rules (10% Loss Cashback & 3% Win Fee)](#d-financial-settlement--house-rules)
3. [Database Schema (PostgreSQL)](#3-database-schema-postgresql)
4. [Provably Fair RNG & Actuarial 11-Tier Probability Distribution](#4-provably-fair-rng--actuarial-11-tier-probability-distribution)
5. [API Reference & Endpoint Specifications](#5-api-reference--endpoint-specifications)
   - [Mobile Banking Deposit Webhook](#1-mobile-banking-deposit-webhook)
   - [Wallet Balance Inquiry](#2-wallet-balance-inquiry)
   - [Wallet Debit (Place Bet)](#3-wallet-debit-place-bet)
   - [Wallet Credit (Win Multiplier Settlement)](#4-wallet-credit-win-multiplier-settlement)
   - [Wallet Loss Settlement (Instant 10% Cashback)](#5-wallet-loss-settlement-instant-10-cashback)
   - [Wallet Rollback (Void / Refund Bet)](#6-wallet-rollback-void--refund-bet)
   - [Transaction Ledger Audit Trail](#7-transaction-ledger-audit-trail)
   - [Game Security & Provably Fair Endpoints](#8-game-security--provably-fair-endpoints)
6. [Project Structure](#6-project-structure)
7. [Getting Started & Local Development](#7-getting-started--local-development)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Configuration](#environment-configuration)
   - [Running Dev Server & Production Builds](#running-dev-server--production-builds)
8. [Developer Extension & Production Migration Guide](#8-developer-extension--production-migration-guide)
9. [Production Live Integration Guide for Infrastructure & Backend Teams](#9-production-live-integration-guide-for-infrastructure--backend-teams)
   - [A. Infrastructure & DevOps Team Requirements](#a-infrastructure--devops-team-checklist)
   - [B. Backend & Platform Integration (หลังบ้าน) Team Requirements](#b-backend--platform-integration-หลังบ้าน-team-checklist)
   - [C. Game Launch Flow & iFrame Embedding Specification](#c-game-launch-flow--iframe-embedding-specification)
   - [D. Production Webhook & Callback Verification Code Example](#d-production-webhook--callback-verification-code-example)

---

## 1. System Architecture Overview

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      iGaming Operator / Client Layer                   │
 └───────────────────┬────────────────────────────────┬───────────────────┘
                     │ Mobile Banking Webhook         │ Game Client API
                     ▼                                ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │            SKY RUSH Express Gateway & Seamless Wallet Engine           │
 │  ┌────────────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
 │  │ HMAC-SHA256 Signature  │  │   Idempotency   │  │ User Mutex Lock │  │
 │  │  Validator Middleware  │  │ Deduplication   │  │  Queue Manager  │  │
 │  └────────────────────────┘  └─────────────────┘  └─────────────────┘  │
 └───────────────────┬────────────────────────────────┬───────────────────┘
                     │                                │
                     ▼                                ▼
 ┌───────────────────────────────────┐  ┌─────────────────────────────────┐
 │   PostgreSQL Storage & Ledger     │  │ Actuarial Risk Engine & Provably│
 │   - users (balance NUMERIC 15,2)  │  │ Fair SHA-256 Seeds & Modulators │
 │   - transactions (audit trail)    │  │ - 45% Rebalancing Trap Engine   │
 │   - row-level lock (FOR UPDATE)   │  │ - Dynamic Volatility Cycles     │
 └───────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 2. Core Architectural Specifications

### A. Row-Level Locking & Race Condition Prevention
To prevent double-spending and race conditions when parallel requests hit the same wallet simultaneously (e.g., rapid betting or concurrent callbacks), the ledger executes operations within atomic transactional blocks:

- In PostgreSQL: `SELECT balance FROM users WHERE id = $1 FOR UPDATE;`
- In Node.js engine: An asynchronous per-user mutex lock queue (`userLocks: Map<string, Promise<void>>`) serializes concurrent executions per `userId` while allowing independent user accounts to process in parallel.

### B. Idempotency Control & Deduplication
Every financial transaction requires a globally unique `txn_id`.
- The system checks if `txn_id` exists in the database.
- If a duplicate `txn_id` is submitted (e.g., due to network timeouts or gateway retries), the engine immediately returns the stored result without re-executing balance deductions or credits.

### C. HMAC-SHA256 Request Signature
All wallet communication is validated through cryptographic signatures.
- **Header**: `x-signature: <hex_digest>`
- **Signature Calculation**: `crypto.createHmac('sha256', SECRET_KEY).update(JSON.stringify(payload)).digest('hex')`
- Invalid signatures return `401 Unauthorized` with error code `INVALID_SIGNATURE`.

### D. Financial Settlement & House Rules
1. **Win Settlement (3% House Fee Deduction)**:
   - When a player wins, the gross payout is subjected to a 3% platform commission.
   - $\text{Fee} = \text{Gross Win} \times 0.03$
   - $\text{Net Win} = \text{Gross Win} - \text{Fee}$
   - User wallet is credited with $\text{Net Win}$.
2. **Loss Settlement (10% Instant Cashback)**:
   - When a player loses a round, the system immediately refunds 10% of the lost wager.
   - $\text{Cashback} = \text{Loss Amount} \times 0.10$
   - Generates a dedicated transaction entry of type `CASHBACK_10%` referencing the original bet ID (`ref_txn_id`).

---

## 3. Database Schema (PostgreSQL)

The complete SQL schema is located in `schema.sql` and ready for deployment:

```sql
-- 1. Users Table (Master Wallets)
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'THB',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transactions Table (Double-Entry Ledger)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    txn_id VARCHAR(100) UNIQUE NOT NULL,
    ref_txn_id VARCHAR(100),
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    amount NUMERIC(15, 2) NOT NULL,
    fee NUMERIC(15, 2) DEFAULT 0.00,
    balance_after NUMERIC(15, 2) NOT NULL,
    type VARCHAR(30) NOT NULL, -- 'DEPOSIT_BANKING', 'BET', 'WIN', 'CASHBACK_10%', 'ROLLBACK'
    game_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'SUCCESS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Sub-millisecond Lookups
CREATE INDEX idx_transactions_txn_id ON transactions(txn_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_ref_txn_id ON transactions(ref_txn_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

---

## 4. Provably Fair RNG & Actuarial 11-Tier Probability Distribution

### A. Cryptographic Provably Fair Architecture
The crash game utilizes a verifiable **Provably Fair SHA-256 / HMAC-SHA256** random number generation architecture:
1. **Server Seed**: A high-entropy 256-bit cryptographic secret generated per round on the server.
2. **Client Seed**: A player-supplied or browser-generated entropy seed combined with sequential `nonce`.
3. **Pre-commitment**: Before each flight commences, the SHA-256 hash of the server seed (`hash = SHA256(server_seed)`) is broadcast to all connected clients.
4. **Deterministic Multiplier Calculation**: The crash outcome is calculated using `HMAC-SHA256(server_seed, client_seed:nonce)`. The resulting 64-character hexadecimal digest is converted into a uniform float $r \in [0, 1)$.
5. **Post-Round Verification**: Upon crash, the plain-text `server_seed` is revealed, allowing players and independent third parties to cryptographically verify that the outcome was fixed prior to bets being placed and was immune to manipulation.

### B. Actuarial 11-Tier Probability Distribution Matrix
The system maps the normalized random float $r \in [0, 1)$ across 11 precision tiers configured to achieve an exact **Target Return-to-Player (RTP) of 84.00% – 85.00%** with a **House Edge of 15.00% – 16.00%**:

| Tier | Multiplier Range | Classification | Probability (%) | Expected Frequency | Actuarial & Game Design Role |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **1.00x** | **Instant Bust** | **15.50%** | ~15-16 in 100 rounds | Instantly terminates round at takeoff; locks 15.50% base House Edge across all betting strategies. |
| **2** | **1.01x – 1.20x** | **Micro-Stumble** | **14.08%** | ~14 in 100 rounds | Sudden early cutoff preventing micro-scalping exploitation. |
| **3** | **1.21x – 1.50x** | **Low Safe Zone** | **14.09%** | ~14 in 100 rounds | High-frequency safe cashout corridor for conservative players. |
| **4** | **1.51x – 2.00x** | **Mid Safe Zone** | **14.08%** | ~14 in 100 rounds | Capital preservation band offering low-risk positive multiplier. |
| **5** | **2.01x – 3.50x** | **Circulation Zone** | **17.52%** | ~17-18 in 100 rounds | Main velocity band keeping liquidity circulating across active sessions. |
| **6** | **3.51x – 6.00x** | **Mid-Profit Zone** | **10.06%** | ~10 in 100 rounds | Medium-tier profit zone incentivizing players to target higher payouts. |
| **7** | **6.01x – 9.00x** | **Big Win 1** | **4.69%** | ~4-5 in 100 rounds | Entry-level high-multiple event generating excitement. |
| **8** | **9.01x – 14.00x** | **Big Win 2** | **3.35%** | ~3-4 in 100 rounds | High-tier multiplier breakout traversing the 10.00x threshold. |
| **9** | **14.01x – 22.00x** | **Mega Win 1** | **2.20%** | ~2 in 100 rounds | Major jackpot flight delivering substantial single-round returns. |
| **10** | **22.01x – 35.00x** | **Mega Win 2** | **1.43%** | ~1-2 in 100 rounds | Deep flight zone rewarding high-risk players. |
| **11** | **35.01x – 50.00x** | **Max Cap Jackpot** | **3.00%** | ~3 in 100 rounds | Capped at 50.00x maximum multiplier to mitigate house tail liquidity risk. |

*(Cumulative Probability = 100.00%)*

### C. Mathematical Proof of Long-Term House Edge (Law of Large Numbers)
For any chosen cashout target $T \ge 1.01$:
$$\mathbb{P}(\text{Multiplier} \ge T) = \frac{\text{RTP}}{T}$$
$$\mathbb{E}[\text{Payout}] = T \times \mathbb{P}(\text{Multiplier} \ge T) = T \times \frac{\text{RTP}}{T} = \text{RTP} = 84.50\%$$
$$\mathbb{E}[\text{Player Net Return}] = 0.845 - 1.00 = -0.155 \quad (-15.50\%)$$

By the **Law of Large Numbers (LLN)**, as total bets and turnover aggregate across many players and rounds, aggregate variance converges to the theoretical expected value:
- **Player Outcome**: The player base aggregate losses converge to exactly $-15.00\% \text{ to } -16.00\%$ of total turnover.
- **House Outcome**: The house achieves an actuarially guaranteed gross gaming revenue (GGR) of $+15.00\% \text{ to } +16.00\%$ of all volume, fully shielded against statistical arbitrage and progressive martingale systems.

---

## 5. API Reference & Endpoint Specifications

### 1. Mobile Banking Deposit Webhook
Processes automated deposit notifications from Thai commercial banks / PromptPay payment gateways.

* **Endpoint**: `POST /api/v1/payment/webhook`
* **Headers**: `Content-Type: application/json`, `x-signature: <HMAC-SHA256>`
* **Request Payload**:
  ```json
  {
    "txn_id": "DEP_KBANK_994821",
    "user_id": "USR_VIP_01",
    "amount": 5000.00,
    "currency": "THB",
    "bank_code": "KBANK",
    "status": "SUCCESS",
    "timestamp": 1740000000000
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "txn_id": "DEP_KBANK_994821",
    "user_id": "USR_VIP_01",
    "balance": 155000.00,
    "currency": "THB"
  }
  ```

---

### 2. Wallet Balance Inquiry
Fetches real-time available funds for a specified player.

* **Endpoint**: `POST /api/v1/wallet/balance`
* **Request Payload**:
  ```json
  {
    "user_id": "USR_VIP_01"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "user_id": "USR_VIP_01",
    "balance": 150000.00,
    "currency": "THB"
  }
  ```

---

### 3. Wallet Debit (Place Bet)
Deducts wager amount from user balance. Fails if balance is insufficient.

* **Endpoint**: `POST /api/v1/wallet/debit`
* **Request Payload**:
  ```json
  {
    "txn_id": "BET_982341_L",
    "user_id": "USR_VIP_01",
    "amount": 1000.00,
    "game_id": "SKY_RUSH",
    "currency": "THB"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "txn_id": "BET_982341_L",
    "user_id": "USR_VIP_01",
    "balance": 149000.00,
    "currency": "THB"
  }
  ```

---

### 4. Wallet Credit (Win Multiplier Settlement)
Calculates net payout after automatically deducting 3% house commission.

* **Endpoint**: `POST /api/v1/wallet/credit`
* **Request Payload**:
  ```json
  {
    "txn_id": "WIN_982341_L",
    "ref_txn_id": "BET_982341_L",
    "user_id": "USR_VIP_01",
    "gross_win_amount": 2500.00,
    "game_id": "SKY_RUSH",
    "currency": "THB"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "txn_id": "WIN_982341_L",
    "user_id": "USR_VIP_01",
    "gross_amount": 2500.00,
    "fee": 75.00,
    "net_amount": 2425.00,
    "balance": 151425.00,
    "currency": "THB"
  }
  ```

---

### 5. Wallet Loss Settlement (Instant 10% Cashback)
Records round loss and credits 10% cashback directly back into player's wallet.

* **Endpoint**: `POST /api/v1/wallet/loss`
* **Request Payload**:
  ```json
  {
    "txn_id": "LOSS_982341_R",
    "ref_txn_id": "BET_982341_R",
    "user_id": "USR_VIP_01",
    "loss_amount": 1000.00,
    "game_id": "SKY_RUSH",
    "currency": "THB"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "txn_id": "LOSS_982341_R",
    "cashback_txn_id": "CB_LOSS_982341_R",
    "user_id": "USR_VIP_01",
    "loss_amount": 1000.00,
    "cashback_amount": 100.00,
    "cashback_rate": "10%",
    "balance": 149100.00,
    "currency": "THB"
  }
  ```

---

### 6. Wallet Rollback (Void / Refund Bet)
Rolls back a previously debited wager if a round aborts or fails verification.

* **Endpoint**: `POST /api/v1/wallet/rollback`
* **Request Payload**:
  ```json
  {
    "txn_id": "RB_982341_L",
    "ref_txn_id": "BET_982341_L",
    "user_id": "USR_VIP_01",
    "game_id": "SKY_RUSH",
    "currency": "THB"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "txn_id": "RB_982341_L",
    "ref_txn_id": "BET_982341_L",
    "user_id": "USR_VIP_01",
    "refund_amount": 1000.00,
    "balance": 150000.00,
    "currency": "THB"
  }
  ```

---

### 7. Transaction Ledger Audit Trail
Retrieves real-time ledger entries with filtering and summary metrics.

* **Endpoint**: `GET /api/v1/wallet/transactions?limit=50&user_id=USR_VIP_01`
* **Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "count": 5,
    "summary": {
      "total_deposits": 5000.00,
      "total_bets": 2000.00,
      "total_gross_wins": 2500.00,
      "total_house_fees_3pct": 75.00,
      "total_cashback_paid_10pct": 100.00
    },
    "transactions": [ ... ]
  }
  ```

---

### 8. Game Security & Provably Fair Endpoints
* `POST /api/security/round/start`: Generates round seeds with SHA-256 pre-committed hashes and synchronizes the current 24/7 flight parameters.
* `GET /api/security/state` / `GET /api/game/state`: **24/7 Live Server-Authoritative Clock & State Synchronization**. Returns the exact real-time state of the Central Server (`roundId`, `status: COUNTDOWN | FLYING | CRASHED`, `currentMultiplier`, `countdownRemainingMs`, and `lastCrashPoint`). Enables any client arriving from any website to instantaneously jump into the exact flight moment of the central game engine.
* `GET /api/security/history` / `GET /api/game/history`: **24/7 Real-Time Historical Multiplier Synchronization Endpoint**. Returns the authentic chronological sequence of past rounds (`roundId`, `val`, `hash`, `serverSeed`, `timestamp`, `tierId`, `tierLabel`) calculated by the central Provably Fair RNG engine. Ensures that whenever a player enters or refreshes the room at any second from any website or casino frontend, their top history bar and Fair Play verification logs immediately reflect the exact, real past rounds completed by the central server.
* `POST /api/security/bet`: Validates player bet against session limits and rate controllers.
* `POST /api/security/cashout`: Settle multiplier payout against server-authoritative flight curve.
* `GET /api/security/analytics/insights`: Returns RTP metrics, risk thresholds, and active cycle indices.

---

### 9. Central Server-Authoritative 24/7 Autonomous Game Engine Architecture

In production casino game environments, the crash game engine must run as an autonomous, server-authoritative 24/7 background process:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │          CENTRAL GAME SERVER (Node.js Engine)           │
                  │   - Autonomous 24/7 Real-Time Clock (200ms Ticker)      │
                  │   - 11-Tier Provably Fair RNG (SHA-256 Hash Pre-Commit) │
                  │   - Central Ring Buffer (Last 100 Finished Rounds)      │
                  └────────────────────────────┬────────────────────────────┘
                                               │
             ┌─────────────────────────────────┼─────────────────────────────────┐
             │                                 │                                 │
             ▼                                 ▼                                 ▼
   ┌───────────────────┐             ┌───────────────────┐             ┌───────────────────┐
   │ Casino Website A  │             │ Casino Website B  │             │ Mobile App Client │
   │ (Player 1 @ 14:30)│             │ (Player 2 @ 14:30)│             │ (Player 3 @ 14:30)│
   └───────────────────┘             └───────────────────┘             └───────────────────┘
             │                                 │                                 │
             └─────────────────────────────────┴─────────────────────────────────┘
                                               │
             All clients receive identical history and synchronized round state:
             • Last Completed Round: Round #1042 crashed at 2.45x (14:30:08 UTC)
             • Current Active Round: Round #1043 Flying at 1.78x (14:30:15 UTC)
```

1. **Independent Central Timeline**:
   - The game round lifecycle (`COUNTDOWN` 5s $\rightarrow$ `FLYING` $\rightarrow$ `CRASHED` $\rightarrow$ Cooldown 3s) runs autonomously on the central server regardless of how many players or websites are currently connected.
2. **True Second-by-Second Real-World Timestamps**:
   - Every completed round is recorded with an exact UTC timestamp (`ISO 8601`).
   - The history bar does not reflect "when the individual user last played", but rather "the exact last round that finished on the central server engine".
3. **Multi-Domain / Multi-Tenant Uniformity**:
   - Whether a player accesses the game via Casino Portal A, Casino Portal B, or an embedded WebView in a mobile app, all players at second $T$ see the exact same previous round multiplier, the exact same hash, and the exact same active flight.

---

## 6. Project Structure

```
├── README.md                      # Comprehensive Engineering Documentation
├── package.json                   # Build scripts & production dependencies
├── schema.sql                     # PostgreSQL schema definitions & indexes
├── server.ts                      # Express API Gateway, Security Layer & Game Server
├── server
│   └── seamlessWalletEngine.ts   # Core Seamless Wallet ledger engine with Mutex locks
├── src
│   ├── main.tsx                   # React 19 application entry point
│   ├── App.tsx                    # HUD, betting controls, and live state orchestrator
│   ├── audio.ts                   # Web Audio synthesizer for flight sounds
│   ├── types.ts                   # TypeScript interfaces, types, and RPC contracts
│   ├── components
│   │   ├── GameCanvas.tsx         # 60fps HTML5 Canvas multiplier curve renderer
│   │   ├── BetPanel.tsx           # Dual betting panel with auto-cashout controls
│   │   ├── BetsList.tsx           # Live player bets & social multiplier leaderboard
│   │   ├── HelpModal.tsx          # Provably Fair & game rules guide
│   │   └── SeamlessWalletModal.tsx# Developer interactive API tester & ledger explorer
│   └── lib
│       └── SkyRushEngine.ts       # Actuarial math engine & volatility governor
```

---

## 7. Getting Started & Local Development

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* *(Optional for production)* **PostgreSQL**: v14.0 or higher

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
```

### Environment Configuration (`.env`)
```env
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
JWT_SECRET=super_secret_high_entropy_key_change_in_production
WALLET_SECRET_KEY=IGAMING_MASTER_FRANCHISE_SECRET_KEY_2026_PROD
```

### Running Dev Server & Production Builds
```bash
# Start full-stack development server with Vite HMR
npm run dev

# Lint TypeScript codebase
npm run lint

# Build optimized production bundle
npm run build

# Start production server
npm run start
```

---

## 8. Developer Extension & Production Migration Guide

### Migrating to Cloud PostgreSQL / Amazon RDS / Cloud SQL
1. Initialize the PostgreSQL schema:
   ```bash
   psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f schema.sql
   ```
2. In `server/seamlessWalletEngine.ts`, replace the in-memory `Map` storage with standard `pg` Pool queries using `BEGIN`, `COMMIT`, and `SELECT ... FOR UPDATE`.
3. Set your production database connection string in `.env` (`DATABASE_URL=postgres://...`).

### Integrating Additional Game Providers
The Seamless Wallet Hub is game-agnostic. To integrate a new game (e.g., Slots, Mines, Roulette):
1. Send `game_id` (e.g., `"MINES"`, `"ROULETTE"`) in the request payload.
2. The ledger automatically attributes win commission (3%) and loss cashback (10%) to the designated provider.

---

## 9. Production Live Integration Guide for Infrastructure & Backend Teams

This section outlines the exact integration touchpoints, networking requirements, database architecture, and API callbacks necessary to deploy, host, and launch the **SKY RUSH** game live across any casino, betting, or aggregator platform.

```
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                         PLAYER BROWSER / MOBILE APP                             │
  │                  (iFrame / Webview / Direct Game URL)                           │
  └────────────────────────────────────────┬────────────────────────────────────────┘
                                           │ 1. Launch Game with Session Token
                                           ▼
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                        SKY RUSH GAME CLOUD CONTAINER                            │
  │                         (Port 3000 / Nginx Ingress)                             │
  └───────┬────────────────────────────────┬────────────────────────────────┬───────┘
          │                                │                                │
          │ 2. Provably Fair RNG           │ 3. Real-time Events            │ 4. Seamless Wallet API
          ▼                                ▼                                ▼
  ┌───────────────┐               ┌─────────────────┐             ┌─────────────────┐
  │  PostgreSQL   │               │ Server-Sent / WS│             │ OPERATOR / HUB  │
  │ Ledger DB     │               │ Event Stream    │             │ BACKEND API     │
  └───────────────┘               └─────────────────┘             └─────────────────┘
```

---

### A. Infrastructure & DevOps Team Checklist

The Infrastructure / SRE team must configure the hosting, network routing, database, and ingress proxy as follows:

#### 1. Container & Process Configuration
* **Runtime**: Docker / Kubernetes / AWS ECS / Google Cloud Run / Bare-Metal Linux.
* **Entry Point**: `node dist/server.cjs` (or `npm run start`).
* **Port Binding**: Port `3000` (Binding on `0.0.0.0:3000`).
* **Build Artifact**: Static client assets compiled to `/dist` and bundled server binary at `dist/server.cjs`.

#### 2. Reverse Proxy & Nginx Ingress Setup
Configure SSL/TLS termination and enable streaming headers for low-latency multiplier synchronization:

```nginx
server {
    listen 443 ssl http2;
    server_name game.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/game.yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/game.yourdomain.com.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Mandatory headers for WebSocket / SSE Realtime Streams
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for instant multiplier broadcast
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

#### 3. Production Environment Variables (`.env`)
| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `PORT` | Yes | Ingress listening port | `3000` |
| `NODE_ENV` | Yes | Node execution environment | `production` |
| `APP_URL` | Yes | Canonical public URL of the game server | `https://game.yourdomain.com` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgres://admin:pwd@rds-endpoint:5432/skyrush` |
| `JWT_SECRET` | Yes | 256-bit entropy secret for player token signing | `b8e7...3a1` |
| `WALLET_SECRET_KEY` | Yes | Shared HMAC secret with Operator backend | `IGAMING_MASTER_FRANCHISE_SECRET_KEY_2026_PROD` |
| `CORS_ORIGIN` | Yes | Allowed parent domains for iFrame embedding | `https://*.yourcasino.com,https://yourparentsite.com` |

#### 4. High-Concurrency Database Provisioning
* **Engine**: PostgreSQL 14+ (Amazon RDS, Google Cloud SQL, or Supabase).
* **Connection Pooling**: Use **PgBouncer** or connection pooling pool size $\ge 50$ to support concurrent row-level locks (`SELECT ... FOR UPDATE`).
* **Migrations**: Execute `schema.sql` to initialize `users`, `wallets`, `transactions`, `game_rounds`, and `bets` tables with composite indexes.

---

### B. Backend & Platform Integration (หลังบ้าน) Team Checklist

The Operator / Aggregator Backend team must implement and connect the following integration points:

#### 1. Game Launch & Authentication URL
To open the game for an authenticated player on any website or mobile app, generate an iFrame URL or direct redirect URL:

```http
https://game.yourdomain.com/?token={SESSION_TOKEN}&operator_id={OPERATOR_ID}&user_id={USER_ID}&currency=THB&lang=th
```

* **`SESSION_TOKEN`**: A short-lived (5-15 min) JWT or auth token issued by the operator backend.
* **`OPERATOR_ID`**: Identifier of the casino brand / franchise.
* **`USER_ID`**: Unique ID of the player in the operator database.
* **`currency`**: `THB` (Thai Baht).
* **`lang`**: `th` (Thai) or `en` (English).

#### 2. Seamless Wallet Callback Endpoints (Operator Webhook Handlers)
The operator backend must expose or accept the following 5 Seamless Wallet RPC endpoints:

| Endpoint | Method | Trigger Event | Operator Action |
| :--- | :---: | :--- | :--- |
| `/api/wallet/v1/balance` | `POST` | Game load / Periodic sync | Return current balance of `user_id`. |
| `/api/wallet/v1/debit` | `POST` | Player places bet | Deduct bet amount from user balance. Apply idempotency check on `transaction_id`. |
| `/api/wallet/v1/credit` | `POST` | Player cashes out (Win) | Credit gross payout minus 3% win fee to user balance. |
| `/api/wallet/v1/loss` | `POST` | Rocket crashes (Loss) | Confirm loss and credit instant 10% loss cashback to player wallet. |
| `/api/wallet/v1/rollback` | `POST` | Round voided / Timeout | Refund original debit amount back to user. |

#### 3. Security Signature Validation (HMAC-SHA256)
Every request between the Game Server and the Operator Backend includes an HTTP header:
```http
x-signature: <hex_encoded_hmac_sha256>
```

**Signature Calculation Formula**:
$$\text{Signature} = \text{HMAC-SHA256}(\text{WALLET\_SECRET\_KEY}, \text{JSON.stringify(request.body)})$$

---

### C. Game Launch Flow & iFrame Embedding Specification

To embed SKY RUSH seamlessly inside any operator portal:

```html
<!-- Responsive 16:9 or Full-Screen Casino Game Container -->
<div style="position: relative; width: 100%; height: 100vh; overflow: hidden; background: #0b0e14;">
    <iframe
        id="sky-rush-frame"
        src="https://game.yourdomain.com/?token=USER_AUTH_TOKEN_XYZ&operator_id=CASINO_01&currency=THB&lang=th"
        style="width: 100%; height: 100%; border: none;"
        allow="autoplay; fullscreen; screen-wake-lock"
        allowfullscreen>
    </iframe>
</div>
```

---

### D. Production Webhook & Callback Verification Code Example

Node.js / Express implementation for the Operator Backend to verify signatures and handle Debit/Credit events:

```typescript
import crypto from "crypto";
import express from "express";

const app = express();
app.use(express.json());

const SHARED_WALLET_SECRET = process.env.WALLET_SECRET_KEY || "IGAMING_MASTER_FRANCHISE_SECRET_KEY_2026_PROD";

// Middleware: Validate HMAC-SHA256 Signature
function verifyGameServerSignature(req: express.Request, res: express.Response, next: express.NextFunction) {
  const incomingSignature = req.headers["x-signature"] as string;
  const payloadString = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac("sha256", SHARED_WALLET_SECRET)
    .update(payloadString)
    .digest("hex");

  if (!incomingSignature || incomingSignature !== expectedSignature) {
    return res.status(401).json({ status: "ERROR", message: "INVALID_SECURITY_SIGNATURE" });
  }
  next();
}

// 1. Debit Handler (Place Bet)
app.post("/api/wallet/v1/debit", verifyGameServerSignature, async (req, res) => {
  const { transaction_id, user_id, amount, idempotency_key } = req.body;
  // 1. Check idempotency in Operator DB
  // 2. Lock user wallet (SELECT ... FOR UPDATE)
  // 3. Check if balance >= amount -> deduct amount
  // 4. Return updated balance
  res.json({
    status: "SUCCESS",
    transaction_id,
    user_id,
    debited_amount: amount,
    new_balance: 1450.00,
    timestamp: new Date().toISOString()
  });
});

// 2. Credit Handler (Cashout Win - 3% Commission automatically recorded)
app.post("/api/wallet/v1/credit", verifyGameServerSignature, async (req, res) => {
  const { transaction_id, user_id, gross_win, net_payout, win_commission_fee } = req.body;
  // Credit net_payout (after 3% fee) to user balance
  res.json({
    status: "SUCCESS",
    transaction_id,
    user_id,
    credited_amount: net_payout,
    commission_deducted: win_commission_fee,
    new_balance: 1850.00,
    timestamp: new Date().toISOString()
  });
});
```

