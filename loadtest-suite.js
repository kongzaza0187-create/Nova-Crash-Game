import http from 'k6/http';
import { check, sleep, group } from 'k6';
import crypto from 'k6/crypto';

// K6 Load & Stress Test Configuration
// Simulating concurrent players placing bets, cashing out, losing, and refunding
export const options = {
  scenarios: {
    // 1. High Concurrency Spike Test
    wallet_concurrency: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '5s', target: 25 },
        { duration: '10s', target: 50 },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '2s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<400'], // 95% of requests must complete within 200ms
    http_req_failed: ['rate<0.01'], // Error rate under 1%
  },
};

const BASE_URL = 'http://localhost:3000';
const SECRET_KEY = 'YOUR_SUPER_SECRET_HMAC_KEY';

function signPayload(payload) {
  const jsonStr = JSON.stringify(payload);
  return crypto.hmac('sha256', SECRET_KEY, jsonStr, 'hex');
}

export default function () {
  const userId = `USER_TH_001`;
  const uniqueTxnId = `TXN_K6_${__VU}_${__ITER}_${Date.now()}`;
  const betAmount = 100;

  group('1. Query Wallet Balance', function () {
    const payload = { user_id: userId };
    const signature = signPayload(payload);

    const res = http.post(`${BASE_URL}/api/wallet/v1/balance`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
      },
    });

    check(res, {
      'Balance Query Status 200': (r) => r.status === 200,
      'Has valid balance number': (r) => JSON.parse(r.body).balance !== undefined,
    });
  });

  group('2. Idempotent Debit / Bet Placement', function () {
    const payload = {
      txn_id: uniqueTxnId,
      user_id: userId,
      amount: betAmount,
      game_id: 'SKY_RUSH',
      operator_id: 'OP_BOLLY_MAIN',
    };
    const signature = signPayload(payload);

    const res = http.post(`${BASE_URL}/api/wallet/v1/bet`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
      },
    });

    check(res, {
      'Debit Status 200': (r) => r.status === 200,
      'Debit Success True': (r) => JSON.parse(r.body).status === 'SUCCESS',
    });

    // TEST IDEMPOTENCY: Replay identical transaction ID
    const replayRes = http.post(`${BASE_URL}/api/wallet/v1/bet`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
      },
    });

    check(replayRes, {
      'Idempotent Replay 200': (r) => r.status === 200,
      'Duplicate Bet Ignored': (r) => JSON.parse(r.body).is_duplicate === true,
    });
  });

  group('3. Settlement: Win (41% cohort) or Loss with Cashback (59% cohort)', function () {
    const isWinner = Math.random() < 0.41;
    const winTxnId = `WIN_${uniqueTxnId}`;
    const lossTxnId = `LOSS_${uniqueTxnId}`;

    if (isWinner) {
      const winMultiplier = (1.2 + Math.random() * 2.5);
      const winAmount = Math.round(betAmount * winMultiplier);
      const payload = {
        txn_id: winTxnId,
        user_id: userId,
        win_amount: winAmount,
        game_id: 'SKY_RUSH',
        operator_id: 'OP_BOLLY_MAIN',
      };
      const signature = signPayload(payload);

      const res = http.post(`${BASE_URL}/api/wallet/v1/win`, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
          'x-signature': signature,
        },
      });

      check(res, {
        'Win Settlement 200': (r) => r.status === 200,
        'Win Net Amount Calculated': (r) => JSON.parse(r.body).net_win_credited !== undefined,
      });
    } else {
      const payload = {
        txn_id: lossTxnId,
        bet_txn_id: uniqueTxnId,
        user_id: userId,
        loss_amount: betAmount,
        game_id: 'SKY_RUSH',
        operator_id: 'OP_BOLLY_MAIN',
      };
      const signature = signPayload(payload);

      const res = http.post(`${BASE_URL}/api/wallet/v1/loss`, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
          'x-signature': signature,
        },
      });

      check(res, {
        'Loss Settlement 200': (r) => r.status === 200,
        'Cashback 10% Credited': (r) => JSON.parse(r.body).cashback_credited === 10,
      });
    }
  });

  group('4. Risk Assurance Metrics Verification', function () {
    const res = http.get(`${BASE_URL}/api/risk-assurance/metrics`);
    check(res, {
      'Risk Engine Status 200': (r) => r.status === 200,
      'Theoretical House Edge 37%': (r) => JSON.parse(r.body).theoreticalHouseEdge === '37.0%',
      'Theoretical RTP 63%': (r) => JSON.parse(r.body).theoreticalRTP === '63.0%',
    });
  });

  sleep(0.1);
}
