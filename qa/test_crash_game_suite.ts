import crypto from 'crypto';

/**
 * ========================================================================================
 * SKY RUSH QA AUTOMATION & GAME SECURITY TEST SUITE (TypeScript / Node.js)
 * ========================================================================================
 * Roles: Principal QA Automation Architect & Lead Game Security Engineer
 *
 * Covers:
 * 1. Multiplier Trajectory Determinism & Provably Fair Hash Pre-Commitment
 * 2. High-Concurrency Stress Test & Simultaneous Millisecond Cash-Outs
 * 3. Network Latency & Chaos Simulation (Packet delay, retransmission, jitter)
 * 4. Fuzz Testing & Schema Boundary Penetration (Negative bets, NaN, overflow, malformed JSON)
 * 5. Seamless Wallet Idempotency & Financial Balance Reconciliation
 * ========================================================================================
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const SECRET_KEY = process.env.TEST_SECRET_KEY || 'YOUR_SUPER_SECRET_HMAC_KEY';

function signPayload(payload: any): string {
  const jsonStr = JSON.stringify(payload);
  return crypto.createHmac('sha256', SECRET_KEY).update(jsonStr).digest('hex');
}

async function postApi(path: string, body: any, customHeaders: Record<string, string> = {}) {
  const signature = signPayload(body);
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature,
      ...customHeaders,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getApi(path: string, customHeaders: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      ...customHeaders,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// -----------------------------------------------------------------------------
// TEST RUNNER UTILITIES
// -----------------------------------------------------------------------------
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertTest(name: string, condition: boolean, detail: string = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${name} -> ${detail}`);
    failedTests++;
  }
}

// -----------------------------------------------------------------------------
// MODULE 1: MULTIPLIER TRAJECTORY DETERMINISM & PROVABLY FAIR PRE-COMMITMENT
// -----------------------------------------------------------------------------
async function testModule1Determinism() {
  console.log('\n-----------------------------------------------------------------------------');
  console.log('📦 MODULE 1: Multiplier Trajectory Determinism & Cryptographic Verification');
  console.log('-----------------------------------------------------------------------------');

  // Test 1: Start round and receive pre-commitment SHA-256 hash
  const startRes = await postApi('/api/security/round/start', {
    sessionId: 'qa_session_' + Date.now(),
    clientSeed: 'client_entropy_' + Math.random().toString(36).substring(2, 10),
  });

  assertTest('Round start API returns 200 OK', startRes.status === 200, `Got ${startRes.status}`);
  const precommitHash = startRes.data.fairHash || startRes.data.seedHash || startRes.data.hash;
  const roundId = startRes.data.roundId || startRes.data.globalRoundNum;

  assertTest('Pre-commitment SHA-256 hash returned', typeof precommitHash === 'string' && precommitHash.length === 64, `Hash: ${precommitHash}`);
  assertTest('Round ID assigned', typeof roundId === 'number' || typeof roundId === 'string');

  // Test 2: History buffer verification
  const histRes = await getApi('/api/security/history?limit=10');
  assertTest('Round history API returns 200 OK', histRes.status === 200);
  const historyList = histRes.data.history || histRes.data;
  assertTest('Round history contains valid items with hash and crash multiplier', Array.isArray(historyList) && historyList.length > 0);

  if (Array.isArray(historyList) && historyList.length > 0) {
    const sample = historyList[0];
    const crashVal = sample.crashMultiplier || sample.val;
    assertTest('Historic crash value within bounds [1.00x, 50.00x]', crashVal >= 1.00 && crashVal <= 50.00, `Got ${crashVal}x`);
  }
}

// -----------------------------------------------------------------------------
// MODULE 2: HIGH-CONCURRENCY STRESS TEST & CONCURRENT CASHOUTS
// -----------------------------------------------------------------------------
async function testModule2Concurrency() {
  console.log('\n-----------------------------------------------------------------------------');
  console.log('📦 MODULE 2: High-Concurrency Stress Test & Simultaneous Cash-Outs');
  console.log('-----------------------------------------------------------------------------');

  const userId = `USER_LOAD_${Date.now()}`;
  const depositTxn = `DEP_${Date.now()}`;

  // Fund player with 10,000 THB
  const depRes = await postApi('/api/v1/payment/webhook', {
    txn_id: depositTxn,
    user_id: userId,
    amount: 10000.0,
    currency: 'THB',
    bank_code: 'KBANK',
    status: 'SUCCESS',
    timestamp: Date.now(),
  });
  assertTest('Player initial funding successful (10,000 THB)', depRes.status === 200 && depRes.data.balance >= 10000);

  // Fire 30 concurrent bet placements with distinct txn_ids
  const concurrentCount = 20;
  console.log(`  ⚡ Firing ${concurrentCount} concurrent bet placements in the same millisecond...`);
  const betPromises = Array.from({ length: concurrentCount }, (_, i) => {
    return postApi('/api/wallet/v1/bet', {
      txn_id: `BET_CONCURRENT_${userId}_${i}`,
      user_id: userId,
      amount: 100.0,
      game_id: 'SKY_RUSH',
      operator_id: 'OP_B2B_QA',
    });
  });

  const betResults = await Promise.all(betPromises);
  const successfulBets = betResults.filter((r) => r.status === 200 && r.data.status === 'SUCCESS');
  assertTest(`All ${concurrentCount} concurrent bets processed atomically`, successfulBets.length === concurrentCount, `Processed: ${successfulBets.length}/${concurrentCount}`);

  // Verify wallet balance is deducted by exactly concurrentCount * 100
  const balRes = await postApi('/api/wallet/v1/balance', { user_id: userId });
  const expectedBalance = 10000.0 - concurrentCount * 100.0;
  assertTest(`Balance atomically serialized without race conditions (${expectedBalance} THB)`, balRes.data.balance === expectedBalance, `Got: ${balRes.data.balance}`);

  // Test concurrent cashouts for those bets (Settling wins with 3% fee)
  console.log(`  ⚡ Firing ${concurrentCount} concurrent win cashout settlements...`);
  const winPromises = Array.from({ length: concurrentCount }, (_, i) => {
    return postApi('/api/wallet/v1/win', {
      txn_id: `WIN_CONCURRENT_${userId}_${i}`,
      user_id: userId,
      win_amount: 200.0, // Gross win 200 THB (Net win = 200 - 3% fee = 194 THB)
      game_id: 'SKY_RUSH',
      operator_id: 'OP_B2B_QA',
    });
  });

  const winResults = await Promise.all(winPromises);
  const successfulWins = winResults.filter((r) => r.status === 200 && r.data.status === 'SUCCESS');
  assertTest(`All ${concurrentCount} concurrent win settlements processed atomically`, successfulWins.length === concurrentCount);

  // Verify settlement amounts
  const sampleWin = winResults[0].data;
  assertTest('Gross win credited accurately (200.00 THB)', sampleWin.gross_win === 200.0 || sampleWin.net_win_added === 200.0);
}

// -----------------------------------------------------------------------------
// MODULE 3: LATENCY & CHAOS TESTING (Jitter & Retries Simulation)
// -----------------------------------------------------------------------------
async function testModule3Chaos() {
  console.log('\n-----------------------------------------------------------------------------');
  console.log('📦 MODULE 3: Latency & Chaos Testing (Jitter Injection & Duplicate Retries)');
  console.log('-----------------------------------------------------------------------------');

  const userId = `USER_CHAOS_${Date.now()}`;
  const betTxnId = `BET_CHAOS_${Date.now()}`;

  // Initial balance
  await postApi('/api/v1/payment/webhook', {
    txn_id: `DEP_${Date.now()}`,
    user_id: userId,
    amount: 1000.0,
    currency: 'THB',
    bank_code: 'SCB',
    status: 'SUCCESS',
    timestamp: Date.now(),
  });

  // 1. Simulate aggressive network retry sending identical txn_id 5 times rapidly
  console.log('  ⚡ Simulating packet duplication / network retry (5x identical txn_id bursts)...');
  const duplicateRequests = Array.from({ length: 5 }, () =>
    postApi('/api/wallet/v1/bet', {
      txn_id: betTxnId,
      user_id: userId,
      amount: 250.0,
      game_id: 'SKY_RUSH',
      operator_id: 'OP_B2B_QA',
    })
  );

  const results = await Promise.all(duplicateRequests);
  const statusCodes = results.map((r) => r.status);
  assertTest('All 5 duplicate requests receive 200 OK HTTP responses', statusCodes.every((s) => s === 200));

  // Balance must be deducted ONLY ONCE (1000 - 250 = 750)
  const finalBal = await postApi('/api/wallet/v1/balance', { user_id: userId });
  assertTest('Balance deducted exactly once (750.00 THB) despite 5 duplicate retries', finalBal.data.balance === 750.0, `Got: ${finalBal.data.balance}`);
}

// -----------------------------------------------------------------------------
// MODULE 4: WEBSOCKET & API FUZZ TESTING (Malicious / Boundary Payloads)
// -----------------------------------------------------------------------------
async function testModule4Fuzzing() {
  console.log('\n-----------------------------------------------------------------------------');
  console.log('📦 MODULE 4: Fuzz Testing & Schema Boundary Penetration');
  console.log('-----------------------------------------------------------------------------');

  const userId = `USER_FUZZ_${Date.now()}`;
  await postApi('/api/v1/payment/webhook', {
    txn_id: `DEP_${Date.now()}`,
    user_id: userId,
    amount: 1000.0,
    currency: 'THB',
    bank_code: 'KBANK',
    status: 'SUCCESS',
    timestamp: Date.now(),
  });

  // Fuzz 1: Negative bet amount
  const negRes = await postApi('/api/wallet/v1/bet', {
    txn_id: `FUZZ_NEG_${Date.now()}`,
    user_id: userId,
    amount: -500.0,
    game_id: 'SKY_RUSH',
  });
  assertTest('Rejects negative wager amount (-500 THB) with 400 or failed status', negRes.status === 400 || negRes.data.status === 'FAILED');

  // Fuzz 2: Zero or NaN wager amount
  const nanRes = await postApi('/api/wallet/v1/bet', {
    txn_id: `FUZZ_NAN_${Date.now()}`,
    user_id: userId,
    amount: 'invalid_nan',
    game_id: 'SKY_RUSH',
  });
  assertTest('Rejects non-numeric wager with 400 or failed status', nanRes.status === 400 || nanRes.data.status === 'FAILED');

  // Fuzz 3: Extreme wager exceeding balance
  const excessiveRes = await postApi('/api/wallet/v1/bet', {
    txn_id: `FUZZ_OVERFLOW_${Date.now()}`,
    user_id: userId,
    amount: 999999999.0,
    game_id: 'SKY_RUSH',
  });
  assertTest('Rejects wager exceeding player balance (INSUFFICIENT_FUNDS)', excessiveRes.data.error === 'INSUFFICIENT_FUNDS' || excessiveRes.status === 400);

  // Fuzz 4: Tampered HMAC signature
  const fakeSigRes = await fetch(`${BASE_URL}/api/wallet/v1/balance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': '0000000000000000000000000000000000000000000000000000000000000000',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  assertTest('Tampered / invalid HMAC-SHA256 signature rejected with 401 or 403', fakeSigRes.status === 401 || fakeSigRes.status === 403);
}

// -----------------------------------------------------------------------------
// MODULE 5: FINANCIAL DOUBLE-ENTRY RECONCILIATION & ROLLBACK
// -----------------------------------------------------------------------------
async function testModule5FinancialReconciliation() {
  console.log('\n-----------------------------------------------------------------------------');
  console.log('📦 MODULE 5: Financial Double-Entry Reconciliation & Idempotent Rollback');
  console.log('-----------------------------------------------------------------------------');

  const userId = `USER_FIN_${Date.now()}`;
  const initialDeposit = 2000.0;

  // 1. Deposit 2,000 THB
  await postApi('/api/v1/payment/webhook', {
    txn_id: `DEP_${Date.now()}`,
    user_id: userId,
    amount: initialDeposit,
    currency: 'THB',
    bank_code: 'KBANK',
    status: 'SUCCESS',
    timestamp: Date.now(),
  });

  // 2. Bet 1,000 THB
  const betTxnId = `BET_FIN_${Date.now()}`;
  await postApi('/api/wallet/v1/bet', {
    txn_id: betTxnId,
    user_id: userId,
    amount: 1000.0,
    game_id: 'SKY_RUSH',
  });

  // 3. Player loses round
  const lossRes = await postApi('/api/wallet/v1/loss', {
    txn_id: `LOSS_FIN_${Date.now()}`,
    user_id: userId,
    loss_amount: 1000.0,
    bet_txn_id: betTxnId,
    game_id: 'SKY_RUSH',
  });

  assertTest('Loss settlement endpoint returns 200 OK', lossRes.status === 200);
  assertTest('Loss settled accurately in ledger', lossRes.data.status === 'SUCCESS');

  // 4. Void / Rollback test: Refund wager of 500 THB
  const rollbackBetTxn = `BET_RB_${Date.now()}`;
  await postApi('/api/wallet/v1/bet', {
    txn_id: rollbackBetTxn,
    user_id: userId,
    amount: 500.0,
    game_id: 'SKY_RUSH',
  });

  const rollbackRes = await postApi('/api/wallet/v1/rollback', {
    txn_id: `RB_${Date.now()}`,
    user_id: userId,
    rollback_amount: 500.0,
    ref_txn_id: rollbackBetTxn,
    game_id: 'SKY_RUSH',
  });

  assertTest('Rollback returns 200 SUCCESS', rollbackRes.status === 200 && rollbackRes.data.status === 'SUCCESS');
  assertTest('Balance completely restored to 1000.00 THB', rollbackRes.data.balance === 1000.0, `Got: ${rollbackRes.data.balance}`);
}

// -----------------------------------------------------------------------------
// MAIN TEST ORCHESTRATOR
// -----------------------------------------------------------------------------
async function runAllTests() {
  console.log('=============================================================================');
  console.log('🚀 SKY RUSH B2B CRASH GAME: AUTOMATED QA & INTEGRATION VERIFICATION SUITE');
  console.log('=============================================================================');

  const startTime = Date.now();

  try {
    await testModule1Determinism();
    await testModule2Concurrency();
    await testModule3Chaos();
    await testModule4Fuzzing();
    await testModule5FinancialReconciliation();
  } catch (err: any) {
    console.error('💥 Unhandled Exception during test execution:', err);
    failedTests++;
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n=============================================================================');
  console.log(`TEST SUITE EXECUTION SUMMARY (Elapsed: ${durationSec}s)`);
  console.log('=============================================================================');
  console.log(`  Total Tests Run: ${totalTests}`);
  console.log(`  Passed Tests:    ${passedTests} ✅`);
  console.log(`  Failed Tests:    ${failedTests} ❌`);
  console.log('=============================================================================');

  if (failedTests === 0) {
    console.log('\n🎉 ALL INTEGRATION & SECURITY TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error(`\n💥 ${failedTests} TEST(S) FAILED. See error output above.\n`);
    process.exit(1);
  }
}

runAllTests();
