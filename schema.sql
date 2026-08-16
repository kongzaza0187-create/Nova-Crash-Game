-- ============================================================================
-- iGaming Master Franchise Seamless Wallet Database Schema (PostgreSQL)
-- Currency: THB (Thai Baht)
-- Features: Row-level Locking (FOR UPDATE), Idempotency, 10% Cashback, 3% House Fee
-- ============================================================================

-- 1. Users / Players Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- สกุลเงินบาท THB
    currency VARCHAR(10) NOT NULL DEFAULT 'THB',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, SUSPENDED, BLOCKED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Master Transactions Ledger Table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    txn_id VARCHAR(100) UNIQUE NOT NULL,          -- Unique ID สำหรับป้องกันการยิงซ้ำ (Idempotency)
    ref_txn_id VARCHAR(100),                       -- อ้างอิง Transaction เดิม (เช่น บิลเดิมพันสำหรับ LOSS/ROLLBACK)
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(15, 2) NOT NULL,                -- ยอดเงินที่ทำรายการจริง (THB)
    gross_amount NUMERIC(15, 2) DEFAULT 0.00,      -- ยอดก่อนหักค่าธรรมเนียม (Gross Win / Loss)
    fee NUMERIC(15, 2) DEFAULT 0.00,               -- ค่าธรรมเนียม 3% ค่าน้ำ (House Fee / Commission)
    cashback NUMERIC(15, 2) DEFAULT 0.00,          -- ยอดเงินคืน 10% (Cashback)
    balance_after NUMERIC(15, 2) NOT NULL,         -- ยอดเงินคงเหลือหลังทำรายการ (THB)
    type VARCHAR(30) NOT NULL,                     -- 'DEPOSIT_BANKING', 'BET', 'WIN', 'CASHBACK_10%', 'ROLLBACK'
    game_id VARCHAR(50),                           -- ID ของเกม เช่น 'SKY_RUSH_01', 'MINES_SLOT'
    status VARCHAR(20) DEFAULT 'SUCCESS',          -- 'SUCCESS', 'FAILED', 'REJECTED'
    metadata JSONB DEFAULT '{}'::jsonb,            -- ข้อมูลเพิ่มเติม เช่น Bank Info, IP, Round No
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Performance & Idempotency Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_txn_id ON transactions(txn_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ref_txn_id ON transactions(ref_txn_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- 4. Initial Seed Data (Demo Master Franchise Players)
INSERT INTO users (id, username, balance, currency) VALUES 
('USER_TH_001', 'KongZaza_Master', 50000.00, 'THB'),
('USER_TH_002', 'LuckyPilot88', 12500.00, 'THB'),
('USER_TH_003', 'SlotKing_VIP', 25000.00, 'THB')
ON CONFLICT (id) DO NOTHING;
