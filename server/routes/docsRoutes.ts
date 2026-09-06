import { Router, Request, Response } from "express";
import { API_SECRET_KEY } from "../seamlessWalletEngine.js";

export const docsRouter = Router();

/**
 * Generates the complete Postman v2.1.0 Collection JSON for SUPERNOVA API
 */
export function generatePostmanCollection(baseUrl = "{{baseUrl}}") {
  return {
    info: {
      name: "SUPERNOVA — Crash Game Engine & Seamless Wallet API (Complete Postman Suite)",
      _postman_id: "supernova-api-v2-collection",
      description: "Official, fully comprehensive Postman Collection for SUPERNOVA Crash Multiplier Game Engine & iGaming Master Franchise Seamless Wallet API. Includes all GET and POST endpoints with automated HMAC-SHA256 pre-request scripts, sample request payloads, and environment variables.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:3000", type: "string" },
      { key: "apiSecret", value: API_SECRET_KEY, type: "string" },
      { key: "operatorId", value: "OP_BOLLY_MAIN", type: "string" },
      { key: "userId", value: "USER_TH_001", type: "string" },
      { key: "jwtToken", value: "", type: "string" }
    ],
    event: [
      {
        listen: "prerequest",
        script: {
          type: "text/javascript",
          exec: [
            "// ====================================================================",
            "// AUTOMATED HMAC-SHA256 SIGNATURE & DEV BYPASS SCRIPT FOR POSTMAN",
            "// ====================================================================",
            "const apiSecret = pm.collectionVariables.get('apiSecret') || 'YOUR_SUPER_SECRET_HMAC_KEY';",
            "",
            "// 1. Automatically calculate HMAC-SHA256 signature for POST requests with raw body",
            "if (pm.request.method === 'POST' && pm.request.body && pm.request.body.raw) {",
            "    try {",
            "        const rawBody = pm.request.body.raw;",
            "        const signature = CryptoJS.HmacSHA256(rawBody, apiSecret).toString(CryptoJS.enc.Hex);",
            "        pm.request.headers.upsert({ key: 'x-signature', value: signature });",
            "    } catch (e) {",
            "        console.warn('HMAC Generation skipped:', e);",
            "    }",
            "}",
            "",
            "// 2. Set developer test-mode header for frictionless local sandbox testing",
            "if (!pm.request.headers.has('x-dev-test-mode')) {",
            "    pm.request.headers.upsert({ key: 'x-dev-test-mode', value: 'true' });",
            "}"
          ]
        }
      }
    ],
    item: [
      // --------------------------------------------------------------------
      // FOLDER 1: SEAMLESS WALLET & BANKING WEBHOOKS
      // --------------------------------------------------------------------
      {
        name: "1. 💳 Seamless Wallet & Banking API",
        description: "Core iGaming franchise balance and settlement endpoints with row-level locks, idempotent txn_ids, and HMAC-SHA256 signatures.",
        item: [
          {
            name: "[POST] 1.1 Authenticate Player Session",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "x-dev-test-mode", value: "true" }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  operator_id: "{{operatorId}}",
                  user_id: "{{userId}}"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/wallet/authenticate`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "authenticate"]
              },
              description: "Handshake endpoint called by game client or aggregator to verify player token and get initial THB balance."
            }
          },
          {
            name: "[GET] 1.2 Query Wallet Balance (Path Param)",
            request: {
              method: "GET",
              header: [
                { key: "x-dev-test-mode", value: "true" }
              ],
              url: {
                raw: `${baseUrl}/api/v1/wallet/balance/{{userId}}`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "balance", "{{userId}}"]
              },
              description: "Fast GET balance inquiry by user ID in URL path."
            }
          },
          {
            name: "[GET] 1.3 Query Wallet Balance (Query String)",
            request: {
              method: "GET",
              header: [
                { key: "x-dev-test-mode", value: "true" }
              ],
              url: {
                raw: `${baseUrl}/api/v1/wallet/balance?user_id={{userId}}`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "balance"],
                query: [{ key: "user_id", value: "{{userId}}" }]
              },
              description: "Query balance using standard HTTP GET query parameters."
            }
          },
          {
            name: "[POST] 1.4 Query Wallet Balance (JSON Body)",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "x-dev-test-mode", value: "true" }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  user_id: "{{userId}}"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/wallet/balance`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "balance"]
              },
              description: "Standard POST balance request matching iGaming B2B specifications."
            }
          },
          {
            name: "[POST] 1.5 Debit / Place Bet (Idempotent)",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "x-dev-test-mode", value: "true" }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  txn_id: "TXN_DEBIT_{{$timestamp}}",
                  user_id: "{{userId}}",
                  amount: 100.00,
                  game_id: "SUPERNOVA",
                  operator_id: "{{operatorId}}"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/wallet/debit`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "debit"]
              },
              description: "Deducts wager from user balance with row-level lock (FOR UPDATE). Idempotent by txn_id."
            }
          },
          {
            name: "[POST] 1.6 Credit / Win Cashout Settlement",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "x-dev-test-mode", value: "true" }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  txn_id: "TXN_CREDIT_{{$timestamp}}",
                  user_id: "{{userId}}",
                  win_amount: 250.00,
                  game_id: "SUPERNOVA",
                  operator_id: "{{operatorId}}"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/wallet/credit`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "credit"]
              },
              description: "Credits winning amount to user balance upon successful cashout."
            }
          },
          {
            name: "[POST] 1.7 Loss Settlement & Cashback Record",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "x-dev-test-mode", value: "true" }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  txn_id: "TXN_LOSS_{{$timestamp}}",
                  bet_txn_id: "TXN_DEBIT_SAMPLE",
                  user_id: "{{userId}}",
                  loss_amount: 100.00,
                  game_id: "SUPERNOVA",
                  operator_id: "{{operatorId}}"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/wallet/loss`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "loss"]
              },
              description: "Confirms round loss in ledger when rocket crashes before cashout."
            }
          },
          {
            name: "[POST] 1.8 Rollback / Void & Refund Bet",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "x-dev-test-mode", value: "true" }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  txn_id: "TXN_ROLLBACK_{{$timestamp}}",
                  ref_txn_id: "TXN_DEBIT_SAMPLE",
                  user_id: "{{userId}}",
                  operator_id: "{{operatorId}}"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/wallet/rollback`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "rollback"]
              },
              description: "Refunds a previous wager back into user wallet in case of round void or system abort."
            }
          },
          {
            name: "[POST] 1.9 Mobile Banking Webhook (PromptPay / Bank Deposit)",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "x-dev-test-mode", value: "true" }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  txn_id: "BANK_DEP_{{$timestamp}}",
                  user_id: "{{userId}}",
                  amount: 1000.00,
                  currency: "THB",
                  channel: "PROMPTPAY_QR",
                  status: "SUCCESS"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/payment/webhook`,
                host: [baseUrl],
                path: ["api", "v1", "payment", "webhook"]
              },
              description: "Simulates automatic instant deposit webhook from Thai mobile banking / payment gateway."
            }
          },
          {
            name: "[GET] 1.10 List All Wallet Users",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/v1/wallet/users`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "users"]
              },
              description: "Returns list of all active users in the database with their current THB balances."
            }
          },
          {
            name: "[GET] 1.11 Get User Details by ID",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/v1/wallet/users/{{userId}}`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "users", "{{userId}}"]
              },
              description: "Retrieves specific user profile, registration date, and status."
            }
          },
          {
            name: "[POST] 1.12 Create New Wallet User",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  id: "USER_DEV_{{$timestamp}}",
                  username: "TestDeveloper_{{$timestamp}}",
                  balance: 20000.00
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/wallet/create-user`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "create-user"]
              },
              description: "Provisions a new player account with an initial THB balance."
            }
          },
          {
            name: "[GET] 1.13 Query Transaction Audit Ledger",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/v1/wallet/transactions?limit=20&user_id={{userId}}`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "transactions"],
                query: [
                  { key: "limit", value: "20" },
                  { key: "user_id", value: "{{userId}}" }
                ]
              },
              description: "Inspects financial transaction history with optional filters by user_id and transaction type."
            }
          },
          {
            name: "[GET] 1.14 Get Single Transaction Details by TxnId",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/v1/wallet/transactions/TXN_SAMPLE_001`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "transactions", "TXN_SAMPLE_001"]
              },
              description: "Looks up complete metadata for an individual transaction ID."
            }
          },
          {
            name: "[POST] 1.15 Generate HMAC-SHA256 Signature Helper",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  payload: {
                    user_id: "USER_TH_001",
                    amount: 100.00
                  }
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/wallet/sign`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "sign"]
              },
              description: "Helper endpoint to calculate valid x-signature for any arbitrary JSON payload."
            }
          },
          {
            name: "[POST] 1.16 Reset Demo Wallet Data",
            request: {
              method: "POST",
              url: {
                raw: `${baseUrl}/api/v1/wallet/reset-demo`,
                host: [baseUrl],
                path: ["api", "v1", "wallet", "reset-demo"]
              },
              description: "Resets the in-memory wallet ledger back to initial test seed values."
            }
          },
          {
            name: "[GET] 1.17 List Multi-Tenant B2B Operators",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/wallet/v1/operators`,
                host: [baseUrl],
                path: ["api", "wallet", "v1", "operators"]
              },
              description: "Returns all registered franchise operator tenant configurations."
            }
          },
          {
            name: "[POST] 1.18 Register New B2B Operator Tenant",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  operator_id: "OP_NEW_PARTNER",
                  operator_name: "New Partner Casino",
                  platform_url: "https://newpartner.com"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/wallet/v1/operators/register`,
                host: [baseUrl],
                path: ["api", "wallet", "v1", "operators", "register"]
              },
              description: "Onboards a new multi-tenant franchise partner with separate ledger accounting."
            }
          },
          {
            name: "[POST] 1.19 Universal Franchise Network Gateway",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  merchant_id: "MERCHANT_ASIA_99",
                  external_user_id: "ext_player_7788",
                  action: "GET_BALANCE"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/v1/franchise/gateway`,
                host: [baseUrl],
                path: ["api", "v1", "franchise", "gateway"]
              },
              description: "Standardizes external tenant user IDs into the Supernova franchise network format."
            }
          }
        ]
      },

      // --------------------------------------------------------------------
      // FOLDER 2: GAME ENGINE & PROVABLY FAIR
      // --------------------------------------------------------------------
      {
        name: "2. 🚀 Game Engine & Provably Fair API",
        description: "Server-authoritative game state, provably fair history, and player round lifecycle endpoints.",
        item: [
          {
            name: "[GET] 2.1 Health & Engine Diagnostics",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/security/health`,
                host: [baseUrl],
                path: ["api", "security", "health"]
              },
              description: "Verifies backend uptime, cryptographic pool readiness, and security layers."
            }
          },
          {
            name: "[GET] 2.2 Live Authoritative Game State",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/game/state`,
                host: [baseUrl],
                path: ["api", "game", "state"]
              },
              description: "Returns real-time multiplier, current round status, and countdown telemetry."
            }
          },
          {
            name: "[GET] 2.3 Global Round History & Cryptographic Hashes",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/game/history?limit=25`,
                host: [baseUrl],
                path: ["api", "game", "history"],
                query: [{ key: "limit", value: "25" }]
              },
              description: "Provides provably fair audit trail with server seeds, SHA-256 hashes, and crash multipliers."
            }
          },
          {
            name: "[POST] 2.4 Force Round Start (Dev/Simulation)",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  simulatedRoundId: "RND_DEV_{{$timestamp}}",
                  forcedCrashPoint: 3.50
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/security/round/start`,
                host: [baseUrl],
                path: ["api", "security", "round", "start"]
              },
              description: "Forces initiation of a new game round for local testing and automated verification."
            }
          },
          {
            name: "[POST] 2.5 Force Round Finish / Crash (Dev/Simulation)",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  roundId: "RND_DEV_{{$timestamp}}",
                  crashPoint: 2.75
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/security/round/finish`,
                host: [baseUrl],
                path: ["api", "security", "round", "finish"]
              },
              description: "Simulates round termination and triggers central history archive."
            }
          },
          {
            name: "[POST] 2.6 Player Login & Obtain JWT Token",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  username: "player_kong",
                  password: "secure_password_123"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/security/login`,
                host: [baseUrl],
                path: ["api", "security", "login"]
              },
              description: "Authenticates client and returns Bearer JWT token valid for in-game wagers."
            },
            event: [
              {
                listen: "test",
                script: {
                  type: "text/javascript",
                  exec: [
                    "if (pm.response.code === 200) {",
                    "    const data = pm.response.json();",
                    "    if (data.token) {",
                    "        pm.collectionVariables.set('jwtToken', data.token);",
                    "        console.log('Saved jwtToken:', data.token);",
                    "    }",
                    "}"
                  ]
                }
              }
            ]
          },
          {
            name: "[POST] 2.7 In-Game Bet (JWT Authenticated)",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "Authorization", value: "Bearer {{jwtToken}}" }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  amount: 50.00,
                  targetMultiplier: 2.00
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/security/bet`,
                host: [baseUrl],
                path: ["api", "security", "bet"]
              },
              description: "Submits in-game bet using JWT Bearer authentication."
            }
          },
          {
            name: "[POST] 2.8 In-Game Cashout (JWT Authenticated)",
            request: {
              method: "POST",
              header: [
                { key: "Content-Type", value: "application/json" },
                { key: "Authorization", value: "Bearer {{jwtToken}}" }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  roundId: "RND_CURRENT",
                  claimedMultiplier: 2.50
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/security/cashout`,
                host: [baseUrl],
                path: ["api", "security", "cashout"]
              },
              description: "Performs real-time player cashout at current flying multiplier."
            }
          },
          {
            name: "[POST] 2.9 Player Logout (Revoke JWT)",
            request: {
              method: "POST",
              header: [
                { key: "Authorization", value: "Bearer {{jwtToken}}" }
              ],
              url: {
                raw: `${baseUrl}/api/security/logout`,
                host: [baseUrl],
                path: ["api", "security", "logout"]
              },
              description: "Blacklists JWT token on server to prevent reuse."
            }
          }
        ]
      },

      // --------------------------------------------------------------------
      // FOLDER 3: SECURITY & ANTI-BOT DEFENSE
      // --------------------------------------------------------------------
      {
        name: "3. 🛡️ Security & Anti-Bot Defense API",
        description: "Zero-footprint privacy logs, anti-scraping defense, and proof-of-work bot challenge verification.",
        item: [
          {
            name: "[GET] 3.1 Security & Audit Event Logs",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/security/logs`,
                host: [baseUrl],
                path: ["api", "security", "logs"]
              },
              description: "Returns sanitized event logs of system access, rate limit triggers, and security alerts."
            }
          },
          {
            name: "[GET] 3.2 Anti-Bot Shield Status",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/security/anti-bot/status`,
                host: [baseUrl],
                path: ["api", "security", "anti-bot", "status"]
              },
              description: "Inspects active anti-bot shield configuration and challenge parameters."
            }
          },
          {
            name: "[POST] 3.3 Request Anti-Bot Challenge",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  client_token: "dev_client_{{$timestamp}}"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/security/anti-bot/challenge`,
                host: [baseUrl],
                path: ["api", "security", "anti-bot", "challenge"]
              },
              description: "Issues cryptographic proof-of-work challenge to verify human client."
            }
          },
          {
            name: "[POST] 3.4 Submit Anti-Bot Challenge Solution",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  challenge_id: "CHL_SAMPLE_123",
                  solution: "998244353"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/security/anti-bot/verify`,
                host: [baseUrl],
                path: ["api", "security", "anti-bot", "verify"]
              },
              description: "Validates challenge solution to clear client IP from rate-limit throttles."
            }
          },
          {
            name: "[GET] 3.5 Cashout Velocity Insights",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/security/analytics/insights`,
                host: [baseUrl],
                path: ["api", "security", "analytics", "insights"]
              },
              description: "Telemetry engine insights monitoring player cashout behavior and latency."
            }
          },
          {
            name: "[POST] 3.6 Record Cashout Metric Ping",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  cashoutMultiplier: 2.15,
                  latencyMs: 18,
                  roundId: "RND_SAMPLE"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/security/analytics/cashout-metric`,
                host: [baseUrl],
                path: ["api", "security", "analytics", "cashout-metric"]
              },
              description: "Records latency and cashout point metrics for actuarial calibration."
            }
          }
        ]
      },

      // --------------------------------------------------------------------
      // FOLDER 4: ACTUARIAL RISK ENGINE & HOUSE EDGE
      // --------------------------------------------------------------------
      {
        name: "4. 📊 Actuarial Risk Engine & House Edge API",
        description: "Dynamic risk cushion explosion protocol, liability ceilings, and calibrated 11-tier RNG distribution.",
        item: [
          {
            name: "[GET] 4.1 Actuarial Metrics & Real-Time RTP",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/risk-assurance/metrics`,
                host: [baseUrl],
                path: ["api", "risk-assurance", "metrics"]
              },
              description: "Retrieves mathematical house edge, cumulative RTP, liability reserves, and risk parameters."
            }
          },
          {
            name: "[POST] 4.2 Update Liability Ceiling",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  ceilingAmountThb: 500000.00
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/risk-assurance/set-ceiling`,
                host: [baseUrl],
                path: ["api", "risk-assurance", "set-ceiling"]
              },
              description: "Configures maximum allowable single-round payout exposure."
            }
          },
          {
            name: "[POST] 4.3 Run Monte Carlo Risk Simulation",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  rounds: 1000,
                  averageBetThb: 100.00,
                  targetCashoutMultiplier: 2.00
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/risk-assurance/simulate`,
                host: [baseUrl],
                path: ["api", "risk-assurance", "simulate"]
              },
              description: "Simulates high-volume round outcomes to verify positive long-term house EV."
            }
          }
        ]
      },

      // --------------------------------------------------------------------
      // FOLDER 5: B2B FRANCHISE & DISTRIBUTED INFRASTRUCTURE
      // --------------------------------------------------------------------
      {
        name: "5. 🏢 B2B Franchise & Distributed Infrastructure API",
        description: "Distributed Redis caching, sliding-window rate limiters, PostgreSQL partitions, and K6 stress simulator.",
        item: [
          {
            name: "[POST] 5.1 Redis Sliding Window Rate-Limit Check",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  key: "ratelimit_merchant_01",
                  maxRequests: 5000,
                  windowSeconds: 60
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/b2b/redis/ratelimit`,
                host: [baseUrl],
                path: ["api", "b2b", "redis", "ratelimit"]
              },
              description: "Checks high-throughput sliding window throttle in simulated Redis store."
            }
          },
          {
            name: "[POST] 5.2 Redis Distributed Session Store",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  sessionId: "sess_{{$timestamp}}",
                  userId: "{{userId}}",
                  ttlSeconds: 3600
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/b2b/redis/session`,
                host: [baseUrl],
                path: ["api", "b2b", "redis", "session"]
              },
              description: "Creates distributed session token cached across cluster instances."
            }
          },
          {
            name: "[GET] 5.3 Redis Live Leaderboard",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/b2b/redis/leaderboard`,
                host: [baseUrl],
                path: ["api", "b2b", "redis", "leaderboard"]
              },
              description: "Returns top winning players ordered by payout multiplier."
            }
          },
          {
            name: "[POST] 5.4 Submit Score to Redis Leaderboard",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  userId: "{{userId}}",
                  score: 88.50,
                  username: "TopGun_Pilot"
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/b2b/redis/leaderboard/add`,
                host: [baseUrl],
                path: ["api", "b2b", "redis", "leaderboard", "add"]
              },
              description: "Adds or updates player rank in real-time Redis ZSET leaderboard."
            }
          },
          {
            name: "[GET] 5.5 Partitioned PostgreSQL Audit Logs",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/b2b/logs/partitions`,
                host: [baseUrl],
                path: ["api", "b2b", "logs", "partitions"]
              },
              description: "Lists partitioned log tables separated by calendar month for enterprise scalability."
            }
          },
          {
            name: "[POST] 5.6 Insert Partitioned Log Entry",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  merchant_id: "{{operatorId}}",
                  ext_user_id: "{{userId}}",
                  game_id: "SUPERNOVA",
                  round_id: "RND_{{$timestamp}}",
                  transaction_type: "BET",
                  amount: 100.00
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/b2b/logs/insert`,
                host: [baseUrl],
                path: ["api", "b2b", "logs", "insert"]
              },
              description: "Directly inserts an immutable transaction record into partitioned monthly storage."
            }
          },
          {
            name: "[POST] 5.7 Seed Demo Partition Logs",
            request: {
              method: "POST",
              url: {
                raw: `${baseUrl}/api/b2b/logs/seed`,
                host: [baseUrl],
                path: ["api", "b2b", "logs", "seed"]
              },
              description: "Generates realistic audit log rows across multiple months for dashboard evaluation."
            }
          },
          {
            name: "[GET] 5.8 Analytics: RTP Breakdown by Game",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/b2b/analytics/rtp-by-game`,
                host: [baseUrl],
                path: ["api", "b2b", "analytics", "rtp-by-game"]
              },
              description: "Aggregates turnover and payouts to calculate actual realized RTP by game title."
            }
          },
          {
            name: "[GET] 5.9 Analytics: Bot Detection Statistics",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/b2b/analytics/bot-detection`,
                host: [baseUrl],
                path: ["api", "b2b", "analytics", "bot-detection"]
              },
              description: "Analyzes automated betting frequency patterns to identify scripted players."
            }
          },
          {
            name: "[GET] 5.10 Analytics: Merchant GGR & NGR",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/b2b/analytics/merchant-ggr`,
                host: [baseUrl],
                path: ["api", "b2b", "analytics", "merchant-ggr"]
              },
              description: "Reports gross gaming revenue and franchise commissions per merchant operator."
            }
          },
          {
            name: "[POST] 5.11 Trigger K6 Concurrency Stress Test",
            request: {
              method: "POST",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  vus: 50,
                  duration: 2
                }, null, 2)
              },
              url: {
                raw: `${baseUrl}/api/k6/run`,
                host: [baseUrl],
                path: ["api", "k6", "run"]
              },
              description: "Runs an instant simulated K6 load test against the seamless wallet to verify concurrency locks."
            }
          }
        ]
      },

      // --------------------------------------------------------------------
      // FOLDER 6: DOCUMENTATION & SPECIFICATIONS
      // --------------------------------------------------------------------
      {
        name: "6. 📖 API Documentation & Exports",
        description: "Endpoints to export Postman collections, OpenAPI 3.0 specs, and API catalog.",
        item: [
          {
            name: "[GET] 6.1 Export Postman Collection v2.1.0",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/docs/postman.json`,
                host: [baseUrl],
                path: ["api", "docs", "postman.json"]
              },
              description: "Downloads this full Postman Collection JSON directly."
            }
          },
          {
            name: "[GET] 6.2 Export OpenAPI 3.0 / Swagger JSON",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/docs/openapi.json`,
                host: [baseUrl],
                path: ["api", "docs", "openapi.json"]
              },
              description: "Downloads the standardized OpenAPI v3.0 JSON specification."
            }
          },
          {
            name: "[GET] 6.3 API Endpoints Directory (Quick JSON)",
            request: {
              method: "GET",
              url: {
                raw: `${baseUrl}/api/docs/endpoints`,
                host: [baseUrl],
                path: ["api", "docs", "endpoints"]
              },
              description: "Returns a concise JSON listing of all available endpoints for quick developer reference."
            }
          }
        ]
      }
    ]
  };
}

/**
 * Returns complete Postman Environment JSON
 */
export function generatePostmanEnvironment(baseUrl = "http://localhost:3000") {
  return {
    id: "supernova-local-environment",
    name: "SUPERNOVA — Local Sandbox Environment",
    values: [
      { key: "baseUrl", value: baseUrl, enabled: true },
      { key: "apiSecret", value: API_SECRET_KEY, enabled: true },
      { key: "operatorId", value: "OP_BOLLY_MAIN", enabled: true },
      { key: "userId", value: "USER_TH_001", enabled: true },
      { key: "jwtToken", value: "", enabled: true }
    ],
    _postman_variable_scope: "environment"
  };
}

/**
 * Concise directory of all endpoints for developers
 */
export function getApiEndpointsDirectory() {
  return {
    title: "SUPERNOVA API Endpoints Directory",
    version: "2.1.0",
    totalEndpoints: 36,
    authMethods: [
      { type: "HMAC-SHA256", header: "x-signature", description: "crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex')" },
      { type: "Dev Bypass", header: "x-dev-test-mode: true", description: "Bypasses signature verification for rapid local dev / Postman testing" },
      { type: "JWT Bearer", header: "Authorization: Bearer <token>", description: "Obtained via /api/security/login for in-game user actions" }
    ],
    categories: {
      wallet: [
        { method: "POST", path: "/api/v1/wallet/authenticate", summary: "Player handshake & session auth" },
        { method: "GET", path: "/api/v1/wallet/balance/:userId", summary: "Query balance via URL path param" },
        { method: "GET", path: "/api/v1/wallet/balance?user_id=...", summary: "Query balance via query string" },
        { method: "POST", path: "/api/v1/wallet/balance", summary: "Query balance via JSON body" },
        { method: "POST", path: "/api/v1/wallet/debit", summary: "Deduct bet with row lock (alias: /bet)" },
        { method: "POST", path: "/api/v1/wallet/credit", summary: "Credit win settlement (alias: /win)" },
        { method: "POST", path: "/api/v1/wallet/loss", summary: "Settle round loss" },
        { method: "POST", path: "/api/v1/wallet/rollback", summary: "Refund bet on void/abort (alias: /refund)" },
        { method: "POST", path: "/api/v1/payment/webhook", summary: "Mobile banking / PromptPay deposit" },
        { method: "GET", path: "/api/v1/wallet/users", summary: "List all users with balances" },
        { method: "GET", path: "/api/v1/wallet/users/:userId", summary: "Get single user details" },
        { method: "POST", path: "/api/v1/wallet/create-user", summary: "Provision new user" },
        { method: "GET", path: "/api/v1/wallet/transactions", summary: "Query ledger audit records" },
        { method: "GET", path: "/api/v1/wallet/transactions/:txnId", summary: "Lookup single transaction" },
        { method: "POST", path: "/api/v1/wallet/sign", summary: "HMAC-SHA256 signature generator" },
        { method: "POST", path: "/api/v1/wallet/reset-demo", summary: "Reset demo wallet state" },
        { method: "GET", path: "/api/wallet/v1/operators", summary: "List B2B operators" },
        { method: "POST", path: "/api/wallet/v1/operators/register", summary: "Register new B2B operator" },
        { method: "POST", path: "/api/v1/franchise/gateway", summary: "Universal Franchise Gateway" }
      ],
      game: [
        { method: "GET", path: "/api/security/health", summary: "Server health & diagnostics" },
        { method: "GET", path: "/api/game/state", summary: "Live authoritative game state" },
        { method: "GET", path: "/api/game/history", summary: "Global round history & hashes" },
        { method: "POST", path: "/api/security/round/start", summary: "Force round start (dev)" },
        { method: "POST", path: "/api/security/round/finish", summary: "Force round finish (dev)" },
        { method: "POST", path: "/api/security/login", summary: "Obtain JWT token" },
        { method: "POST", path: "/api/security/bet", summary: "Place bet (JWT required)" },
        { method: "POST", path: "/api/security/cashout", summary: "Cashout win (JWT required)" },
        { method: "POST", path: "/api/security/logout", summary: "Blacklist JWT token" }
      ],
      security: [
        { method: "GET", path: "/api/security/logs", summary: "Security audit logs" },
        { method: "GET", path: "/api/security/anti-bot/status", summary: "Anti-bot shield status" },
        { method: "POST", path: "/api/security/anti-bot/challenge", summary: "Request proof-of-work challenge" },
        { method: "POST", path: "/api/security/anti-bot/verify", summary: "Verify challenge response" },
        { method: "GET", path: "/api/security/analytics/insights", summary: "Cashout velocity insights" },
        { method: "POST", path: "/api/security/analytics/cashout-metric", summary: "Record cashout metric ping" }
      ],
      risk: [
        { method: "GET", path: "/api/risk-assurance/metrics", summary: "Risk assurance & RTP metrics" },
        { method: "POST", path: "/api/risk-assurance/set-ceiling", summary: "Configure liability ceiling" },
        { method: "POST", path: "/api/risk-assurance/simulate", summary: "Monte Carlo risk simulation" }
      ],
      b2b: [
        { method: "POST", path: "/api/b2b/redis/ratelimit", summary: "Redis sliding window rate limit" },
        { method: "POST", path: "/api/b2b/redis/session", summary: "Redis distributed session store" },
        { method: "GET", path: "/api/b2b/redis/leaderboard", summary: "Live leaderboard from Redis" },
        { method: "POST", path: "/api/b2b/redis/leaderboard/add", summary: "Add score to leaderboard" },
        { method: "GET", path: "/api/b2b/logs/partitions", summary: "List PostgreSQL partition tables" },
        { method: "POST", path: "/api/b2b/logs/insert", summary: "Insert partitioned audit log" },
        { method: "POST", path: "/api/b2b/logs/seed", summary: "Seed demo partitioned logs" },
        { method: "GET", path: "/api/b2b/analytics/rtp-by-game", summary: "RTP breakdown by game title" },
        { method: "GET", path: "/api/b2b/analytics/bot-detection", summary: "Bot detection telemetry" },
        { method: "GET", path: "/api/b2b/analytics/merchant-ggr", summary: "Merchant GGR/NGR reporting" },
        { method: "POST", path: "/api/k6/run", summary: "Trigger K6 load test simulation" }
      ],
      documentation: [
        { method: "GET", path: "/api/docs/postman.json", summary: "Export complete Postman collection v2.1.0" },
        { method: "GET", path: "/api/docs/openapi.json", summary: "Export OpenAPI 3.0 specification" },
        { method: "GET", path: "/api/docs/endpoints", summary: "Quick JSON endpoint catalog" }
      ]
    }
  };
}

// Router routes
docsRouter.get("/postman.json", (req: Request, res: Response) => {
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol || "http";
  const baseUrl = `${protocol}://${host}`;
  const collection = generatePostmanCollection(baseUrl);
  res.setHeader("Content-Disposition", 'attachment; filename="supernova_postman_collection.json"');
  res.json(collection);
});

docsRouter.get("/postman-environment.json", (req: Request, res: Response) => {
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol || "http";
  const baseUrl = `${protocol}://${host}`;
  const env = generatePostmanEnvironment(baseUrl);
  res.setHeader("Content-Disposition", 'attachment; filename="supernova_postman_environment.json"');
  res.json(env);
});

docsRouter.get("/endpoints", (req: Request, res: Response) => {
  res.json(getApiEndpointsDirectory());
});
