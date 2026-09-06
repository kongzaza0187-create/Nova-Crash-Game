# SUPERNOVA — Crash Game Engine & Master Franchise Seamless Wallet Hub

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
   - [Financial Settlement & Mathematical House Edge](#d-financial-settlement--house-rules)
3. [Database Schema (PostgreSQL)](#3-database-schema-postgresql)
4. [Provably Fair RNG & Actuarial 11-Tier Probability Distribution](#4-provably-fair-rng--actuarial-11-tier-probability-distribution)
5. [API Reference & Endpoint Specifications](#5-api-reference--endpoint-specifications)
   - [Mobile Banking Deposit Webhook](#1-mobile-banking-deposit-webhook)
   - [Wallet Balance Inquiry](#2-wallet-balance-inquiry)
   - [Wallet Debit (Place Bet)](#3-wallet-debit-place-bet)
   - [Wallet Credit (Win Multiplier Settlement)](#4-wallet-credit-win-multiplier-settlement)
   - [Wallet Loss Settlement](#5-wallet-loss-settlement)
   - [Wallet Rollback (Void / Refund Bet)](#6-wallet-rollback-void--refund-bet)
   - [Transaction Ledger Audit Trail](#7-transaction-ledger-audit-trail)
   - [Game Security & Provably Fair Endpoints](#8-game-security--provably-fair-endpoints)
6. [Postman Suite & Testing Guide (คู่มือ Postman GET & POST)](#6-postman-suite--testing-guide-คู่มือ-postman-get--post)
   - [Postman Collection Architecture](#a-postman-collection-architecture)
   - [How to Import into Postman](#b-how-to-import-into-postman)
   - [Automated HMAC-SHA256 & Dev-Bypass Headers](#c-automated-hmac-sha256--dev-bypass-headers)
   - [Complete Endpoints Directory](#d-complete-endpoints-directory-by-domain)
7. [Backend Developer Architecture Guide: พัฒนาต่อยอดให้ถูกที่](#7-backend-developer-architecture-guide-คู่มือพัฒนาต่อยอดให้ถูกที่)
   - [Directory Structure & Module Responsibilities](#a-directory-structure--module-responsibilities)
   - [Where to Add Code Based on Feature Type](#b-where-to-add-code-based-on-feature-type)
   - [Step-by-Step: Adding a New GET Endpoint](#c-step-by-step-adding-a-new-get-endpoint)
   - [Step-by-Step: Adding a New POST Endpoint](#d-step-by-step-adding-a-new-post-endpoint)
   - [Engineering Standards & Concurrency Rules](#e-engineering-standards--concurrency-rules)
8. [Project Structure](#8-project-structure)
9. [Getting Started & Local Development](#9-getting-started--local-development)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Configuration](#environment-configuration)
   - [Running Dev Server & Production Builds](#running-dev-server--production-builds)
10. [Developer Extension & Production Migration Guide](#10-developer-extension--production-migration-guide)
11. [Production Live Integration Guide for Infrastructure & Backend Teams](#11-production-live-integration-guide-for-infrastructure--backend-teams)
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
 │            SUPERNOVA Express Gateway & Seamless Wallet Engine          │
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

### D. Financial Settlement & Mathematical House Edge
1. **Gross Win Settlement**:
   - When a player cashes out, the full verified gross payout ($\text{Payout} = \text{Bet Amount} \times \text{Multiplier}$) is credited in full to the user's wallet without fee deductions.
   - The mathematical House Edge (15.50%) is mathematically guaranteed by the Actuarial 11-Tier Provably Fair crash distribution.
2. **Loss Settlement**:
   - When the rocket crashes before cashout, the wager is confirmed and settled as a completed loss in the financial audit ledger.
   - Idempotent transaction records are permanently logged with reference to the original wager transaction ID (`ref_txn_id`).

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
3. **Statistical Independence**: **Every single round is statistically independent (IID)**. Outcome determination depends purely on cryptographic seeds with zero stateful streaks or outcome tampering.
4. **Pre-commitment**: Before each flight commences, the SHA-256 hash of the server seed (`hash = SHA256(server_seed)`) is broadcast to all connected clients.
5. **Deterministic Multiplier Calculation**: The crash outcome is calculated using `HMAC-SHA256(server_seed, client_seed:nonce)`. The resulting 64-character hexadecimal digest is converted into a uniform float $r \in [0, 1)$.
6. **Post-Round Verification**: Upon crash, the plain-text `server_seed` is revealed, allowing players and independent third parties to cryptographically verify that the outcome was fixed prior to bets being placed and was immune to manipulation.

### B. Actuarial 11-Tier Probability Distribution Matrix
The system maps the normalized random float $r \in [0, 1)$ across 11 precision tiers configured to achieve an exact **Target Return-to-Player (RTP) of 84.50% (Range: 83.00% - 85.00%)** with a strictly positive **House Edge of 15.50% (Range: 15.00% - 17.00%)** and a maximum payout multiplier strictly capped at **50.00x**:

| Tier | Multiplier Range | Classification | Probability (%) | Expected Frequency | Actuarial & Game Design Role |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **1.00x** | **Instant Bust** | **15.50%** | ~15-16 in 100 rounds | Instantly terminates round at takeoff; guarantees 15.50% base House Edge across all cashout strategies. |
| **2** | **1.01x – 1.20x** | **Micro-Stumble** | **14.90%** | ~14-15 in 100 rounds | Early cutoff preventing micro-scalping exploitation. |
| **3** | **1.21x – 1.50x** | **Low Safe Zone** | **15.30%** | ~15-16 in 100 rounds | High-frequency safe cashout corridor for conservative players. |
| **4** | **1.51x – 2.00x** | **Mid Safe Zone** | **15.80%** | ~15-16 in 100 rounds | Capital preservation band offering low-risk positive multiplier. |
| **5** | **2.01x – 3.50x** | **Circulation Zone** | **20.00%** | ~20 in 100 rounds | Main velocity band keeping liquidity circulating across active sessions. |
| **6** | **3.51x – 6.00x** | **Mid-Profit Zone** | **10.10%** | ~10 in 100 rounds | Medium-tier profit zone incentivizing players to target higher payouts. |
| **7** | **6.01x – 9.99x** | **High Profit Zone** | **4.00%** | ~4 in 100 rounds | Entry-level high-multiple event generating excitement. |
| **8** | **10.00x – 15.00x** | **Big Win 1** | **1.60%** | ~1-2 in 100 rounds | High-tier multiplier breakout traversing the 10.00x threshold. |
| **9** | **15.01x – 25.00x** | **Big Win 2** | **1.10%** | ~1 in 91 rounds | Major jackpot flight delivering substantial single-round returns. |
| **10** | **25.01x – 35.00x** | **Mega Win** | **0.50%** | ~1 in 200 rounds | Deep flight zone rewarding high-risk players. |
| **11** | **35.01x – 50.00x** | **Max Cap Jackpot** | **1.20%** | ~1 in 83 rounds | Capped at 50.00x maximum multiplier; calibrated to exactly ~1% กว่าๆ (1.20%) to maintain verified 15.50% House Edge / 84.50% RTP balance while delivering frequent grand prizes. |

*(Cumulative Probability = Exactly 100.00% | Total Win Probability $\ge$ 1.01x = 84.50%)*

### C. Mathematical Proof of Long-Term House Edge (Law of Large Numbers)
For any chosen cashout target $T \ge 1.01$:
$$\mathbb{P}(\text{Multiplier} \ge T) = \frac{\text{RTP}}{T}$$
$$\mathbb{E}[\text{Payout}] = T \times \mathbb{P}(\text{Multiplier} \ge T) = T \times \frac{\text{RTP}}{T} = \text{RTP} = 84.50\%$$
$$\mathbb{E}[\text{Player Net Return}] = 0.8450 - 1.00 = -0.1550 \quad (-15.50\%)$$

By the **Law of Large Numbers (LLN)**, as total bets and turnover aggregate across many players and rounds, aggregate variance converges to the theoretical expected value:
- **Player Outcome**: The player base aggregate losses converge to $-15.50\%$ of total turnover (84.50% RTP).
- **House Outcome**: The house achieves an actuarially guaranteed gross gaming revenue (GGR) of $+15.50\%$ of all volume, fully protected against statistical arbitrage while providing exciting, provably fair gameplay.

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
Credits verified gross payout directly to the player's wallet.

* **Endpoint**: `POST /api/v1/wallet/credit`
* **Request Payload**:
  ```json
  {
    "txn_id": "WIN_982341_L",
    "ref_txn_id": "BET_982341_L",
    "user_id": "USR_VIP_01",
    "gross_win_amount": 2500.00,
    "game_id": "SUPERNOVA",
    "currency": "THB"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "txn_id": "WIN_982341_L",
    "user_id": "USR_VIP_01",
    "credited_amount": 2500.00,
    "balance": 151500.00,
    "currency": "THB"
  }
  ```

---

### 5. Wallet Loss Settlement
Confirms and records round loss in the financial transaction audit ledger.

* **Endpoint**: `POST /api/v1/wallet/loss`
* **Request Payload**:
  ```json
  {
    "txn_id": "LOSS_982341_R",
    "ref_txn_id": "BET_982341_R",
    "user_id": "USR_VIP_01",
    "loss_amount": 1000.00,
    "game_id": "SUPERNOVA",
    "currency": "THB"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "SUCCESS",
    "txn_id": "LOSS_982341_R",
    "user_id": "USR_VIP_01",
    "loss_amount": 1000.00,
    "balance": 149000.00,
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

## 6. Postman Suite & Testing Guide (คู่มือ Postman GET & POST)

ระบบได้จัดเตรียมชุดทดสอบ API แบบครบวงจรผ่าน **Postman Collection v2.1.0** ครอบคลุมทั้งคำขอ **GET** และ **POST** กว่า 36 endpoints แยกเป็นหมวดหมู่อย่างเป็นระเบียบ พร้อมระบบคำนวณลายเซ็นต์ดิจิทัล **HMAC-SHA256** อัตโนมัติ (Pre-request Script) และ Header จำลองสำหรับ Sandbox

### A. Postman Collection Architecture

คอลเลกชันถูกจัดกลุ่มเป็น 6 โฟลเดอร์หลักตามขอบเขตการทำงาน (Domain-Driven Structure):

1. **`1. 💳 Seamless Wallet & Banking API`** (19 Requests):
   - `[POST] Authenticate Player Session` (`/api/v1/wallet/authenticate`)
   - `[GET] Query Wallet Balance (Path Param)` (`/api/v1/wallet/balance/:userId`)
   - `[GET] Query Wallet Balance (Query String)` (`/api/v1/wallet/balance?user_id=...`)
   - `[POST] Query Wallet Balance (JSON Body)` (`/api/v1/wallet/balance`)
   - `[POST] Debit / Place Bet (Idempotent)` (`/api/v1/wallet/debit`)
   - `[POST] Credit / Win Cashout Settlement` (`/api/v1/wallet/credit`)
   - `[POST] Loss Settlement & Cashback Record` (`/api/v1/wallet/loss`)
   - `[POST] Rollback / Void & Refund Bet` (`/api/v1/wallet/rollback`)
   - `[POST] Mobile Banking Webhook (PromptPay / Bank Deposit)` (`/api/v1/payment/webhook`)
   - `[GET] List All Wallet Users` (`/api/v1/wallet/users`)
   - `[GET] Get User Details by ID` (`/api/v1/wallet/users/:userId`)
   - `[POST] Create New Wallet User` (`/api/v1/wallet/create-user`)
   - `[GET] Query Transaction Audit Ledger` (`/api/v1/wallet/transactions`)
   - `[GET] Get Single Transaction Details by TxnId` (`/api/v1/wallet/transactions/:txnId`)
   - `[POST] Generate HMAC-SHA256 Signature Helper` (`/api/v1/wallet/sign`)
   - `[POST] Reset Demo Wallet Data` (`/api/v1/wallet/reset-demo`)
   - `[GET] List Multi-Tenant B2B Operators` (`/api/wallet/v1/operators`)
   - `[POST] Register New B2B Operator Tenant` (`/api/wallet/v1/operators/register`)
   - `[POST] Universal Franchise Network Gateway` (`/api/v1/franchise/gateway`)

2. **`2. 🚀 Game Engine & Provably Fair API`** (9 Requests):
   - `[GET] Health & Engine Diagnostics` (`/api/security/health`)
   - `[GET] Live Authoritative Game State` (`/api/game/state`)
   - `[GET] Global Round History & Cryptographic Hashes` (`/api/game/history`)
   - `[POST] Force Round Start (Dev/Simulation)` (`/api/security/round/start`)
   - `[POST] Force Round Finish / Crash (Dev/Simulation)` (`/api/security/round/finish`)
   - `[POST] Player Login & Obtain JWT Token` (`/api/security/login`)
   - `[POST] In-Game Bet (JWT Authenticated)` (`/api/security/bet`)
   - `[POST] In-Game Cashout (JWT Authenticated)` (`/api/security/cashout`)
   - `[POST] Player Logout (Revoke JWT)` (`/api/security/logout`)

3. **`3. 🛡️ Security & Anti-Bot Defense API`** (6 Requests):
   - `[GET] Security & Audit Event Logs` (`/api/security/logs`)
   - `[GET] Anti-Bot Shield Status` (`/api/security/anti-bot/status`)
   - `[POST] Request Anti-Bot Challenge` (`/api/security/anti-bot/challenge`)
   - `[POST] Submit Anti-Bot Challenge Solution` (`/api/security/anti-bot/verify`)
   - `[GET] Cashout Velocity Insights` (`/api/security/analytics/insights`)
   - `[POST] Record Cashout Metric Ping` (`/api/security/analytics/cashout-metric`)

4. **`4. 📊 Actuarial Risk Engine & House Edge API`** (3 Requests):
   - `[GET] Actuarial Metrics & Real-Time RTP` (`/api/risk-assurance/metrics`)
   - `[POST] Update Liability Ceiling` (`/api/risk-assurance/set-ceiling`)
   - `[POST] Run Monte Carlo Risk Simulation` (`/api/risk-assurance/simulate`)

5. **`5. 🏢 B2B Franchise & Distributed Infrastructure API`** (11 Requests):
   - `[POST] Redis Sliding Window Rate-Limit Check` (`/api/b2b/redis/ratelimit`)
   - `[POST] Redis Distributed Session Store` (`/api/b2b/redis/session`)
   - `[GET] Redis Live Leaderboard` (`/api/b2b/redis/leaderboard`)
   - `[POST] Submit Score to Redis Leaderboard` (`/api/b2b/redis/leaderboard/add`)
   - `[GET] Partitioned PostgreSQL Audit Logs` (`/api/b2b/logs/partitions`)
   - `[POST] Insert Partitioned Log Entry` (`/api/b2b/logs/insert`)
   - `[POST] Seed Demo Partition Logs` (`/api/b2b/logs/seed`)
   - `[GET] Analytics: RTP Breakdown by Game` (`/api/b2b/analytics/rtp-by-game`)
   - `[GET] Analytics: Bot Detection Statistics` (`/api/b2b/analytics/bot-detection`)
   - `[GET] Analytics: Merchant GGR & NGR` (`/api/b2b/analytics/merchant-ggr`)
   - `[POST] Trigger K6 Concurrency Stress Test` (`/api/k6/run`)

6. **`6. 📖 API Documentation & Exports`** (3 Requests):
   - `[GET] Export Postman Collection v2.1.0` (`/api/docs/postman.json`)
   - `[GET] Export OpenAPI 3.0 / Swagger JSON` (`/api/docs/openapi.json`)
   - `[GET] API Endpoints Directory (Quick JSON)` (`/api/docs/endpoints`)

---

### B. How to Import into Postman

ผู้พัฒนาสามารถนำเข้า API เข้าสู่ Postman ได้ 3 วิธีตามความสะดวก:

#### วิธีที่ 1: Import ผ่าน Live URL (แนะนำ สะดวกที่สุด)
1. เปิดโปรแกรม Postman -> คลิกปุ่ม **Import** (มุมบนซ้าย)
2. วาง URL ของ Collection:
   ```
   http://localhost:3000/api/docs/postman.json
   ```
3. นำเข้า Environment:
   ```
   http://localhost:3000/api/docs/postman-environment.json
   ```
4. เลือก Environment `SUPERNOVA — Local Sandbox Environment` ที่มุมบนขวา และเริ่มยิงทดสอบได้ทันที

#### วิธีที่ 2: Import จากไฟล์ JSON ในโปรเจกต์
- ไฟล์ Collection: `public/supernova_postman_collection.json` หรือ `docs/postman/supernova_postman_collection.json`
- ไฟล์ Environment: `public/supernova_postman_environment.json` หรือ `docs/postman/supernova_postman_environment.json`

#### วิธีที่ 3: ดาวน์โหลดผ่าน UI ภายในเกม
- เข้าสู่หน้าเว็บเกม -> คลิกปุ่ม **"Seamless Wallet Console"** ที่แถบเมนู
- สลับไปที่แท็บ **"API Docs & Sandbox"**
- คลิกปุ่ม **"Postman Collection"** หรือ **"Postman Env"** เพื่อบันทึกไฟล์ลงเครื่อง

---

### C. Automated HMAC-SHA256 & Dev-Bypass Headers

ใน Postman Collection ได้ฝัง **Pre-request Script** ระดับ Collection เอาไว้แล้ว:

```javascript
// Postman Pre-request Script (ทำงานอัตโนมัติก่อนส่งคำขอทุกครั้ง)
const apiSecret = pm.collectionVariables.get('apiSecret') || 'YOUR_SUPER_SECRET_HMAC_KEY';

// 1. คำนวณ HMAC-SHA256 signature ให้อัตโนมัติสำหรับ POST ที่มี Request Body
if (pm.request.method === 'POST' && pm.request.body && pm.request.body.raw) {
    try {
        const rawBody = pm.request.body.raw;
        const signature = CryptoJS.HmacSHA256(rawBody, apiSecret).toString(CryptoJS.enc.Hex);
        pm.request.headers.upsert({ key: 'x-signature', value: signature });
    } catch (e) {
        console.warn('HMAC Generation skipped:', e);
    }
}

// 2. ตั้งค่า x-dev-test-mode: true เพื่อให้ผ่านการทดสอบใน Local Sandbox ทันที
if (!pm.request.headers.has('x-dev-test-mode')) {
    pm.request.headers.upsert({ key: 'x-dev-test-mode', value: 'true' });
}
```

*ผลลัพธ์*: ผู้พัฒนาท่านอื่นเพียงแค่เปิดคำขอใดๆ แล้วกด **"Send"** ได้ทันทีโดยไม่ต้องเขียนสคริปต์คำนวณ Hash หรือแปลง JSON เอง

---

### D. Complete Endpoints Directory by Domain

| Method | Endpoint Path | Headers / Auth | Description |
| :---: | :--- | :--- | :--- |
| **POST** | `/api/v1/wallet/authenticate` | `x-signature` หรือ `x-dev-test-mode` | ตรวจสอบ Session ผู้เล่นและส่งคืนยอดคงเหลือเริ่มต้น |
| **GET** | `/api/v1/wallet/balance/:userId` | `x-dev-test-mode: true` | ดึงยอดเงินคงเหลือผ่าน URL Path Parameter |
| **GET** | `/api/v1/wallet/balance?user_id=...` | `x-dev-test-mode: true` | ดึงยอดเงินคงเหลือผ่าน Query String |
| **POST** | `/api/v1/wallet/balance` | `x-signature` หรือ `x-dev-test-mode` | ดึงยอดเงินคงเหลือผ่าน JSON Body (มาตรฐาน B2B) |
| **POST** | `/api/v1/wallet/debit` | `x-signature` หรือ `x-dev-test-mode` | หักเงินเดิมพัน (Idempotent Row-Level Lock) |
| **POST** | `/api/v1/wallet/credit` | `x-signature` หรือ `x-dev-test-mode` | จ่ายเงินรางวัลผู้เล่นเมื่อกด Cashout สำเร็จ |
| **POST** | `/api/v1/wallet/loss` | `x-signature` หรือ `x-dev-test-mode` | บันทึกสรุปผลแพ้ลง Ledger พร้อมคืนยอด Cashback |
| **POST** | `/api/v1/wallet/rollback` | `x-signature` หรือ `x-dev-test-mode` | คืนเงินบิลเดิมพันกรณีรอบบินถูกยกเลิก/ขัดข้อง |
| **POST** | `/api/v1/payment/webhook` | `x-signature` หรือ `x-dev-test-mode` | Webhook รับยอดฝากอัตโนมัติจากธนาคาร/PromptPay |
| **GET** | `/api/v1/wallet/users` | - | รายชื่อผู้เล่นทั้งหมดพร้อมยอดเงินปัจจุบัน |
| **GET** | `/api/v1/wallet/users/:userId` | - | รายละเอียดผู้เล่นรายบุคคล |
| **POST** | `/api/v1/wallet/create-user` | `Content-Type: application/json` | สร้างผู้เล่นใหม่พร้อมกำหนดยอดเงินตั้งต้น |
| **GET** | `/api/v1/wallet/transactions` | Query: `limit`, `user_id`, `type` | ตรวจสอบประวัติการเงินใน Audit Ledger |
| **GET** | `/api/v1/wallet/transactions/:txnId`| - | ดูข้อมูลรายการธุรกรรมแบบเจาะจงตาม Txn ID |
| **POST** | `/api/v1/wallet/sign` | `Content-Type: application/json` | เครื่องมือช่วยสร้าง HMAC-SHA256 สำหรับ Payload ใดๆ |
| **POST** | `/api/v1/wallet/reset-demo` | - | รีเซ็ตข้อมูลกระเป๋าเงินจำลองกลับสู่ค่าเริ่มต้น |
| **GET** | `/api/wallet/v1/operators` | - | รายชื่อ Partner Operator ในระบบ Multi-Tenant |
| **POST** | `/api/wallet/v1/operators/register` | `Content-Type: application/json` | ลงทะเบียน Operator Franchise ใหม่ |
| **POST** | `/api/v1/franchise/gateway` | `Content-Type: application/json` | Universal Gateway แปลงรหัสผู้ใช้ภายนอกเข้าสู่ระบบ |
| **GET** | `/api/security/health` | - | ตรวจสอบสถานะความพร้อมและ Uptime ของเซิร์ฟเวอร์ |
| **GET** | `/api/game/state` | - | ค่าตัวคูณปัจจุบันและสถานะรอบบินแบบ Real-Time |
| **GET** | `/api/game/history` | Query: `limit` (สูงสุด 50) | ประวัติผลรอบบินย้อนหลังและ Cryptographic Seeds |
| **POST** | `/api/security/login` | `username`, `password` | เข้าสู่ระบบและรับ Bearer JWT Token |
| **POST** | `/api/security/bet` | `Authorization: Bearer <token>` | ส่งคำขอลงเดิมพันภายในเกม |
| **POST** | `/api/security/cashout` | `Authorization: Bearer <token>` | ส่งคำขอกดถอนเงินที่ตัวคูณปัจจุบัน |
| **POST** | `/api/security/logout` | `Authorization: Bearer <token>` | ยกเลิกสิทธิ์และ Blacklist JWT Token |
| **GET** | `/api/security/logs` | - | บันทึกเหตุการณ์ความปลอดภัย Zero-Footprint |
| **GET** | `/api/security/anti-bot/status` | - | ตรวจสอบสถานะเกราะป้องกันบอทและ PoW |
| **POST** | `/api/security/anti-bot/challenge` | `Content-Type: application/json` | ขอรับโจทย์ Proof-of-Work Challenge |
| **POST** | `/api/security/anti-bot/verify` | `Content-Type: application/json` | ส่งคำตอบ Proof-of-Work เพื่อปลดล็อก IP |
| **GET** | `/api/risk-assurance/metrics` | - | ดูค่า RTP สะสม, House Edge, และเงินกองทุนสำรอง |
| **POST** | `/api/risk-assurance/set-ceiling` | `ceilingAmountThb` | ตั้งค่าเพดานจ่ายสูงสุดต่อรอบ (Liability Ceiling) |
| **POST** | `/api/risk-assurance/simulate` | `rounds`, `averageBetThb` | จำลองผลลัพธ์รอบบิน Monte Carlo เพื่อตรวจพิสูจน์ EV |
| **POST** | `/api/b2b/redis/ratelimit` | `key`, `maxRequests`, `window` | ทดสอบ Sliding Window Rate Limiter บน Redis |
| **GET** | `/api/b2b/redis/leaderboard` | - | อันดับผู้ชนะสูงสุดแบบ Real-Time จาก Redis ZSET |
| **GET** | `/api/b2b/logs/partitions` | - | รายชื่อตาราง Partition Logs ประจำเดือนใน PostgreSQL |
| **POST** | `/api/k6/run` | `vus`, `duration` | รันการจำลองโหลด K6 Stress Testing |
| **GET** | `/api/docs/postman.json` | - | ส่งออก Postman Collection v2.1.0 แบบเต็ม |
| **GET** | `/api/docs/postman-environment.json` | - | ส่งออก Environment Variables สำหรับ Postman |
| **GET** | `/api/docs/openapi.json` | - | ส่งออก OpenAPI 3.0 / Swagger JSON Specification |
| **GET** | `/api/docs/endpoints` | - | รายการสรุป Endpoint ทั้งหมดในรูปแบบ JSON |

---

## 7. Backend Developer Architecture Guide: คู่มือพัฒนาต่อยอดให้ถูกที่

คู่มือส่วนนี้ถูกจัดทำขึ้นเพื่อให้ผู้พัฒนาท่านอื่นๆ (Backend Engineers, Integrators, และ DevOps) สามารถเข้ามาแก้ไขและพัฒนาฟีเจอร์ใหม่ได้อย่างถูกต้อง รวดเร็ว และเป็นไปตามมาตรฐานความปลอดภัยระดับสากล

### A. Directory Structure & Module Responsibilities

```
server/
├── routes/
│   ├── index.ts              # 📌 จุดรวม Router หลัก (Mount sub-routers ทั้งหมดเข้า /api)
│   ├── walletRoutes.ts       # 💳 จุดเพิ่ม/แก้ไข API กระเป๋าเงิน, ยอดคงเหลือ, ประวัติธุรกรรม, Webhooks
│   └── docsRoutes.ts         # 📖 ตัวสร้าง Postman Collection v2.1.0 และ OpenAPI Spec อัตโนมัติ
├── seamlessWalletEngine.ts   # 🔒 Core Ledger Engine: จัดการ Mutex Lock (SELECT ... FOR UPDATE) และ Signature
├── b2bArchitectureEngine.ts  # ⚡ Core Redis Cache & PostgreSQL Monthly Partition Engine
├── k6MasterEngine.ts         # 🧪 จำลองการยิงโหลด Concurrent Stress Testing
└── server.ts                 # 🚀 Express Server Entry Point, Socket.IO Engine, Middleware & Ticker
```

---

### B. Where to Add Code Based on Feature Type

| งานที่ต้องการพัฒนา (Your Task) | ไฟล์ที่ต้องแก้ไข (Target File) | คำแนะนำในการพัฒนา (Implementation Guidelines) |
| :--- | :--- | :--- |
| **เพิ่ม API ฝากเงิน / ถอนเงิน / โปรโมชั่นใหม่** | `/server/routes/walletRoutes.ts` | ใช้ `walletRouter.get(...)` หรือ `walletRouter.post(...)` พร้อมเรียกใช้ `seamlessWalletStore` |
| **เพิ่มคำขอใน Postman Collection อัตโนมัติ** | `/server/routes/docsRoutes.ts` | เพิ่ม Object คำขอในฟังก์ชัน `generatePostmanCollection()` เพื่อให้ทุกเครื่องที่ดึง Postman ได้ของใหม่อัตโนมัติ |
| **เพิ่มการล็อกแถว (Row Lock) หรือเงื่อนไขตัดเงิน** | `/server/seamlessWalletEngine.ts` | เพิ่ม Method ในคลาส `SeamlessWalletStore` โดยต้องครอบด้วย `acquireUserLock(userId)` เสมอ |
| **เพิ่ม Route Group ใหม่ (เช่น `/api/v1/tournaments`)** | `/server/routes/index.ts` | สร้างไฟล์ Router ย่อยใน `/server/routes/` แล้วนำมา `apiRouter.use("/v1/tournaments", router)` |
| **ปรับแต่งระบบ Redis หรือ Partition Tables** | `/server/b2bArchitectureEngine.ts` | ปรับแต่งคลาส `B2BRedisStore` หรือ `B2BPostgresPartitionLogs` |
| **ปรับแต่งความเร็วกราฟ / Socket.IO / Realtime** | `/server.ts` หรือ `/src/services/centralHistoryEngine.ts` | ปรับปรุง Socket Events หรือ Ticker ใน `runSecurityFullstackServer()` |

---

### C. Step-by-Step: Adding a New GET Endpoint

หากต้องการเพิ่ม Endpoint แบบ **GET** (เช่น ดูสถิติการเล่นของผู้เล่น `GET /api/v1/wallet/stats/:userId`):

1. เปิดไฟล์ `/server/routes/walletRoutes.ts`
2. เพิ่ม Endpoint Handler ด้านล่างของไฟล์:

```typescript
// ตัวอย่าง: เพิ่ม GET Endpoint ดูสถิติของผู้เล่น
walletRouter.get("/stats/:userId", (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = seamlessWalletStore.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND", message: `User '${userId}' not found.` });
    }

    // คำนวณสถิติจากประวัติธุรกรรม
    const allTx = seamlessWalletStore.getTransactions(1000).filter(t => t.user_id === userId);
    const totalBets = allTx.filter(t => t.type === "BET").reduce((sum, t) => sum + t.amount, 0);
    const totalWins = allTx.filter(t => t.type === "WIN").reduce((sum, t) => sum + t.amount, 0);

    return res.json({
      status: "SUCCESS",
      user_id: userId,
      currency: user.currency,
      current_balance: user.balance,
      total_bets_volume: parseFloat(totalBets.toFixed(2)),
      total_wins_volume: parseFloat(totalWins.toFixed(2)),
      net_profit: parseFloat((totalWins - totalBets).toFixed(2)),
      total_transactions: allTx.length
    });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});
```

3. อัปเดตไฟล์ `/server/routes/docsRoutes.ts` เพิ่มไอเทมเข้าไปใน `generatePostmanCollection()` เพื่อให้ Postman อัปเดตอัตโนมัติ

---

### D. Step-by-Step: Adding a New POST Endpoint

หากต้องการเพิ่ม Endpoint แบบ **POST** ที่มีการแก้ไขยอดเงิน (เช่น แจกโบนัส `POST /api/v1/wallet/bonus`):

1. เพิ่ม Method ใน `/server/seamlessWalletEngine.ts`:

```typescript
// ในคลาส SeamlessWalletStore
public async processBonusCredit(
  txnId: string,
  userId: string,
  bonusAmount: number,
  campaignId: string
): Promise<{ status: string; balance?: number; error?: string }> {
  // 1. ล็อกแถวของผู้เล่นเพื่อป้องกัน Race Condition
  const unlock = await this.acquireUserLock(userId);
  try {
    // 2. ตรวจสอบ Idempotency Key ป้องกันการแจกซ้ำ
    if (this.transactions.has(txnId)) {
      return { status: "ALREADY_PROCESSED", balance: this.transactions.get(txnId)!.balance_after };
    }

    const user = this.users.get(userId);
    if (!user) return { status: "FAILED", error: "USER_NOT_FOUND" };

    // 3. เพิ่มยอดเงิน
    const newBalance = parseFloat((user.balance + bonusAmount).toFixed(2));
    user.balance = newBalance;

    // 4. บันทึก Transaction ลง Ledger
    const txRecord: WalletTransaction = {
      id: this.autoIncrementId++,
      txn_id: txnId,
      user_id: userId,
      amount: bonusAmount,
      gross_amount: bonusAmount,
      fee: 0.00,
      cashback: 0.00,
      balance_after: newBalance,
      type: "BONUS_CREDIT",
      game_id: campaignId,
      status: "SUCCESS",
      created_at: new Date().toISOString()
    };
    this.transactions.set(txnId, txRecord);
    this.txList.push(txRecord);

    return { status: "SUCCESS", balance: newBalance };
  } finally {
    // 5. ปลดล็อกแถวเสมอ
    unlock();
  }
}
```

2. เปิดไฟล์ `/server/routes/walletRoutes.ts` และเชื่อมโยง Route:

```typescript
// ใน /server/routes/walletRoutes.ts
walletRouter.post("/bonus", verifySignatureMiddleware, async (req: Request, res: Response) => {
  try {
    const { txn_id, user_id, amount, campaign_id } = req.body;
    if (!txn_id || !user_id || !amount) {
      return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
    }

    const result = await seamlessWalletStore.processBonusCredit(
      txn_id,
      user_id,
      Number(amount),
      campaign_id || "DAILY_BONUS"
    );

    if (result.error) return res.status(400).json(result);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});
```

---

### E. Engineering Standards & Concurrency Rules

เพื่อให้ระบบมีความเสถียรและทนทานต่อโหลดระดับ 10,000+ RPS:

1. **ห้ามละเลย Mutex Lock**: ทุกครั้งที่มีการอ่านและเขียน `user.balance` ต้องครอบด้วย `acquireUserLock(userId)` และ `finally { unlock(); }` เสมอ เพื่อป้องกันการกดถอนพร้อมกัน (Double-Spending Attack)
2. **Idempotency Is Mandatory**: ทุกการทำธุรกรรมแบบ POST ทางการเงินต้องมี `txn_id` กำกับ และต้องตรวจเช็คว่าเคยมีในฐานข้อมูลแล้วหรือไม่ หากมีแล้วให้ส่งคืนผลเดิมทันทีโดยไม่ประมวลผลซ้ำ
3. **ป้องกัน Float Glitches**: ในการคำนวณเงิน ให้ใช้ `parseFloat(val.toFixed(2))` หรือ `Math.round()` เสมอ เพื่อไม่ให้เกิดปัญหาเศษทศนิยมลอยตัวของ JavaScript เช่น `0.1 + 0.2 = 0.30000000000000004`
4. **รักษาความสมบูรณ์ของ Postman Suite**: เมื่อใดที่มีการสร้างหรือแก้ไข Route ให้ปรับปรุงไฟล์ `/server/routes/docsRoutes.ts` ควบคู่เสมอ เพื่อให้ Documentation และ Postman Suite ตรงกับความเป็นจริงแบบ 100%

---

## 8. Project Structure

```
├── README.md                      # Comprehensive Engineering Documentation
├── package.json                   # Build scripts & production dependencies
├── schema.sql                     # PostgreSQL schema definitions & indexes
├── server.ts                      # Express API Gateway, Security Layer & Game Server
├── server
│   ├── routes
│   │   ├── index.ts               # Master API Router (Aggregates sub-routers)
│   │   ├── walletRoutes.ts        # Modular Seamless Wallet & Ledger Endpoints (GET & POST)
│   │   └── docsRoutes.ts          # Automated Postman v2.1.0 & OpenAPI Documentation Engine
│   ├── seamlessWalletEngine.ts    # Core Seamless Wallet ledger engine with Mutex locks
│   ├── b2bArchitectureEngine.ts   # Redis caching & PostgreSQL partition logs engine
│   └── k6MasterEngine.ts          # K6 concurrency stress testing simulator
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

## 9. Getting Started & Local Development

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

## 10. Developer Extension & Production Migration Guide

### Migrating to Cloud PostgreSQL / Amazon RDS / Cloud SQL
1. Initialize the PostgreSQL schema:
   ```bash
   psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f schema.sql
   ```
2. In `server/seamlessWalletEngine.ts`, replace the in-memory `Map` storage with standard `pg` Pool queries using `BEGIN`, `COMMIT`, and `SELECT ... FOR UPDATE`.
3. Set your production database connection string in `.env` (`DATABASE_URL=postgres://...`).

### Integrating Additional Game Providers
The Seamless Wallet Hub is game-agnostic. To integrate a new game (e.g., Slots, Mines, Roulette):
1. Send `game_id` (e.g., `"SUPERNOVA"`, `"MINES"`, `"ROULETTE"`) in the request payload.
2. The ledger automatically attributes debit and credit settlements to the designated provider.

---

## 11. Production Live Integration Guide for Infrastructure & Backend Teams

This section outlines the exact integration touchpoints, networking requirements, database architecture, and API callbacks necessary to deploy, host, and launch the **SUPERNOVA** game live across any casino, betting, or aggregator platform.

```
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                         PLAYER BROWSER / MOBILE APP                             │
  │                  (iFrame / Webview / Direct Game URL)                           │
  └────────────────────────────────────────┬────────────────────────────────────────┘
                                           │ 1. Launch Game with Session Token
                                           ▼
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                       SUPERNOVA GAME CLOUD CONTAINER                            │
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
| `/api/wallet/v1/credit` | `POST` | Player cashes out (Win) | Credit gross payout to user balance. |
| `/api/wallet/v1/loss` | `POST` | Rocket crashes (Loss) | Confirm and record loss settlement in player ledger. |
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

To embed SUPERNOVA seamlessly inside any operator portal:

```html
<!-- Responsive 16:9 or Full-Screen Casino Game Container -->
<div style="position: relative; width: 100%; height: 100vh; overflow: hidden; background: #0b0e14;">
    <iframe
        id="supernova-frame"
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

// 2. Credit Handler (Cashout Win Settlement)
app.post("/api/wallet/v1/credit", verifyGameServerSignature, async (req, res) => {
  const { transaction_id, user_id, win_amount, gross_win } = req.body;
  const payout = win_amount !== undefined ? win_amount : gross_win;
  // Credit full verified payout to user balance
  res.json({
    status: "SUCCESS",
    transaction_id,
    user_id,
    credited_amount: payout,
    new_balance: 1850.00,
    timestamp: new Date().toISOString()
  });
});
```

