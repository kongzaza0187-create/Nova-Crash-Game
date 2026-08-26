import http from "k6/http";
import { check, sleep } from "k6";
import crypto from "k6/crypto";

export const options = {
  stages: [
    { duration: "30s", target: 200 },  // Ramp-up to 200 VUs
    { duration: "1m", target: 500 },   // Ramp-up to 500 VUs
    { duration: "2m", target: 1000 },  // Peak load: 1,000 VUs concurrency
    { duration: "30s", target: 0 }     // Ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<150"], // 95% of requests must complete within 150ms
    http_req_failed: ["rate<0.01"]    // Error rate must be less than 1%
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const HMAC_SECRET = __ENV.HMAC_SECRET_KEY || "YOUR_SUPER_SECRET_HMAC_KEY";

function generateSignature(payloadString) {
  return crypto.hmac("sha256", HMAC_SECRET, payloadString, "hex");
}

export default function () {
  const userId = `USER_TH_${__VU % 50}`; // 50 concurrent simulated users

  // 1. Balance Query
  const balancePayload = JSON.stringify({ user_id: userId });
  const balanceHeaders = {
    "Content-Type": "application/json",
    "X-Signature": generateSignature(balancePayload)
  };

  const resBalance = http.post(`${BASE_URL}/api/seamless-wallet/balance`, balancePayload, {
    headers: balanceHeaders
  });

  check(resBalance, {
    "balance status is 200": (r) => r.status === 200,
    "balance returns valid payload": (r) => JSON.parse(r.body).status === "SUCCESS"
  });

  sleep(0.1);

  // 2. High-Concurrency Bet Debit
  const txnId = `BET_${Date.now()}_VU${__VU}_ITER${__ITER}_${Math.floor(Math.random() * 10000)}`;
  const debitPayload = JSON.stringify({
    txn_id: txnId,
    user_id: userId,
    amount: 100.0,
    game_id: "SKY_RUSH"
  });

  const debitHeaders = {
    "Content-Type": "application/json",
    "X-Signature": generateSignature(debitPayload)
  };

  const resDebit = http.post(`${BASE_URL}/api/seamless-wallet/debit`, debitPayload, {
    headers: debitHeaders
  });

  check(resDebit, {
    "debit status is 200 or 400 (insufficient)": (r) => r.status === 200 || r.status === 400
  });

  sleep(0.2);

  // 3. Settle Win Credit (if debit succeeded)
  if (resDebit.status === 200) {
    const winTxnId = `WIN_${Date.now()}_VU${__VU}_ITER${__ITER}_${Math.floor(Math.random() * 10000)}`;
    const creditPayload = JSON.stringify({
      txn_id: winTxnId,
      user_id: userId,
      amount: 250.0, // 2.5x multiplier payout
      game_id: "SKY_RUSH"
    });

    const creditHeaders = {
      "Content-Type": "application/json",
      "X-Signature": generateSignature(creditPayload)
    };

    const resCredit = http.post(`${BASE_URL}/api/seamless-wallet/credit`, creditPayload, {
      headers: creditHeaders
    });

    check(resCredit, {
      "credit status is 200": (r) => r.status === 200,
      "3% house fee deducted": (r) => {
        const body = JSON.parse(r.body);
        return body.fee_deducted_3percent === 7.5;
      }
    });
  }

  sleep(0.5);
}
