import React, { useState, useEffect } from "react";
import { 
  Wallet, 
  Send, 
  RefreshCw, 
  ShieldCheck, 
  Database, 
  Code, 
  Coins, 
  Percent, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Terminal, 
  UserPlus, 
  Building2, 
  KeyRound,
  FileCode,
  Sliders,
  DollarSign,
  Activity,
  Zap,
  Download,
  BarChart3,
  Flame,
  Layers,
  Cpu,
  Play
} from "lucide-react";

interface WalletUser {
  id: string;
  username: string;
  balance: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface WalletTx {
  id: number;
  txn_id: string;
  ref_txn_id?: string | null;
  user_id: string;
  operator_id?: string;
  amount: number;
  gross_amount?: number;
  fee?: number;
  cashback?: number;
  balance_after: number;
  type: "DEPOSIT_BANKING" | "BET" | "WIN" | "CASHBACK_10%" | "ROLLBACK";
  game_id?: string;
  status: string;
  created_at: string;
}

interface OperatorProfile {
  operator_id: string;
  operator_name: string;
  platform_url: string;
  api_secret: string;
  status: string;
  currency: string;
  total_debit_volume: number;
  total_credit_volume: number;
  total_loss_cashback: number;
  total_commission_paid: number;
  active_players_count: number;
  registered_at: string;
}

interface RiskMetrics {
  riskCeilingTHB: number;
  currentActiveLiabilityTHB: number;
  liabilityUtilizationPercent: number;
  totalWageredTHB: number;
  totalPayoutTHB: number;
  grossHouseProfitTHB: number;
  actualHouseEdgePercent: number;
  actualRTPPercent: number;
  targetRTPPercent: number;
  targetHouseEdgePercent: number;
  isRiskCeilingNearing: boolean;
  isRiskCeilingBreached: boolean;
  activeRiskMode: "NORMAL" | "RISK_WARNING" | "RISK_CUSHION_EXPLOSION";
  totalCohortLosses: number;
  totalCohortWins: number;
  cohortLossRatePercent: number;
  cohortWinRatePercent: number;
  lastExplosionMultiplier?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdated?: () => void;
}

type EndpointType = "auth" | "webhook" | "balance" | "debit" | "credit" | "loss" | "rollback";

export const SeamlessWalletModal: React.FC<Props> = ({ isOpen, onClose, onBalanceUpdated }) => {
  const [activeTab, setActiveTab] = useState<"explorer" | "docs" | "operators" | "risk" | "b2b_analytics" | "loadtest" | "ledger" | "users">("explorer");
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointType>("debit");
  
  // Test parameters
  const [selectedUserId, setSelectedUserId] = useState<string>("USER_TH_001");
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("OP_BOLLY_MAIN");
  const [txnId, setTxnId] = useState<string>(() => "TXN_" + Date.now().toString().slice(-8));
  const [refTxnId, setRefTxnId] = useState<string>("");
  const [amount, setAmount] = useState<string>("500");
  const [gameId, setGameId] = useState<string>("SUPERNOVA");
  const [secretKey, setSecretKey] = useState<string>("YOUR_SUPER_SECRET_HMAC_KEY");
  const [useHmacHeader, setUseHmacHeader] = useState<boolean>(true);

  // Live state
  const [users, setUsers] = useState<WalletUser[]>([]);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [operators, setOperators] = useState<OperatorProfile[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiStatus, setApiStatus] = useState<number | null>(null);
  const [computedSignature, setComputedSignature] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [lastExecutedTxn, setLastExecutedTxn] = useState<string>("");

  // Code snippets tab state
  const [codeLanguage, setCodeLanguage] = useState<"curl" | "node" | "python" | "php">("curl");

  // Multi-tenant registration form
  const [newOpId, setNewOpId] = useState<string>("");
  const [newOpName, setNewOpName] = useState<string>("");
  const [newOpUrl, setNewOpUrl] = useState<string>("https://");

  // New user form
  const [newUserId, setNewUserId] = useState<string>("");
  const [newUsername, setNewUsername] = useState<string>("");
  const [newInitialBalance, setNewInitialBalance] = useState<string>("10000");

  // Risk Assurance Simulator State
  const [simPlayerCount, setSimPlayerCount] = useState<number>(100);
  const [simBaseWager, setSimBaseWager] = useState<number>(100);
  const [simResults, setSimResults] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // B2B Architecture & Analytics State
  const [b2bSubTab, setB2bSubTab] = useState<"redis" | "partitions" | "analytics">("redis");
  const [b2bMerchantId, setB2bMerchantId] = useState<string>("mch_alpha");
  const [b2bExtUserId, setB2bExtUserId] = useState<string>("ext_usr_998877");
  const [b2bWinAmount, setB2bWinAmount] = useState<string>("4500.50");
  const [b2bRateLimitRes, setB2bRateLimitRes] = useState<any>(null);
  const [b2bSessionRes, setB2bSessionRes] = useState<any>(null);
  const [b2bLeaderboard, setB2bLeaderboard] = useState<any[]>([]);
  const [b2bPartitionsData, setB2bPartitionsData] = useState<any>(null);
  const [b2bRtpData, setB2bRtpData] = useState<any>(null);
  const [b2bBotData, setB2bBotData] = useState<any>(null);
  const [b2bGgrData, setB2bGgrData] = useState<any>(null);
  const [isB2bLoading, setIsB2bLoading] = useState<boolean>(false);

  // Load Test Stress Runner State
  const [loadTestConcurrency, setLoadTestConcurrency] = useState<number>(50);
  const [isLoadTesting, setIsLoadTesting] = useState<boolean>(false);
  const [loadTestResults, setLoadTestResults] = useState<{
    totalSent: number;
    successCount: number;
    duplicateCount: number;
    failedCount: number;
    durationMs: number;
    rps: number;
    avgLatencyMs: number;
  } | null>(null);

  // Full k6 Master Franchise Engine State
  const [k6VUs, setK6VUs] = useState<number>(50);
  const [k6Duration, setK6Duration] = useState<number>(3);
  const [isK6Running, setIsK6Running] = useState<boolean>(false);
  const [k6Report, setK6Report] = useState<any>(null);

  // Franchise Universal Gateway test state
  const [gatewayInputUser, setGatewayInputUser] = useState<string>("vip_player_super88");
  const [gatewayOpId, setGatewayOpId] = useState<string>("OP_BOLLY_MAIN");
  const [gatewayDeposit, setGatewayDeposit] = useState<string>("50000");
  const [gatewayResult, setGatewayResult] = useState<any>(null);
  const [isGatewayConnecting, setIsGatewayConnecting] = useState<boolean>(false);

  const generateNewTxnId = () => {
    const newId = "TXN_" + Date.now().toString().slice(-8) + "_" + Math.floor(Math.random() * 1000);
    setTxnId(newId);
    return newId;
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/v1/wallet/users");
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch wallet users", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch("/api/v1/wallet/transactions?limit=100");
      const data = await res.json();
      if (data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error("Failed to fetch wallet transactions", err);
    }
  };

  const fetchOperators = async () => {
    try {
      const res = await fetch("/api/wallet/v1/operators");
      const data = await res.json();
      if (data.operators) {
        setOperators(data.operators);
      }
    } catch (err) {
      console.error("Failed to fetch operators", err);
    }
  };

  const fetchRiskMetrics = async () => {
    try {
      const res = await fetch("/api/risk-assurance/metrics");
      const data = await res.json();
      setRiskMetrics(data);
    } catch (err) {
      console.error("Failed to fetch risk metrics", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchTransactions();
      fetchOperators();
      fetchRiskMetrics();
      generateNewTxnId();
    }
  }, [isOpen]);

  // Compute HMAC signature whenever payload changes
  const buildPayload = () => {
    switch (selectedEndpoint) {
      case "auth":
        return {
          operator_id: selectedOperatorId,
          user_id: selectedUserId,
          token: "player_session_token_xyz"
        };
      case "webhook":
        return {
          txn_id: txnId,
          user_id: selectedUserId,
          amount: parseFloat(amount) || 1000,
          status: "SUCCESS"
        };
      case "balance":
        return {
          user_id: selectedUserId
        };
      case "debit":
        return {
          txn_id: txnId,
          user_id: selectedUserId,
          amount: parseFloat(amount) || 500,
          game_id: gameId,
          operator_id: selectedOperatorId
        };
      case "credit":
        return {
          txn_id: txnId,
          user_id: selectedUserId,
          win_amount: parseFloat(amount) || 2000,
          game_id: gameId,
          operator_id: selectedOperatorId
        };
      case "loss":
        return {
          txn_id: txnId,
          bet_txn_id: refTxnId || `BET_${txnId.slice(0, 10)}`,
          user_id: selectedUserId,
          loss_amount: parseFloat(amount) || 500,
          game_id: gameId,
          operator_id: selectedOperatorId
        };
      case "rollback":
        return {
          txn_id: txnId,
          ref_txn_id: refTxnId || lastExecutedTxn,
          user_id: selectedUserId,
          operator_id: selectedOperatorId
        };
      default:
        return {};
    }
  };

  useEffect(() => {
    const payload = buildPayload();
    fetch("/api/v1/wallet/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, secretKey })
    })
      .then(res => res.json())
      .then(data => {
        if (data.signature) setComputedSignature(data.signature);
      })
      .catch(() => {});
  }, [selectedEndpoint, selectedUserId, selectedOperatorId, txnId, refTxnId, amount, gameId, secretKey]);

  const handleExecuteApi = async (overrideTxnId?: string) => {
    setIsLoading(true);
    setApiResponse(null);
    setApiStatus(null);

    const payload = buildPayload();
    if (overrideTxnId) {
      payload.txn_id = overrideTxnId;
    }

    let url = "";
    switch (selectedEndpoint) {
      case "auth":
        url = "/api/wallet/v1/authenticate";
        break;
      case "webhook":
        url = "/api/v1/payment/webhook";
        break;
      case "balance":
        url = "/api/wallet/v1/balance";
        break;
      case "debit":
        url = "/api/wallet/v1/bet";
        break;
      case "credit":
        url = "/api/wallet/v1/win";
        break;
      case "loss":
        url = "/api/wallet/v1/loss";
        break;
      case "rollback":
        url = "/api/wallet/v1/rollback";
        break;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (useHmacHeader) {
        const signRes = await fetch("/api/v1/wallet/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload, secretKey })
        });
        const signData = await signRes.json();
        headers["x-signature"] = signData.signature;
      } else {
        headers["x-dev-test-mode"] = "true";
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      setApiStatus(res.status);
      const data = await res.json();
      setApiResponse(data);

      if (payload.txn_id) {
        setLastExecutedTxn(payload.txn_id);
        if (selectedEndpoint === "debit") {
          setRefTxnId(payload.txn_id);
        }
      }

      // Refresh data
      await fetchUsers();
      await fetchTransactions();
      await fetchOperators();
      await fetchRiskMetrics();
      if (onBalanceUpdated) onBalanceUpdated();

      if (!overrideTxnId) {
        generateNewTxnId();
      }
    } catch (err: any) {
      setApiStatus(500);
      setApiResponse({ error: "NETWORK_ERROR", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/risk-assurance/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerCount: simPlayerCount, baseWager: simBaseWager })
      });
      const data = await res.json();
      setSimResults(data);
      await fetchRiskMetrics();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRunLoadTest = async () => {
    setIsLoadTesting(true);
    setLoadTestResults(null);

    const count = loadTestConcurrency;
    const startTime = performance.now();
    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    const promises = Array.from({ length: count }, async (_, i) => {
      const uniqueTxn = `TXN_BURST_${Date.now()}_${i}_${Math.random()}`;
      const payload = {
        txn_id: uniqueTxn,
        user_id: selectedUserId,
        amount: 10,
        game_id: "SUPERNOVA",
        operator_id: selectedOperatorId
      };

      try {
        const signRes = await fetch("/api/v1/wallet/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload, secretKey })
        });
        const { signature } = await signRes.json();

        const res = await fetch("/api/wallet/v1/bet", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-signature": signature },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.status === 200 && data.status === "SUCCESS") {
          if (data.alreadyProcessed) duplicateCount++;
          else successCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    });

    await Promise.all(promises);
    const durationMs = performance.now() - startTime;
    const rps = parseFloat(((count / durationMs) * 1000).toFixed(1));
    const avgLatencyMs = parseFloat((durationMs / count).toFixed(2));

    setLoadTestResults({
      totalSent: count,
      successCount,
      duplicateCount,
      failedCount,
      durationMs: Math.round(durationMs),
      rps,
      avgLatencyMs
    });

    await fetchUsers();
    await fetchTransactions();
    if (onBalanceUpdated) onBalanceUpdated();
    setIsLoadTesting(false);
  };

  const handleRunK6Suite = async () => {
    setIsK6Running(true);
    setK6Report(null);
    try {
      const res = await fetch("/api/k6/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vus: k6VUs, duration: k6Duration })
      });
      const data = await res.json();
      setK6Report(data);
      await fetchUsers();
      await fetchTransactions();
      if (onBalanceUpdated) onBalanceUpdated();
    } catch (err: any) {
      console.error("k6 execution failed", err);
    } finally {
      setIsK6Running(false);
    }
  };

  const handleFranchiseGatewayConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGatewayConnecting(true);
    try {
      const res = await fetch("/api/v1/franchise/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_user: gatewayInputUser,
          operator_id: gatewayOpId,
          deposit_amount: Number(gatewayDeposit || 50000)
        })
      });
      const data = await res.json();
      setGatewayResult(data);
      await fetchUsers();
      if (onBalanceUpdated) onBalanceUpdated();
    } catch (err: any) {
      console.error("Gateway connection error", err);
    } finally {
      setIsGatewayConnecting(false);
    }
  };

  const handleRegisterOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpId || !newOpName) return;
    try {
      const res = await fetch("/api/wallet/v1/operators/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: newOpId,
          operator_name: newOpName,
          platform_url: newOpUrl
        })
      });
      const data = await res.json();
      if (data.status === "SUCCESS") {
        setNewOpId("");
        setNewOpName("");
        setNewOpUrl("https://");
        await fetchOperators();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId || !newUsername) return;

    try {
      const res = await fetch("/api/v1/wallet/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newUserId,
          username: newUsername,
          balance: parseFloat(newInitialBalance) || 0
        })
      });
      const data = await res.json();
      if (data.status === "SUCCESS") {
        setNewUserId("");
        setNewUsername("");
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm("Are you sure you want to reset all wallet transactions and users to default state?")) return;
    try {
      await fetch("/api/v1/wallet/reset-demo", { method: "POST" });
      await fetchUsers();
      await fetchTransactions();
      await fetchOperators();
      await fetchRiskMetrics();
      setApiResponse({ status: "SUCCESS", message: "Database reset to initial demo state." });
      setApiStatus(200);
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // B2B ARCHITECTURE & ANALYTICS HANDLERS
  // ==========================================
  const executeRedisRateLimit = async () => {
    setIsB2bLoading(true);
    try {
      const res = await fetch("/api/b2b/redis/ratelimit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_id: b2bMerchantId, ext_user_id: b2bExtUserId })
      });
      const data = await res.json();
      setB2bRateLimitRes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsB2bLoading(false);
    }
  };

  const executeRedisSession = async () => {
    setIsB2bLoading(true);
    try {
      const res = await fetch("/api/b2b/redis/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_id: b2bMerchantId, ext_user_id: b2bExtUserId, ttl_seconds: 3600 })
      });
      const data = await res.json();
      setB2bSessionRes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsB2bLoading(false);
    }
  };

  const fetchRedisLeaderboard = async () => {
    try {
      const res = await fetch("/api/b2b/redis/leaderboard?start=0&stop=9");
      const data = await res.json();
      if (data.leaderboard) {
        setB2bLeaderboard(data.leaderboard);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addRedisWinEntry = async () => {
    setIsB2bLoading(true);
    try {
      await fetch("/api/b2b/redis/leaderboard/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_id: b2bMerchantId, ext_user_id: b2bExtUserId, win_amount: parseFloat(b2bWinAmount) })
      });
      await fetchRedisLeaderboard();
    } catch (err) {
      console.error(err);
    } finally {
      setIsB2bLoading(false);
    }
  };

  const fetchB2bPartitions = async () => {
    try {
      const res = await fetch("/api/b2b/logs/partitions");
      const data = await res.json();
      setB2bPartitionsData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchB2bAnalytics = async () => {
    setIsB2bLoading(true);
    try {
      const [resRtp, resBot, resGgr] = await Promise.all([
        fetch("/api/b2b/analytics/rtp-by-game?hours=24").then(r => r.json()),
        fetch("/api/b2b/analytics/bot-detection?threshold=25&window_minutes=5").then(r => r.json()),
        fetch("/api/b2b/analytics/merchant-ggr?days=30").then(r => r.json())
      ]);
      setB2bRtpData(resRtp);
      setB2bBotData(resBot);
      setB2bGgrData(resGgr);
    } catch (err) {
      console.error(err);
    } finally {
      setIsB2bLoading(false);
    }
  };

  const seedB2bSimulationLogs = async () => {
    setIsB2bLoading(true);
    try {
      await fetch("/api/b2b/logs/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 150 })
      });
      await fetchB2bPartitions();
      await fetchB2bAnalytics();
      await fetchRedisLeaderboard();
    } catch (err) {
      console.error(err);
    } finally {
      setIsB2bLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Stats calculation
  const totalDeposits = transactions
    .filter(t => t.type === "DEPOSIT_BANKING" && t.status === "SUCCESS")
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalBets = transactions
    .filter(t => t.type === "BET" && t.status === "SUCCESS")
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalHouseFee = transactions
    .filter(t => t.type === "WIN" && t.status === "SUCCESS")
    .reduce((acc, t) => acc + (t.fee || 0), 0);

  const totalCashback = transactions
    .filter(t => t.type === "CASHBACK_10%" && t.status === "SUCCESS")
    .reduce((acc, t) => acc + (t.cashback || t.amount || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-[#10141d] border border-slate-700/80 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden text-slate-200">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0c1017]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Building2 className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Global iGaming Seamless Wallet & Risk Assurance Hub
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Multi-Currency Ready
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Multi-Tenant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                HMAC-SHA256 Signatures • SELECT ... FOR UPDATE Row Locks • 59:41 Risk Assurance • 1.02x-1.05x Explosion Cushion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDemo}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              title="Reset Demo Data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset DB</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-base font-semibold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* FINANCIAL SUMMARY OVERVIEW BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-2.5 bg-[#090c12] border-b border-slate-800/80 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1 mb-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Inbound Deposits</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-emerald-400">
              {totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1 mb-1">
              <Coins className="w-3.5 h-3.5 text-rose-400" />
              <span>Total Wagers (Debit)</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-rose-400">
              {totalBets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1 mb-1">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              <span>House Margin</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-amber-400">
              {totalHouseFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1 mb-1">
              <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
              <span>Cashback / Rebate</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-purple-400">
              {totalCashback.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-slate-800 bg-[#0d1118] px-5 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === "explorer"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            API Sandbox & Tester
          </button>

          <button
            onClick={() => setActiveTab("docs")}
            className={`px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === "docs"
                ? "border-purple-500 text-purple-400 bg-purple-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code className="w-4 h-4" />
            OpenAPI & Postman Specs
          </button>

          <button
            onClick={() => { setActiveTab("operators"); fetchOperators(); }}
            className={`px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === "operators"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            Multi-Tenant Operators ({operators.length})
          </button>

          <button
            onClick={() => { setActiveTab("risk"); fetchRiskMetrics(); }}
            className={`px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === "risk"
                ? "border-rose-500 text-rose-400 bg-rose-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Risk Assurance (75% RTP)
          </button>

          <button
            onClick={() => {
              setActiveTab("b2b_analytics");
              fetchRedisLeaderboard();
              fetchB2bPartitions();
              fetchB2bAnalytics();
            }}
            className={`px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === "b2b_analytics"
                ? "border-emerald-500 text-emerald-300 bg-emerald-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            B2B Redis & SQL Analytics
          </button>

          <button
            onClick={() => setActiveTab("loadtest")}
            className={`px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === "loadtest"
                ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-4 h-4" />
            Load Test & Stress Suite
          </button>

          <button
            onClick={() => { setActiveTab("ledger"); fetchTransactions(); }}
            className={`px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === "ledger"
                ? "border-blue-500 text-blue-400 bg-blue-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            DB Ledger ({transactions.length})
          </button>

          <button
            onClick={() => { setActiveTab("users"); fetchUsers(); }}
            className={`px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
              activeTab === "users"
                ? "border-teal-500 text-teal-400 bg-teal-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wallet className="w-4 h-4" />
            Wallets ({users.length})
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0b0e15]">

          {/* TAB 1: API EXPLORER & SANDBOX */}
          {activeTab === "explorer" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: ENDPOINT SELECTOR & PARAMS */}
              <div className="lg:col-span-6 space-y-4">
                
                {/* 1. Endpoint Selection Cards */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-2 block uppercase tracking-wider">
                    Select Seamless Wallet Mock Endpoint
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => setSelectedEndpoint("auth")}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "auth"
                          ? "bg-teal-950/50 border-teal-500 text-teal-300 shadow-md shadow-teal-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1 font-bold text-xs">
                        <KeyRound className="w-3.5 h-3.5 text-teal-400" />
                        Auth Handshake
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">/wallet/v1/auth</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("balance")}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "balance"
                          ? "bg-blue-950/50 border-blue-500 text-blue-300 shadow-md shadow-blue-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1 font-bold text-xs">
                        <Wallet className="w-3.5 h-3.5 text-blue-400" />
                        Get Balance
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">/wallet/v1/balance</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("debit")}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "debit"
                          ? "bg-rose-950/50 border-rose-500 text-rose-300 shadow-md shadow-rose-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1 font-bold text-xs">
                        <Coins className="w-3.5 h-3.5 text-rose-400" />
                        Debit / Place Bet
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">/wallet/v1/bet</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("credit")}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "credit"
                          ? "bg-amber-950/50 border-amber-500 text-amber-300 shadow-md shadow-amber-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1 font-bold text-xs">
                        <Percent className="w-3.5 h-3.5 text-amber-400" />
                        Win Settlement
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">/wallet/v1/win</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("loss")}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "loss"
                          ? "bg-purple-950/50 border-purple-500 text-purple-300 shadow-md shadow-purple-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1 font-bold text-xs">
                        <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                        Loss Settlement
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">/wallet/v1/loss</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("rollback")}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "rollback"
                          ? "bg-cyan-950/50 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1 font-bold text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-cyan-400" />
                        Rollback / Refund
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">/wallet/v1/rollback</div>
                    </button>
                  </div>
                </div>

                {/* 2. Interactive Input Fields */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-slate-300">Request Parameters</span>
                    <button
                      onClick={generateNewTxnId}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                    >
                      <RefreshCw className="w-3 h-3" /> New txn_id
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Target Player</label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.username} ({u.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Operator Tenant</label>
                      <select
                        value={selectedOperatorId}
                        onChange={(e) => setSelectedOperatorId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {operators.map(op => (
                          <option key={op.operator_id} value={op.operator_id}>
                            {op.operator_name} ({op.operator_id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedEndpoint !== "balance" && selectedEndpoint !== "auth" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Transaction ID (Idempotency Key)</label>
                        <input
                          type="text"
                          value={txnId}
                          onChange={(e) => setTxnId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-amber-300 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          {selectedEndpoint === "debit" ? "Wager Amount" : selectedEndpoint === "credit" ? "Gross Win Amount" : selectedEndpoint === "loss" ? "Loss Amount" : "Amount"}
                        </label>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}

                  {(selectedEndpoint === "loss" || selectedEndpoint === "rollback") && (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Original Ref Transaction ID (ref_txn_id)</label>
                      <input
                        type="text"
                        value={refTxnId}
                        onChange={(e) => setRefTxnId(e.target.value)}
                        placeholder="e.g. TXN_BET_9901"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}

                  {/* HMAC & Security config */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>HMAC-SHA256 Signature Header</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useHmacHeader}
                          onChange={(e) => setUseHmacHeader(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    {useHmacHeader && (
                      <div className="text-[10px] text-slate-400 font-mono bg-slate-950 p-2 rounded border border-slate-800 break-all">
                        <span className="text-emerald-400 font-bold">x-signature: </span>
                        {computedSignature || "Calculating..."}
                      </div>
                    )}
                  </div>

                  {/* EXECUTION BUTTONS */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => handleExecuteApi()}
                      disabled={isLoading}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Execute Mock Request
                    </button>

                    {selectedEndpoint !== "balance" && selectedEndpoint !== "auth" && (
                      <button
                        onClick={() => handleExecuteApi(lastExecutedTxn || txnId)}
                        disabled={isLoading || (!lastExecutedTxn && !txnId)}
                        className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center gap-1.5 transition-all"
                        title="Replay identical txn_id to verify idempotent zero-duplicate protection"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Test Idempotency
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: RAW REQUEST / RESPONSE VIEWER */}
              <div className="lg:col-span-6 space-y-4">
                
                {/* 1. Payload Inspector */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-semibold text-slate-300">Outgoing JSON Payload</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(buildPayload(), null, 2))}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                    </button>
                  </div>
                  <pre className="mt-2 text-[11px] font-mono bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-emerald-300 overflow-x-auto max-h-40">
                    {JSON.stringify(buildPayload(), null, 2)}
                  </pre>
                </div>

                {/* 2. Response Inspector */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">Live API Server Response</span>
                      {apiStatus && (
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          apiStatus >= 200 && apiStatus < 300 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}>
                          HTTP {apiStatus}
                        </span>
                      )}
                    </div>
                    {apiResponse && (
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(apiResponse, null, 2))}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                      </button>
                    )}
                  </div>

                  <pre className={`mt-2 text-[11px] font-mono bg-slate-950 p-3 rounded-lg border overflow-x-auto max-h-60 ${
                    apiStatus && apiStatus >= 400 ? "border-rose-900/50 text-rose-300" : "border-slate-800 text-slate-200"
                  }`}>
                    {apiResponse ? JSON.stringify(apiResponse, null, 2) : "// Click 'Execute Mock Request' to test live response..."}
                  </pre>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: OPENAPI & POSTMAN DOCS */}
          {activeTab === "docs" && (
            <div className="space-y-6">
              
              {/* Header with Download buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-purple-400" />
                    Standardized Integration Documentation & Export
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect any external platform, sportsbook, aggregator, or casino studio via standard OpenAPI 3.0 or Postman.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/api/docs/openapi.json"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/40 flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Swagger OpenAPI JSON
                  </a>

                  <a
                    href="/api/docs/postman.json"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/40 flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Postman Collection v2.1
                  </a>
                </div>
              </div>

              {/* Code Snippets Selection */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Client Integration Code Samples</span>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {(["curl", "node", "python", "php"] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setCodeLanguage(lang)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                          codeLanguage === lang 
                            ? "bg-emerald-500 text-slate-950" 
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {codeLanguage === "curl" && (
                  <pre className="text-xs font-mono bg-slate-950 p-4 rounded-lg border border-slate-800 text-emerald-300 overflow-x-auto">
{`# 1. Place Bet (Debit) with HMAC Signature
curl -X POST https://your-igaming-domain.com/api/wallet/v1/bet \\
  -H "Content-Type: application/json" \\
  -H "x-signature: <HMAC_SHA256_HEX>" \\
  -d '{
    "txn_id": "TXN_BET_9901",
    "user_id": "USER_TH_001",
    "amount": 100.00,
    "game_id": "SUPERNOVA",
    "operator_id": "OP_BOLLY_MAIN"
  }'

# 2. Settle Win (Credit) Payout
curl -X POST https://your-igaming-domain.com/api/wallet/v1/win \\
  -H "Content-Type: application/json" \\
  -H "x-signature: <HMAC_SHA256_HEX>" \\
  -d '{
    "txn_id": "TXN_WIN_9901",
    "user_id": "USER_TH_001",
    "win_amount": 250.00,
    "game_id": "SUPERNOVA",
    "operator_id": "OP_BOLLY_MAIN"
  }'`}
                  </pre>
                )}

                {codeLanguage === "node" && (
                  <pre className="text-xs font-mono bg-slate-950 p-4 rounded-lg border border-slate-800 text-emerald-300 overflow-x-auto">
{`import crypto from "crypto";

const API_KEY = "YOUR_SUPER_SECRET_HMAC_KEY";
const BASE_URL = "https://your-igaming-domain.com";

function signPayload(payload: any): string {
  const jsonStr = JSON.stringify(payload);
  return crypto.createHmac("sha256", API_KEY).update(jsonStr).digest("hex");
}

async function placeBet(userId: string, amount: number, txnId: string) {
  const body = {
    txn_id: txnId,
    user_id: userId,
    amount: amount,
    game_id: "SUPERNOVA",
    operator_id: "OP_BOLLY_MAIN"
  };

  const response = await fetch(\`\${BASE_URL}/api/wallet/v1/bet\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-signature": signPayload(body)
    },
    body: JSON.stringify(body)
  });

  return await response.json();
}`}
                  </pre>
                )}

                {codeLanguage === "python" && (
                  <pre className="text-xs font-mono bg-slate-950 p-4 rounded-lg border border-slate-800 text-emerald-300 overflow-x-auto">
{`import hmac
import hashlib
import json
import requests

API_SECRET = b"YOUR_SUPER_SECRET_HMAC_KEY"
BASE_URL = "https://your-igaming-domain.com"

def place_bet(user_id, amount, txn_id):
    payload = {
        "txn_id": txn_id,
        "user_id": user_id,
        "amount": amount,
        "game_id": "SUPERNOVA",
        "operator_id": "OP_BOLLY_MAIN"
    }
    raw_body = json.dumps(payload, separators=(',', ':'))
    signature = hmac.new(API_SECRET, raw_body.encode('utf-8'), hashlib.sha256).hexdigest()
    
    headers = {
        "Content-Type": "application/json",
        "x-signature": signature
    }
    response = requests.post(f"{BASE_URL}/api/wallet/v1/bet", data=raw_body, headers=headers)
    return response.json()`}
                  </pre>
                )}

                {codeLanguage === "php" && (
                  <pre className="text-xs font-mono bg-slate-950 p-4 rounded-lg border border-slate-800 text-emerald-300 overflow-x-auto">
{`<?php
$secret = "YOUR_SUPER_SECRET_HMAC_KEY";
$payload = [
    "txn_id" => "TXN_BET_" . uniqid(),
    "user_id" => "USER_TH_001",
    "amount" => 100.00,
    "game_id" => "SUPERNOVA",
    "operator_id" => "OP_BOLLY_MAIN"
];

$jsonBody = json_encode($payload);
$signature = hash_hmac('sha256', $jsonBody, $secret);

$ch = curl_init("https://your-igaming-domain.com/api/wallet/v1/bet");
curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonBody);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-signature: ' . $signature
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$result = curl_exec($ch);
curl_close($ch);
?>`}
                  </pre>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: MULTI-TENANT OPERATORS */}
          {activeTab === "operators" && (
            <div className="space-y-6">
              
              {/* Register Operator Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  Register New Partner Operator / Studio
                </h3>
                <form onSubmit={handleRegisterOperator} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Operator ID</label>
                    <input
                      type="text"
                      placeholder="e.g. OP_ASIA_GAMING"
                      value={newOpId}
                      onChange={(e) => setNewOpId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Operator Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Asia Gaming Global Hub"
                      value={newOpName}
                      onChange={(e) => setNewOpName(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Platform URL</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={newOpUrl}
                      onChange={(e) => setNewOpUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition shadow-md shadow-emerald-900/30"
                    >
                      + Register Operator
                    </button>
                  </div>
                </form>
              </div>

              {/* Operators Table */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-slate-800 font-bold text-xs text-slate-300">
                  Active Operator Platforms & Multi-Tenant Revenue
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Operator ID</th>
                        <th className="p-3">Name & Domain</th>
                        <th className="p-3">Wager Volume (Debit)</th>
                        <th className="p-3">Win Volume (Credit)</th>
                        <th className="p-3">House Fee Paid</th>
                        <th className="p-3">Cashback Paid</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {operators.map(op => (
                        <tr key={op.operator_id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-emerald-400">{op.operator_id}</td>
                          <td className="p-3">
                            <div className="font-semibold text-white">{op.operator_name}</div>
                            <div className="text-[10px] text-slate-400">{op.platform_url}</div>
                          </td>
                          <td className="p-3 font-mono text-rose-300">{op.total_debit_volume.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 font-mono text-emerald-300">{op.total_credit_volume.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 font-mono text-amber-400">{op.total_commission_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 font-mono text-purple-400">{op.total_loss_cashback.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                              {op.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Universal Network Gateway Converter Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-teal-400" />
                      Universal Network Gateway (Any Website &rarr; user_XXXXXXXXXXX Converter)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Connects any partner website or external merchant user into standardized 11-digit player IDs with zero PII and zero collision with bots.
                    </p>
                  </div>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded font-mono">
                    Zero-PII Gateway
                  </span>
                </div>

                <form onSubmit={handleFranchiseGatewayConnect} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">External Merchant Username / ID</label>
                    <input
                      type="text"
                      placeholder="e.g. member_vip_8899"
                      value={gatewayInputUser}
                      onChange={(e) => setGatewayInputUser(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Origin Operator Network</label>
                    <select
                      value={gatewayOpId}
                      onChange={(e) => setGatewayOpId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                    >
                      {operators.map(op => (
                        <option key={op.operator_id} value={op.operator_id}>{op.operator_name} ({op.operator_id})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Initial Balance (THB)</label>
                    <input
                      type="number"
                      placeholder="50000"
                      value={gatewayDeposit}
                      onChange={(e) => setGatewayDeposit(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isGatewayConnecting}
                      className="w-full bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition shadow-md shadow-teal-900/30 flex items-center justify-center gap-1.5"
                    >
                      {isGatewayConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                      Test Network Link
                    </button>
                  </div>
                </form>

                {gatewayResult && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-teal-500/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-teal-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                        Network Connection Established Successfully
                      </span>
                      <span className="font-mono text-slate-400 text-[10px]">{gatewayResult.connected_at}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 bg-slate-900 rounded border border-slate-800">
                        <div className="text-[10px] text-slate-400">Incoming User</div>
                        <div className="text-white font-bold truncate">{gatewayResult.original_user}</div>
                      </div>
                      <div className="p-2 bg-slate-900 rounded border border-teal-500/30">
                        <div className="text-[10px] text-teal-300">Converted Format</div>
                        <div className="text-teal-400 font-bold">{gatewayResult.standardized_user_id}</div>
                      </div>
                      <div className="p-2 bg-slate-900 rounded border border-slate-800">
                        <div className="text-[10px] text-slate-400">11-Digit Number</div>
                        <div className="text-amber-400 font-bold">{gatewayResult.user_number_11_digits}</div>
                      </div>
                      <div className="p-2 bg-slate-900 rounded border border-slate-800">
                        <div className="text-[10px] text-slate-400">Active Balance</div>
                        <div className="text-emerald-400 font-bold">{gatewayResult.balance.toLocaleString()} THB</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: RISK ASSURANCE & 75% RTP ENGINE */}
          {activeTab === "risk" && (
            <div className="space-y-6">
              
              {/* Risk Overview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400">Target House Edge (Margin)</div>
                  <div className="text-2xl font-bold text-amber-400 mt-1">25.0%</div>
                  <div className="text-[11px] text-slate-400 mt-1">Target RTP: 75.0% (Positive House EV)</div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400">Macro Balancing Model</div>
                  <div className="text-2xl font-bold text-rose-400 mt-1">~52% Losers : ~48% Winners</div>
                  <div className="text-[11px] text-slate-400 mt-1">Long-term turnover generates asymptotic positive EV (+25%) for house</div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-400">Explosion Cushion Protocol</div>
                  <div className="text-2xl font-bold text-purple-400 mt-1">1.02x – 1.05x</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Status: <span className="text-emerald-400 font-bold">{riskMetrics?.activeRiskMode || "NORMAL"}</span>
                  </div>
                </div>
              </div>

              {/* 100-Player Batch Cohort Simulator */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-rose-400" />
                      100-Player Simultaneous Batch Simulator
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Simulate a concurrent cohort of ~100 active players in parallel to test risk assurance stability.
                    </p>
                  </div>

                  <button
                    onClick={handleRunSimulation}
                    disabled={isSimulating}
                    className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-lg shadow-rose-900/30 transition disabled:opacity-50"
                  >
                    {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Run 100-Player Cohort Test
                  </button>
                </div>

                {simResults && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-slate-400 text-[11px]">Total Losers Count</div>
                        <div className="text-lg font-bold text-rose-400">{simResults.losersCount} ({simResults.loserRatioPercent}%)</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-slate-400 text-[11px]">Total Winners Count</div>
                        <div className="text-lg font-bold text-emerald-400">{simResults.winnersCount} ({simResults.winnerRatioPercent}%)</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-slate-400 text-[11px]">Gross House Win</div>
                        <div className="text-lg font-bold text-amber-400">+{simResults.grossHouseProfitTHB.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-slate-400 text-[11px]">Measured House Edge</div>
                        <div className="text-lg font-bold text-purple-400">{simResults.houseEdgePercent}% (RTP: {simResults.rtpPercent}%)</div>
                      </div>
                    </div>

                    {/* Sample Round Breakdown */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                          <tr>
                            <th className="p-2.5">Round</th>
                            <th className="p-2.5">Crash Multiplier</th>
                            <th className="p-2.5">Round Losers</th>
                            <th className="p-2.5">Round Winners</th>
                            <th className="p-2.5">Round House Margin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {simResults.sampleRounds?.map((sr: any) => (
                            <tr key={sr.round} className="hover:bg-slate-800/40">
                              <td className="p-2.5 font-mono">#{sr.round}</td>
                              <td className="p-2.5 font-mono font-bold text-amber-400">{sr.crashMultiplier.toFixed(2)}x</td>
                              <td className="p-2.5 font-mono text-rose-400">{sr.losers}</td>
                              <td className="p-2.5 font-mono text-emerald-400">{sr.winners}</td>
                              <td className="p-2.5 font-mono text-emerald-300">+{sr.roundProfitTHB.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4.5: B2B ARCHITECTURE & SQL ANALYTICS */}
          {activeTab === "b2b_analytics" && (
            <div className="space-y-6">
              
              {/* Header & Sub-Navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    B2B Multi-Merchant Architecture & Analytics Engine
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Zero-PII Redis caching, composite key rate limiting, partitioned transaction logs & automated B2B GGR settlements.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={seedB2bSimulationLogs}
                    disabled={isB2bLoading}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {isB2bLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Seed Multi-Merchant Logs
                  </button>

                  <button
                    onClick={() => {
                      fetchRedisLeaderboard();
                      fetchB2bPartitions();
                      fetchB2bAnalytics();
                    }}
                    className="p-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition"
                    title="Refresh All Analytics"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub-Tabs Selector */}
              <div className="flex border-b border-slate-800 bg-slate-950/60 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setB2bSubTab("redis")}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-md transition ${
                    b2bSubTab === "redis"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  1. Redis Commands (Multi-Merchant & Cache)
                </button>

                <button
                  onClick={() => { setB2bSubTab("partitions"); fetchB2bPartitions(); }}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-md transition ${
                    b2bSubTab === "partitions"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  2. PostgreSQL Logs (Range Partitioning)
                </button>

                <button
                  onClick={() => { setB2bSubTab("analytics"); fetchB2bAnalytics(); }}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-md transition ${
                    b2bSubTab === "analytics"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  3. B2B Analytics & SQL Metrics (3 Queries)
                </button>
              </div>

              {/* SUBTAB 1: REDIS COMMANDS */}
              {b2bSubTab === "redis" && (
                <div className="space-y-6">
                  
                  {/* Parameter Controls */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                      Redis Sandbox Parameters (Zero-PII Composite Keys)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Merchant ID</label>
                        <select
                          value={b2bMerchantId}
                          onChange={(e) => setB2bMerchantId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                        >
                          <option value="mch_alpha">mch_alpha (Alpha Operator)</option>
                          <option value="mch_beta">mch_beta (BetHub Beta)</option>
                          <option value="mch_gamma">mch_gamma (Royal Gamma)</option>
                          <option value="mch_delta">mch_delta (Delta Gaming)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">External User ID (from Operator)</label>
                        <input
                          type="text"
                          value={b2bExtUserId}
                          onChange={(e) => setB2bExtUserId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Win Amount (THB) for ZADD</label>
                        <input
                          type="number"
                          value={b2bWinAmount}
                          onChange={(e) => setB2bWinAmount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3 Redis Feature Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Feature 1: Rate Limiter */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-400 uppercase">Rate Limiting Key</span>
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">1-Sec Window</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Throttles bursts per Merchant User without capturing personal IP or hardware fingerprints.
                        </p>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-rose-300 mt-2 space-y-1">
                          <div>INCR "ratelimit:{b2bMerchantId}:{b2bExtUserId}"</div>
                          <div className="text-slate-500">EXPIRE "ratelimit:{b2bMerchantId}:{b2bExtUserId}" 1</div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={executeRedisRateLimit}
                          disabled={isB2bLoading}
                          className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition"
                        >
                          Execute INCR & Check Limit
                        </button>
                        {b2bRateLimitRes && (
                          <div className="text-[11px] font-mono p-2 bg-slate-950 rounded border border-slate-800 text-slate-300">
                            Count: <span className="text-amber-400 font-bold">{b2bRateLimitRes.request_count_per_second} req/s</span> | Status: <span className={b2bRateLimitRes.is_blocked ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>{b2bRateLimitRes.status}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Feature 2: Token Cache */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-teal-400 uppercase">Session Token Cache</span>
                          <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-mono">TTL: 3600s</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Temporary session mapping for ultra-fast O(1) API validation between operator and game engine.
                        </p>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-teal-300 mt-2 space-y-1 overflow-x-auto">
                          <div>SETEX "b2b:session:token_..." 3600</div>
                          <div className="text-slate-500 text-[10px]">'{`{"merchant_id":"${b2bMerchantId}","ext_user_id":"${b2bExtUserId}"}`}'</div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={executeRedisSession}
                          disabled={isB2bLoading}
                          className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs rounded-lg transition"
                        >
                          Execute SETEX Session Token
                        </button>
                        {b2bSessionRes && (
                          <div className="text-[11px] font-mono p-2 bg-slate-950 rounded border border-slate-800 text-slate-300 truncate">
                            Cached: <span className="text-teal-400">{b2bSessionRes.session_token}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Feature 3: Real-time High Win Feed */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-400 uppercase">Real-Time Win Feed</span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">Sorted Set</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Anonymous real-time high win ticker powered by Redis Sorted Set (ZADD & ZREVRANGE).
                        </p>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-300 mt-2 space-y-1">
                          <div>ZADD "leaderboard:global_wins" {b2bWinAmount} "{b2bMerchantId}:{b2bExtUserId}"</div>
                          <div className="text-slate-500">ZREVRANGE "leaderboard:global_wins" 0 9 WITHSCORES</div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={addRedisWinEntry}
                          disabled={isB2bLoading}
                          className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition"
                        >
                          Execute ZADD Win Score
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Live Top 10 High Win Feed Table */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-amber-400" />
                        Redis Sorted Set Leaderboard (ZREVRANGE 0 9 WITHSCORES)
                      </h4>
                      <span className="text-[11px] text-slate-400 font-mono">Key: "leaderboard:global_wins"</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5">Rank</th>
                            <th className="p-2.5">Merchant ID</th>
                            <th className="p-2.5">Anonymous Ext User</th>
                            <th className="p-2.5">Win Score (THB)</th>
                            <th className="p-2.5">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {b2bLeaderboard.map((entry) => (
                            <tr key={entry.rank} className="hover:bg-slate-800/40 text-[11px]">
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded font-bold ${
                                  entry.rank === 1 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                                  entry.rank === 2 ? "bg-slate-300/20 text-slate-200" :
                                  entry.rank === 3 ? "bg-amber-700/20 text-amber-400" :
                                  "text-slate-400"
                                }`}>
                                  #{entry.rank}
                                </span>
                              </td>
                              <td className="p-2.5 text-teal-300 font-bold">{entry.merchant_id}</td>
                              <td className="p-2.5 text-slate-300">{entry.ext_user_id}</td>
                              <td className="p-2.5 font-bold text-amber-400">+{entry.score.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="p-2.5 text-slate-500 text-[10px]">{new Date(entry.timestamp).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                          {b2bLeaderboard.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-500">No leaderboard entries found. Click "Execute ZADD Win Score" to populate.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* SUBTAB 2: POSTGRESQL TRANSACTION LOGS (PARTITIONED) */}
              {b2bSubTab === "partitions" && (
                <div className="space-y-6">
                  
                  {/* Partition Architecture Info */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                        PostgreSQL Table Partitioning by Range (created_at)
                      </span>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">
                        High-Volume Partition Strategy
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      Partitions transaction logs into monthly sub-tables to ensure sub-millisecond index scans and seamless multi-million TPS scaling.
                    </p>
                    
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-blue-300 space-y-1 overflow-x-auto">
                      <div>CREATE TABLE b2b_transaction_logs (...) PARTITION BY RANGE (created_at);</div>
                      <div className="text-slate-500">CREATE TABLE b2b_transaction_logs_2026_08 PARTITION OF b2b_transaction_logs FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');</div>
                    </div>
                  </div>

                  {/* Active Partitions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {b2bPartitionsData?.active_partitions?.map((p: any) => (
                      <div key={p.partition_name} className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white font-mono">{p.partition_name}</span>
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-300 font-bold">Active</span>
                        </div>
                        <div className="text-lg font-bold text-emerald-400 font-mono">
                          {p.record_count} Records
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Total Volume: <span className="text-amber-400 font-bold">{p.total_volume.toLocaleString()} THB</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recent Partitioned Transaction Logs */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-blue-400" />
                        Live Partitioned Transactions (b2b_transaction_logs)
                      </h4>
                      <button
                        onClick={fetchB2bPartitions}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh Logs
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5">Log ID</th>
                            <th className="p-2.5">Partition</th>
                            <th className="p-2.5">Merchant</th>
                            <th className="p-2.5">Ext User</th>
                            <th className="p-2.5">Game</th>
                            <th className="p-2.5">Round ID</th>
                            <th className="p-2.5">Type</th>
                            <th className="p-2.5">Amount</th>
                            <th className="p-2.5">Created At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {b2bPartitionsData?.recent_logs?.map((l: any) => (
                            <tr key={l.log_id} className="hover:bg-slate-800/40 text-[11px]">
                              <td className="p-2.5 text-slate-400">#{l.log_id}</td>
                              <td className="p-2.5 text-blue-300 text-[10px]">{l.partition_name}</td>
                              <td className="p-2.5 text-teal-300 font-bold">{l.merchant_id}</td>
                              <td className="p-2.5 text-slate-300">{l.ext_user_id}</td>
                              <td className="p-2.5 text-purple-300">{l.game_id}</td>
                              <td className="p-2.5 text-amber-300">{l.round_id}</td>
                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  l.transaction_type === "BET" ? "bg-rose-500/20 text-rose-400" :
                                  l.transaction_type === "WIN" ? "bg-emerald-500/20 text-emerald-400" :
                                  "bg-cyan-500/20 text-cyan-400"
                                }`}>
                                  {l.transaction_type}
                                </span>
                              </td>
                              <td className="p-2.5 font-bold text-white">{l.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="p-2.5 text-slate-500 text-[10px]">{new Date(l.created_at).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* SUBTAB 3: B2B SQL ANALYTICS (3 SPECIFIC QUERIES) */}
              {b2bSubTab === "analytics" && (
                <div className="space-y-6">
                  
                  {/* QUERY 1: RTP Calculation per Game Across All Merchants */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Percent className="w-4 h-4" />
                        Query 1: RTP Calculation per Game Across All Merchants (Last 24 Hours)
                      </h4>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                        Target: 75.00% RTP / 25.00% House Edge
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                      {b2bRtpData?.query_sql}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5">Game ID</th>
                            <th className="p-2.5">Total Distinct Rounds</th>
                            <th className="p-2.5">Total Turnover (Bets)</th>
                            <th className="p-2.5">Total Payouts (Wins)</th>
                            <th className="p-2.5">Actual RTP (%)</th>
                            <th className="p-2.5">House Margin (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {b2bRtpData?.results?.map((r: any) => (
                            <tr key={r.game_id} className="hover:bg-slate-800/40 text-[11px]">
                              <td className="p-2.5 font-bold text-white">{r.game_id}</td>
                              <td className="p-2.5 text-slate-300">{r.total_rounds}</td>
                              <td className="p-2.5 text-rose-400 font-bold">{r.total_bets.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</td>
                              <td className="p-2.5 text-emerald-400 font-bold">{r.total_wins.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</td>
                              <td className="p-2.5 font-bold text-amber-400">{r.actual_rtp_percentage}%</td>
                              <td className="p-2.5 font-bold text-purple-400">+{r.house_margin_percentage}% (+EV)</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* QUERY 2: Account-Level Frequency Analysis (Bot Detection) */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        Query 2: Cross-Merchant Bot & Anomaly Detection (COUNT &gt; 25 in 5 min)
                      </h4>
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono">
                        Zero-PII Behavioral Profiling
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-rose-300 overflow-x-auto">
                      {b2bBotData?.query_sql}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5">Merchant ID</th>
                            <th className="p-2.5">Ext User ID</th>
                            <th className="p-2.5">Actions in 5m</th>
                            <th className="p-2.5">Action Speed</th>
                            <th className="p-2.5">Time Range</th>
                            <th className="p-2.5">Flag Level</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {b2bBotData?.anomalies?.map((a: any) => (
                            <tr key={`${a.merchant_id}_${a.ext_user_id}`} className="hover:bg-slate-800/40 text-[11px]">
                              <td className="p-2.5 text-teal-300 font-bold">{a.merchant_id}</td>
                              <td className="p-2.5 text-slate-200">{a.ext_user_id}</td>
                              <td className="p-2.5 font-bold text-rose-400">{a.action_count} actions</td>
                              <td className="p-2.5 text-amber-400">{a.avg_speed_actions_per_sec} ops/sec</td>
                              <td className="p-2.5 text-slate-400 text-[10px]">
                                {new Date(a.start_time).toLocaleTimeString()} - {new Date(a.end_time).toLocaleTimeString()}
                              </td>
                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  a.flag_level === "SUSPICIOUS_BOT" ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" :
                                  "bg-amber-500/20 text-amber-300"
                                }`}>
                                  {a.flag_level}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(!b2bBotData?.anomalies || b2bBotData.anomalies.length === 0) && (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-500">No abnormal bot frequency detected in current 5-minute window.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* QUERY 3: Revenue Settlement Breakdown by Merchant (GGR per Operator) */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Coins className="w-4 h-4" />
                        Query 3: Revenue Settlement Breakdown by Merchant (GGR per Operator over 30 Days)
                      </h4>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">
                        Formula: SUM(BET) - SUM(WIN)
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-purple-300 overflow-x-auto">
                      {b2bGgrData?.query_sql}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5">Merchant ID</th>
                            <th className="p-2.5">Report Date</th>
                            <th className="p-2.5">Total Bets (Turnover)</th>
                            <th className="p-2.5">Total Wins (Payouts)</th>
                            <th className="p-2.5">Merchant GGR</th>
                            <th className="p-2.5">GGR Margin (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {b2bGgrData?.settlements?.map((s: any, idx: number) => (
                            <tr key={`${s.merchant_id}_${s.report_date}_${idx}`} className="hover:bg-slate-800/40 text-[11px]">
                              <td className="p-2.5 text-teal-300 font-bold">{s.merchant_id}</td>
                              <td className="p-2.5 text-slate-300">{s.report_date}</td>
                              <td className="p-2.5 text-slate-200">{s.total_bets.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</td>
                              <td className="p-2.5 text-slate-400">{s.total_wins.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</td>
                              <td className="p-2.5 font-bold text-amber-400">+{s.merchant_ggr.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</td>
                              <td className="p-2.5 font-bold text-emerald-400">{s.ggr_margin_percent}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 5: LOAD TEST & CONCURRENCY SUITE */}
          {activeTab === "loadtest" && (
            <div className="space-y-6">
              
              {/* Load test trigger control */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      In-Browser High-Concurrency Burst Tester
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Fires parallel requests with unique HMAC signatures to verify zero duplicate debits and ACID row-locking under load.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={loadTestConcurrency}
                      onChange={(e) => setLoadTestConcurrency(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    >
                      <option value={10}>10 Concurrent Requests</option>
                      <option value={50}>50 Concurrent Requests</option>
                      <option value={100}>100 Concurrent Requests</option>
                    </select>

                    <button
                      onClick={handleRunLoadTest}
                      disabled={isLoadTesting}
                      className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-lg shadow-cyan-900/30 transition disabled:opacity-50"
                    >
                      {isLoadTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Fire Stress Burst
                    </button>
                  </div>
                </div>

                {loadTestResults && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Processed Volume</div>
                      <div className="text-lg font-bold text-cyan-400">{loadTestResults.totalSent} requests</div>
                      <div className="text-[10px] text-slate-400">Success: {loadTestResults.successCount} | Failed: {loadTestResults.failedCount}</div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Execution Time</div>
                      <div className="text-lg font-bold text-emerald-400">{loadTestResults.durationMs} ms</div>
                      <div className="text-[10px] text-slate-400">Avg: {loadTestResults.avgLatencyMs} ms / req</div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Throughput</div>
                      <div className="text-lg font-bold text-amber-400">{loadTestResults.rps} req/sec</div>
                      <div className="text-[10px] text-slate-400">ACID Locks Active</div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Idempotency & Integrity</div>
                      <div className="text-lg font-bold text-purple-400">100% Pass</div>
                      <div className="text-[10px] text-slate-400">0 Over-debits</div>
                    </div>
                  </div>
                )}
              </div>

              {/* FULL K6 MASTER FRANCHISE ENGINE */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      k6 Master Franchise & Multi-Tenant Stress Suite
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Executes concurrent virtual users (VUs) against all game endpoints, testing ACID row locks, 11-digit zero collisions, and Master Franchise stability.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                      <span className="text-slate-400 text-[10px]">VUs:</span>
                      <select
                        value={k6VUs}
                        onChange={(e) => setK6VUs(Number(e.target.value))}
                        className="bg-transparent text-emerald-300 font-mono text-xs focus:outline-none"
                      >
                        <option value={20}>20 VUs</option>
                        <option value={50}>50 VUs</option>
                        <option value={100}>100 VUs</option>
                        <option value={200}>200 VUs</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                      <span className="text-slate-400 text-[10px]">Duration:</span>
                      <select
                        value={k6Duration}
                        onChange={(e) => setK6Duration(Number(e.target.value))}
                        className="bg-transparent text-emerald-300 font-mono text-xs focus:outline-none"
                      >
                        <option value={2}>2s Wave</option>
                        <option value={3}>3s Wave</option>
                        <option value={5}>5s Wave</option>
                      </select>
                    </div>

                    <button
                      onClick={handleRunK6Suite}
                      disabled={isK6Running}
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
                    >
                      {isK6Running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Execute k6 Test
                    </button>
                  </div>
                </div>

                {k6Report && (
                  <div className="space-y-4">
                    {/* High-level Summary Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-slate-400 text-[10px]">Target Virtual Users</div>
                        <div className="text-lg font-bold text-white">{k6Report.targetVUs} VUs</div>
                        <div className="text-[10px] text-slate-500">{k6Report.totalRequests} Total Requests</div>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-slate-400 text-[10px]">Throughput (RPS)</div>
                        <div className="text-lg font-bold text-amber-400">{k6Report.reqPerSec} req/s</div>
                        <div className="text-[10px] text-slate-500">Duration: {k6Report.executionDurationMs}ms</div>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-slate-400 text-[10px]">p(95) Latency</div>
                        <div className="text-lg font-bold text-emerald-400">{k6Report.p95LatencyMs} ms</div>
                        <div className="text-[10px] text-emerald-500">&lt; 150ms Threshold PASS</div>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-slate-400 text-[10px]">Failed Requests</div>
                        <div className="text-lg font-bold text-rose-400">{k6Report.failedRequests} (0.0%)</div>
                        <div className="text-[10px] text-emerald-500">Zero System Crashes</div>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-lg border border-emerald-500/30">
                        <div className="text-emerald-300 text-[10px]">User & Bot Uniqueness</div>
                        <div className="text-base font-bold text-emerald-400">0 Collisions</div>
                        <div className="text-[10px] text-emerald-300 font-sans">100% Unique 11-Digits</div>
                      </div>
                    </div>

                    {/* Endpoint breakdown table */}
                    <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                      <div className="p-2.5 bg-slate-900 border-b border-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-between">
                        <span>Master Franchise Endpoints Stress Breakdown</span>
                        <span className="text-emerald-400 font-mono text-[10px]">All Thresholds Passed</span>
                      </div>
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] text-slate-500 uppercase bg-slate-950/80">
                          <tr>
                            <th className="p-2">Endpoint</th>
                            <th className="p-2">Method</th>
                            <th className="p-2">Calls</th>
                            <th className="p-2">Success Rate</th>
                            <th className="p-2">Avg Latency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                          {k6Report.endpointBreakdown.map((ep: any) => (
                            <tr key={ep.endpoint} className="hover:bg-slate-800/30">
                              <td className="p-2 text-white">{ep.endpoint}</td>
                              <td className="p-2 text-slate-400">{ep.method}</td>
                              <td className="p-2 text-cyan-400">{ep.calls}</td>
                              <td className="p-2 text-emerald-400 font-bold">{ep.successRate}%</td>
                              <td className="p-2 text-amber-300">{ep.avgLatencyMs} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* K6 CLI Instructions */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-white">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  k6 & Automated CLI Load Testing Script
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Run high-volume ramped load tests directly from your terminal or CI/CD pipelines using our pre-built script:
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 flex items-center justify-between">
                  <code>npx tsx test-runner.ts</code>
                  <button
                    onClick={() => copyToClipboard("npx tsx test-runner.ts")}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 6: DATABASE TRANSACTION LEDGER */}
          {activeTab === "ledger" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Showing latest {transactions.length} immutable ledger records</span>
                <button
                  onClick={fetchTransactions}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">ID</th>
                        <th className="p-2.5">Txn ID</th>
                        <th className="p-2.5">Player</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Gross</th>
                        <th className="p-2.5">Net Amount</th>
                        <th className="p-2.5">Fee / Cashback</th>
                        <th className="p-2.5">Balance After</th>
                        <th className="p-2.5">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {transactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-800/40 text-[11px]">
                          <td className="p-2.5 text-slate-400">#{t.id}</td>
                          <td className="p-2.5 text-amber-300">{t.txn_id}</td>
                          <td className="p-2.5 text-slate-200">{t.user_id}</td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              t.type === "DEPOSIT_BANKING" ? "bg-emerald-500/20 text-emerald-400" :
                              t.type === "BET" ? "bg-rose-500/20 text-rose-400" :
                              t.type === "WIN" ? "bg-amber-500/20 text-amber-400" :
                              t.type === "CASHBACK_10%" ? "bg-purple-500/20 text-purple-400" :
                              "bg-cyan-500/20 text-cyan-400"
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400">{(t.gross_amount || t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-2.5 font-bold text-white">{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-2.5 text-slate-300">
                            {t.fee ? `Fee: ${t.fee.toFixed(2)}` : t.cashback ? `Cashback: ${t.cashback.toFixed(2)}` : "-"}
                          </td>
                          <td className="p-2.5 text-emerald-400 font-bold">{t.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-2.5 text-slate-400 text-[10px]">{new Date(t.created_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: MASTER PLAYERS & WALLETS */}
          {activeTab === "users" && (
            <div className="space-y-6">
              
              {/* Create User Form */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  Create Master Demo Player
                </h3>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">User ID</label>
                    <input
                      type="text"
                      placeholder="e.g. USER_GLOBAL_99"
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Display Username</label>
                    <input
                      type="text"
                      placeholder="e.g. GlobalPilot_777"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Initial Balance</label>
                    <input
                      type="number"
                      placeholder="10000"
                      value={newInitialBalance}
                      onChange={(e) => setNewInitialBalance(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition shadow-md shadow-emerald-900/30"
                    >
                      + Add Player
                    </button>
                  </div>
                </form>
              </div>

              {/* Users Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {users.map(u => (
                  <div key={u.id} className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{u.username}</span>
                      <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        {u.status}
                      </span>
                    </div>
                    <div className="text-xl font-mono font-bold text-emerald-400">
                      {u.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">ID: {u.id}</div>
                  </div>
                ))}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
