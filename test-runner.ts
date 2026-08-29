import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';
const SECRET_KEY = 'YOUR_SUPER_SECRET_HMAC_KEY';

function signPayload(payload: any): string {
  const jsonStr = JSON.stringify(payload);
  return crypto.createHmac('sha256', SECRET_KEY).update(jsonStr).digest('hex');
}

async function request(path: string, body: any, customHeaders: Record<string, string> = {}) {
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

async function runAllTests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING iGAMING SEAMLESS WALLET LOGIC & LOAD TEST SUITE');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, errorDetail: string = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} -> ${errorDetail}`);
      failed++;
    }
  }

  // 1. Authenticate Test
  console.log('\n--- 1. Authenticate & Handshake Test ---');
  const authRes = await request('/api/wallet/v1/authenticate', {
    operator_id: 'OP_BOLLY_MAIN',
    user_id: 'USER_TH_001',
    token: 'test_token_123'
  });
  assert('Authenticate Endpoint returns 200', authRes.status === 200);
  assert('User has valid initial balance', typeof authRes.data.balance === 'number');
  assert('Session token generated', typeof authRes.data.session_token === 'string');

  // 2. Query Balance Test
  console.log('\n--- 2. Query Balance Test ---');
  const balRes = await request('/api/wallet/v1/balance', { user_id: 'USER_TH_001' });
  assert('Balance query returns 200', balRes.status === 200);
  const initialBalance = balRes.data.balance;
  console.log(`Initial Balance: ${initialBalance}`);

  // 3. Debit / Place Bet Test
  console.log('\n--- 3. Debit / Place Bet & Idempotency Test ---');
  const testTxnId = 'TXN_TEST_LOAD_' + Date.now();
  const debitRes = await request('/api/wallet/v1/bet', {
    txn_id: testTxnId,
    user_id: 'USER_TH_001',
    amount: 500,
    game_id: 'SKY_RUSH',
    operator_id: 'OP_BOLLY_MAIN'
  });
  assert('Debit returns 200 SUCCESS', debitRes.status === 200 && debitRes.data.status === 'SUCCESS');
  assert('Balance accurately deducted by 500', debitRes.data.balance === initialBalance - 500);

  // 4. Idempotency Check (re-sending same txn_id)
  const duplicateDebitRes = await request('/api/wallet/v1/bet', {
    txn_id: testTxnId,
    user_id: 'USER_TH_001',
    amount: 500,
    game_id: 'SKY_RUSH',
    operator_id: 'OP_BOLLY_MAIN'
  });
  assert('Duplicate debit processed safely with alreadyProcessed flag', duplicateDebitRes.data.alreadyProcessed === true || duplicateDebitRes.data.status === 'SUCCESS');
  assert('Balance not deducted twice on duplicate request', duplicateDebitRes.data.balance === initialBalance - 500);

  // 5. Win with 3% House Commission Fee
  console.log('\n--- 4. Credit / Win Settlement (3% Commission) ---');
  const winTxnId = 'WIN_' + Date.now();
  const winRes = await request('/api/wallet/v1/win', {
    txn_id: winTxnId,
    user_id: 'USER_TH_001',
    win_amount: 1000,
    game_id: 'SKY_RUSH',
    operator_id: 'OP_BOLLY_MAIN'
  });
  assert('Win settlement returns 200', winRes.status === 200 && winRes.data.status === 'SUCCESS');
  assert('3% House fee collected accurately (30.00)', winRes.data.fee_deducted_3percent === 30);
  assert('Net win credited accurately (970.00)', winRes.data.net_win_added === 970);

  // 6. Loss Settlement with 10% Cashback
  console.log('\n--- 5. Loss Settlement (10% Cashback) ---');
  const lossTxnId = 'LOSS_' + Date.now();
  const lossRes = await request('/api/wallet/v1/loss', {
    txn_id: lossTxnId,
    bet_txn_id: testTxnId,
    user_id: 'USER_TH_001',
    loss_amount: 500,
    game_id: 'SKY_RUSH',
    operator_id: 'OP_BOLLY_MAIN'
  });
  assert('Loss settlement returns 200', lossRes.status === 200 && lossRes.data.status === 'SUCCESS');
  assert('10% Cashback credited accurately (50.00)', lossRes.data.cashback_added_10percent === 50);

  // 7. Rollback / Refund Test
  console.log('\n--- 6. Rollback / Cancel Bet Test ---');
  // First place a new bet to rollback
  const rollbackBetTxn = 'BET_FOR_ROLLBACK_' + Date.now();
  await request('/api/wallet/v1/bet', {
    txn_id: rollbackBetTxn,
    user_id: 'USER_TH_001',
    amount: 200,
    game_id: 'SKY_RUSH',
    operator_id: 'OP_BOLLY_MAIN'
  });
  const balBeforeRollback = (await request('/api/wallet/v1/balance', { user_id: 'USER_TH_001' })).data.balance;

  const rollbackRes = await request('/api/wallet/v1/rollback', {
    txn_id: 'ROLLBACK_' + Date.now(),
    ref_txn_id: rollbackBetTxn,
    user_id: 'USER_TH_001',
    operator_id: 'OP_BOLLY_MAIN'
  });
  assert('Rollback returns 200', rollbackRes.status === 200 && rollbackRes.data.status === 'SUCCESS');
  assert('Exact 200.00 refunded back to balance', rollbackRes.data.refunded_amount === 200);
  assert('Balance increased by exactly 200', rollbackRes.data.balance === balBeforeRollback + 200);

  // 8. Risk Assurance Engine Metrics & Simulation
  console.log('\n--- 7. Risk Assurance Engine & Cohort Logic Test ---');
  const metricsRes = await fetch(`${BASE_URL}/api/risk-assurance/metrics`).then(r => r.json());
  assert('Risk engine target house edge is 25.0%', metricsRes.targetHouseEdgePercent === 25);
  assert('Risk engine target RTP is 75.0%', metricsRes.targetRTPPercent === 75);
  assert('Risk assurance liability ceiling configured', typeof metricsRes.riskCeilingTHB === 'number');

  const cohortSim = await fetch(`${BASE_URL}/api/risk-assurance/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerCount: 100, baseWager: 100 })
  }).then(r => r.json());
  assert('Cohort simulation returns 100 players', cohortSim.totalPlayers === 100);
  assert('Cohort losers count is recorded (~45-65 players)', cohortSim.losersCount >= 40 && cohortSim.losersCount <= 70);
  assert('Cohort winners count is recorded (~35-60 players)', cohortSim.winnersCount >= 30 && cohortSim.winnersCount <= 60);
  assert('Positive operator gross house profit generated (Positive House EV)', cohortSim.grossHouseProfitTHB > 0);

  // 9. High-Concurrency Stress Load Test (100 concurrent requests)
  console.log('\n--- 8. High-Concurrency Stress Test (100 Concurrent Debits) ---');
  // Create a high-balance load test user
  await fetch(`${BASE_URL}/api/v1/wallet/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'USER_LOAD_STRESS',
      username: 'LoadStressPilot_999',
      balance: 1000000
    })
  });

  const concurrencyCount = 100;
  const startTime = Date.now();
  const promises = Array.from({ length: concurrencyCount }, (_, i) => {
    const txn = `CONCURRENT_TXN_${Date.now()}_${i}_${Math.random()}`;
    return request('/api/wallet/v1/bet', {
      txn_id: txn,
      user_id: 'USER_LOAD_STRESS',
      amount: 10,
      game_id: 'SKY_RUSH',
      operator_id: 'OP_BOLLY_MAIN'
    });
  });

  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;
  const successfulRequests = results.filter(r => r.status === 200 && r.data.status === 'SUCCESS').length;
  const rps = ((concurrencyCount / duration) * 1000).toFixed(1);

  assert(`Processed ${concurrencyCount} concurrent debit requests in ${duration}ms (${rps} req/sec)`, successfulRequests === concurrencyCount);

  // 10. Swagger OpenAPI & Postman Specification Integrity
  console.log('\n--- 9. API Docs & Postman Collection Delivery Test ---');
  const openApiRes = await fetch(`${BASE_URL}/api/docs/openapi.json`).then(r => r.json());
  assert('OpenAPI specification valid and served', openApiRes.openapi === '3.0.3');
  assert('OpenAPI defines all required wallet paths', Boolean(openApiRes.paths && Object.keys(openApiRes.paths).length >= 5));

  const postmanRes = await fetch(`${BASE_URL}/api/docs/postman.json`).then(r => r.json());
  assert('Postman Collection v2.1.0 valid and served', Boolean(postmanRes.item && postmanRes.item.length >= 6));

  console.log('\n===============================================================');
  console.log(`🏁 TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
