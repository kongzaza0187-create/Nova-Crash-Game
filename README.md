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
4. [API Reference & Endpoint Specifications](#4-api-reference--endpoint-specifications)
   - [Mobile Banking Deposit Webhook](#1-mobile-banking-deposit-webhook)
   - [Wallet Balance Inquiry](#2-wallet-balance-inquiry)
   - [Wallet Debit (Place Bet)](#3-wallet-debit-place-bet)
   - [Wallet Credit (Win Multiplier Settlement)](#4-wallet-credit-win-multiplier-settlement)
   - [Wallet Loss Settlement (Instant 10% Cashback)](#5-wallet-loss-settlement-instant-10-cashback)
   - [Wallet Rollback (Void / Refund Bet)](#6-wallet-rollback-void--refund-bet)
   - [Transaction Ledger Audit Trail](#7-transaction-ledger-audit-trail)
   - [Game Security & Provably Fair Endpoints](#8-game-security--provably-fair-endpoints)
5. [Project Structure](#5-project-structure)
6. [Getting Started & Local Development](#6-getting-started--local-development)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Configuration](#environment-configuration)
   - [Running Dev Server & Production Builds](#running-dev-server--production-builds)
7. [Developer Extension & Production Migration Guide](#7-developer-extension--production-migration-guide)

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

## 4. API Reference & Endpoint Specifications

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
* `POST /api/security/round/start`: Generates round seeds with SHA-256 pre-committed hashes.
* `POST /api/security/bet`: Validates player bet against session limits and rate controllers.
* `POST /api/security/cashout`: Settle multiplier payout against server-authoritative flight curve.
* `GET /api/security/analytics/insights`: Returns RTP metrics, risk thresholds, and active cycle indices.

---

## 5. Project Structure

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

## 6. Getting Started & Local Development

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

## 7. Developer Extension & Production Migration Guide

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
