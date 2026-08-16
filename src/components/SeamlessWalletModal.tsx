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
  DollarSign
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdated?: () => void;
}

type EndpointType = "webhook" | "balance" | "debit" | "credit" | "loss" | "rollback";

export const SeamlessWalletModal: React.FC<Props> = ({ isOpen, onClose, onBalanceUpdated }) => {
  const [activeTab, setActiveTab] = useState<"explorer" | "ledger" | "users" | "docs" | "schema">("explorer");
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointType>("webhook");
  
  // Test parameters
  const [selectedUserId, setSelectedUserId] = useState<string>("USER_TH_001");
  const [txnId, setTxnId] = useState<string>(() => "TXN_" + Date.now().toString().slice(-8));
  const [refTxnId, setRefTxnId] = useState<string>("");
  const [amount, setAmount] = useState<string>("1000");
  const [gameId, setGameId] = useState<string>("SKY_RUSH");
  const [secretKey, setSecretKey] = useState<string>("YOUR_SUPER_SECRET_HMAC_KEY");
  const [useHmacHeader, setUseHmacHeader] = useState<boolean>(true);

  // Live state
  const [users, setUsers] = useState<WalletUser[]>([]);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiStatus, setApiStatus] = useState<number | null>(null);
  const [computedSignature, setComputedSignature] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [lastExecutedTxn, setLastExecutedTxn] = useState<string>("");

  // New user form
  const [newUserId, setNewUserId] = useState<string>("");
  const [newUsername, setNewUsername] = useState<string>("");
  const [newInitialBalance, setNewInitialBalance] = useState<string>("10000");

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

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchTransactions();
      generateNewTxnId();
    }
  }, [isOpen]);

  // Compute HMAC signature whenever payload changes
  const buildPayload = () => {
    switch (selectedEndpoint) {
      case "webhook":
        return {
          txn_id: txnId,
          user_id: selectedUserId,
          amount_thb: parseFloat(amount) || 1000,
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
          game_id: gameId
        };
      case "credit":
        return {
          txn_id: txnId,
          user_id: selectedUserId,
          win_amount: parseFloat(amount) || 2000,
          game_id: gameId
        };
      case "loss":
        return {
          txn_id: txnId,
          bet_txn_id: refTxnId || `BET_${txnId.slice(0, 10)}`,
          user_id: selectedUserId,
          loss_amount: parseFloat(amount) || 500,
          game_id: gameId
        };
      case "rollback":
        return {
          txn_id: txnId,
          ref_txn_id: refTxnId || lastExecutedTxn,
          user_id: selectedUserId
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
  }, [selectedEndpoint, selectedUserId, txnId, refTxnId, amount, gameId, secretKey]);

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
      case "webhook":
        url = "/api/v1/payment/webhook";
        break;
      case "balance":
        url = "/api/v1/wallet/balance";
        break;
      case "debit":
        url = "/api/v1/wallet/debit";
        break;
      case "credit":
        url = "/api/v1/wallet/credit";
        break;
      case "loss":
        url = "/api/v1/wallet/loss";
        break;
      case "rollback":
        url = "/api/v1/wallet/rollback";
        break;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (useHmacHeader) {
        // compute signature for payload
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
      if (onBalanceUpdated) onBalanceUpdated();

      // auto-prepare next fresh txnId for convenience unless testing idempotency
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
    if (!confirm("Are you sure you want to reset all wallet transactions and users to default seed data?")) return;
    try {
      await fetch("/api/v1/wallet/reset-demo", { method: "POST" });
      await fetchUsers();
      await fetchTransactions();
      setApiResponse({ status: "SUCCESS", message: "Database reset to initial demo state." });
      setApiStatus(200);
    } catch (err) {
      console.error(err);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto">
      <div className="bg-[#121620] border border-slate-700/80 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1117]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Building2 className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">iGaming Master Franchise Seamless Wallet Hub</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  THB (฿) Central
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Master Multi-Tenant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                PostgreSQL Architecture • SELECT ... FOR UPDATE Locking • 10% Loss Cashback • 3% Win House Fee • PromptPay Webhook
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDemo}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              title="Reset Demo Data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset DB
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-lg font-semibold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* FINANCIAL SUMMARY OVERVIEW BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-6 py-3 bg-[#0a0d13] border-b border-slate-800/80 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1 mb-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mobile Banking Deposits</span>
            </div>
            <div className="text-base font-bold text-emerald-400">฿{totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1 mb-1">
              <Coins className="w-3.5 h-3.5 text-rose-400" />
              <span>Total Wagers (Debit)</span>
            </div>
            <div className="text-base font-bold text-rose-400">฿{totalBets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1 mb-1">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              <span>House Fee Collected (3%)</span>
            </div>
            <div className="text-base font-bold text-amber-400">฿{totalHouseFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1 mb-1">
              <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
              <span>Cashback Refunded (10%)</span>
            </div>
            <div className="text-base font-bold text-purple-400">฿{totalCashback.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-slate-800 bg-[#0f141c] px-6 gap-1">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "explorer"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            Live API Console & Tester
          </button>

          <button
            onClick={() => { setActiveTab("ledger"); fetchTransactions(); }}
            className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "ledger"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            Database Ledger ({transactions.length})
          </button>

          <button
            onClick={() => { setActiveTab("users"); fetchUsers(); }}
            className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "users"
                ? "border-blue-500 text-blue-400 bg-blue-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wallet className="w-4 h-4" />
            Master Players / Wallets ({users.length})
          </button>

          <button
            onClick={() => setActiveTab("schema")}
            className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "schema"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-4 h-4" />
            PostgreSQL Schema (DDL)
          </button>

          <button
            onClick={() => setActiveTab("docs")}
            className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "docs"
                ? "border-purple-500 text-purple-400 bg-purple-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code className="w-4 h-4" />
            Integration Specs & Code
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0c1017]">

          {/* TAB 1: API EXPLORER */}
          {activeTab === "explorer" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: ENDPOINT SELECTOR & PARAMS */}
              <div className="lg:col-span-6 space-y-4">
                
                {/* 1. Endpoint Selection Cards */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-2 block uppercase tracking-wider">
                    Select Seamless Wallet Action
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => setSelectedEndpoint("webhook")}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "webhook"
                          ? "bg-emerald-950/50 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                        PromptPay Deposit
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">/payment/webhook</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("balance")}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "balance"
                          ? "bg-blue-950/50 border-blue-500 text-blue-300 shadow-md shadow-blue-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Wallet className="w-4 h-4 text-blue-400" />
                        Get Balance
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">/wallet/balance</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("debit")}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "debit"
                          ? "bg-rose-950/50 border-rose-500 text-rose-300 shadow-md shadow-rose-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Coins className="w-4 h-4 text-rose-400" />
                        Debit / Place Bet
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">/wallet/debit</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("credit")}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "credit"
                          ? "bg-amber-950/50 border-amber-500 text-amber-300 shadow-md shadow-amber-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Percent className="w-4 h-4 text-amber-400" />
                        Win (House Fee 3%)
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">/wallet/credit</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("loss")}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "loss"
                          ? "bg-purple-950/50 border-purple-500 text-purple-300 shadow-md shadow-purple-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <RotateCcw className="w-4 h-4 text-purple-400" />
                        Loss (Cashback 10%)
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">/wallet/loss</div>
                    </button>

                    <button
                      onClick={() => setSelectedEndpoint("rollback")}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        selectedEndpoint === "rollback"
                          ? "bg-cyan-950/50 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-900/20"
                          : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-cyan-400" />
                        Rollback Bet
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">/wallet/rollback</div>
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
                      <label className="text-[11px] text-slate-400 block mb-1">Target User / Player</label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.username} (฿{u.balance.toLocaleString()}) [{u.id}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Transaction ID (txn_id)</label>
                      <input
                        type="text"
                        value={txnId}
                        onChange={(e) => setTxnId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {selectedEndpoint !== "balance" && selectedEndpoint !== "rollback" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          {selectedEndpoint === "credit" ? "Gross Win (ยอดชนะ THB)" : selectedEndpoint === "loss" ? "Loss Amount (ยอดเสีย THB)" : "Amount (THB)"}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs text-slate-400">฿</span>
                          <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Game Identifier (game_id)</label>
                        <input
                          type="text"
                          value={gameId}
                          onChange={(e) => setGameId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {(selectedEndpoint === "loss" || selectedEndpoint === "rollback") && (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Reference Bet Txn ID (ref_txn_id)
                      </label>
                      <input
                        type="text"
                        value={refTxnId}
                        onChange={(e) => setRefTxnId(e.target.value)}
                        placeholder="e.g. TXN_BET_99812456"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  {/* BUSINESS LOGIC PREVIEWS */}
                  {selectedEndpoint === "credit" && (
                    <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-300 flex items-center justify-between">
                      <span>✨ Gross Win: ฿{parseFloat(amount || "0").toLocaleString()}</span>
                      <span className="text-rose-400 font-medium">- 3% House Fee: ฿{(parseFloat(amount || "0") * 0.03).toFixed(2)}</span>
                      <span className="text-emerald-400 font-bold">= Net Win Added: ฿{(parseFloat(amount || "0") * 0.97).toFixed(2)}</span>
                    </div>
                  )}

                  {selectedEndpoint === "loss" && (
                    <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/30 text-[11px] text-purple-300 flex items-center justify-between">
                      <span>💀 Loss: ฿{parseFloat(amount || "0").toLocaleString()}</span>
                      <span className="text-emerald-400 font-bold">🎁 + 10% Instant Cashback: ฿{(parseFloat(amount || "0") * 0.10).toFixed(2)} (Auto-Credited)</span>
                    </div>
                  )}

                  {/* HMAC & Idempotency Controls */}
                  <div className="border-t border-slate-800 pt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useHmacHeader}
                          onChange={(e) => setUseHmacHeader(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                        />
                        <span className="text-slate-300 text-[11px]">Enforce HMAC-SHA256 Header (x-signature)</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]" title={computedSignature}>
                        Sig: {computedSignature ? computedSignature.slice(0, 16) + "..." : "Computing..."}
                      </span>
                    </div>
                  </div>

                  {/* EXECUTE & IDEMPOTENCY BUTTONS */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleExecuteApi()}
                      disabled={isLoading}
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Execute API Request
                    </button>

                    {lastExecutedTxn && (
                      <button
                        onClick={() => handleExecuteApi(lastExecutedTxn)}
                        disabled={isLoading}
                        title="Re-send the same txn_id to verify Idempotency (duplicate rejection/handling)"
                        className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        Test Idempotency
                      </button>
                    )}
                  </div>
                </div>

                {/* QUICK SCENARIO PRESETS */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2">⚡ 1-Click Test Scenarios</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => {
                        setSelectedEndpoint("webhook");
                        setAmount("5000");
                        generateNewTxnId();
                      }}
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700"
                    >
                      💰 Deposit PromptPay ฿5,000
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEndpoint("debit");
                        setAmount("500");
                        generateNewTxnId();
                      }}
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-rose-300 rounded border border-slate-700"
                    >
                      🎯 Place Bet ฿500
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEndpoint("credit");
                        setAmount("2000");
                        generateNewTxnId();
                      }}
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-amber-300 rounded border border-slate-700"
                    >
                      🏆 Win ฿2,000 (Deduct 3% Fee)
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEndpoint("loss");
                        setAmount("1000");
                        generateNewTxnId();
                      }}
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-purple-300 rounded border border-slate-700"
                    >
                      🛡️ Loss ฿1,000 (Get 10% Cashback)
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: LIVE HTTP INSPECTOR */}
              <div className="lg:col-span-6 space-y-4">
                
                {/* Request Inspector */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        POST
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        /api/v1/{selectedEndpoint === "webhook" ? "payment/webhook" : `wallet/${selectedEndpoint}`}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">Request Payload</span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono mb-2 bg-slate-950/70 p-2 rounded border border-slate-800/80">
                    <div><span className="text-slate-400">Content-Type:</span> application/json</div>
                    <div><span className="text-amber-400">x-signature:</span> {useHmacHeader ? computedSignature : "none (dev-bypass)"}</div>
                  </div>

                  <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800/80">
                    {JSON.stringify(buildPayload(), null, 2)}
                  </pre>
                </div>

                {/* Response Inspector */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">Server Response</span>
                      {apiStatus && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          apiStatus >= 200 && apiStatus < 300 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}>
                          HTTP {apiStatus}
                        </span>
                      )}
                    </div>
                    {apiResponse?.alreadyProcessed && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Idempotency Handled
                      </span>
                    )}
                  </div>

                  {apiResponse ? (
                    <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto border border-slate-800/80 max-h-[220px]">
                      {JSON.stringify(apiResponse, null, 2)}
                    </pre>
                  ) : (
                    <div className="bg-slate-950/60 p-8 rounded-lg text-center text-xs text-slate-400 border border-dashed border-slate-800">
                      Click "Execute API Request" to send and inspect real-time response.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: DATABASE LEDGER */}
          {activeTab === "ledger" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Immutable Transactions Ledger (SELECT ... FOR UPDATE Audit)</h3>
                  <p className="text-xs text-slate-400">All financial events with idempotency tracking and balance history</p>
                </div>
                <button
                  onClick={fetchTransactions}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg flex items-center gap-1.5 border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0a0d13] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Transaction ID</th>
                        <th className="py-2.5 px-3">Ref ID</th>
                        <th className="py-2.5 px-3">User</th>
                        <th className="py-2.5 px-3 text-right">Net Amount</th>
                        <th className="py-2.5 px-3 text-right">House Fee (3%)</th>
                        <th className="py-2.5 px-3 text-right">Cashback (10%)</th>
                        <th className="py-2.5 px-3 text-right">Balance After</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                            No transactions recorded yet. Execute an API request in the console to seed ledger.
                          </td>
                        </tr>
                      ) : (
                        transactions.map(tx => {
                          const typeBadge = () => {
                            switch (tx.type) {
                              case "DEPOSIT_BANKING":
                                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">DEPOSIT</span>;
                              case "BET":
                                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">BET DEBIT</span>;
                              case "WIN":
                                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">WIN (FEE 3%)</span>;
                              case "CASHBACK_10%":
                                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">CASHBACK 10%</span>;
                              case "ROLLBACK":
                                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">ROLLBACK</span>;
                              default:
                                return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{tx.type}</span>;
                            }
                          };

                          return (
                            <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2 px-3 text-slate-400">{tx.id}</td>
                              <td className="py-2 px-3 font-sans">{typeBadge()}</td>
                              <td className="py-2 px-3 text-amber-300 font-bold truncate max-w-[140px]" title={tx.txn_id}>{tx.txn_id}</td>
                              <td className="py-2 px-3 text-slate-400 truncate max-w-[120px]" title={tx.ref_txn_id || ""}>{tx.ref_txn_id || "-"}</td>
                              <td className="py-2 px-3 text-blue-300">{tx.user_id}</td>
                              <td className={`py-2 px-3 text-right font-bold ${tx.type === "BET" ? "text-rose-400" : "text-emerald-400"}`}>
                                {tx.type === "BET" ? "-" : "+"}฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-right text-amber-400">
                                {tx.fee && tx.fee > 0 ? `฿${tx.fee.toFixed(2)}` : "-"}
                              </td>
                              <td className="py-2 px-3 text-right text-purple-400">
                                {tx.cashback && tx.cashback > 0 ? `฿${tx.cashback.toFixed(2)}` : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-100">
                                ฿{tx.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-slate-400 font-sans text-[10px]">
                                {new Date(tx.created_at).toLocaleTimeString()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USERS & WALLETS */}
          {activeTab === "users" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-3">
                <h3 className="text-sm font-bold text-white">Registered Master Player Wallets (THB)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {users.map(u => (
                    <div key={u.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-white">{u.username}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {u.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono">User ID: {u.id}</div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Current Balance</span>
                        <span className="text-lg font-bold text-emerald-400">฿{u.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CREATE USER FORM */}
              <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  Create Master Player
                </h3>
                <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">User ID</label>
                    <input
                      type="text"
                      placeholder="e.g. USER_TH_004"
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Username / Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. MasterGamer_99"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Initial Balance (THB)</label>
                    <input
                      type="number"
                      value={newInitialBalance}
                      onChange={(e) => setNewInitialBalance(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors"
                  >
                    + Register Player Wallet
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: POSTGRESQL SCHEMA */}
          {activeTab === "schema" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Production PostgreSQL Schema (schema.sql)</h3>
                  <p className="text-xs text-slate-400">PostgreSQL DDL script with Row-Level Locking (FOR UPDATE) & Idempotency indexes</p>
                </div>
                <button
                  onClick={() => copyToClipboard(`-- PostgreSQL Master Franchise Schema
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'THB',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    txn_id VARCHAR(100) UNIQUE NOT NULL,
    ref_txn_id VARCHAR(100),
    user_id VARCHAR(50) REFERENCES users(id),
    amount NUMERIC(15, 2) NOT NULL,
    fee NUMERIC(15, 2) DEFAULT 0.00,
    balance_after NUMERIC(15, 2),
    type VARCHAR(30) NOT NULL,
    game_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'SUCCESS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_txn_id ON transactions(txn_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);`)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg flex items-center gap-1.5 border border-slate-700"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? "Copied!" : "Copy SQL"}
                </button>
              </div>

              <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto border border-slate-800 leading-relaxed">
{`-- ============================================================================
-- iGaming Master Franchise Seamless Wallet Database Schema (PostgreSQL)
-- Currency: THB (Thai Baht)
-- Features: Row-level Locking (FOR UPDATE), Idempotency, 10% Cashback, 3% House Fee
-- ============================================================================

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- สกุลเงินบาท THB
    currency VARCHAR(10) NOT NULL DEFAULT 'THB',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, SUSPENDED, BLOCKED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    txn_id VARCHAR(100) UNIQUE NOT NULL,          -- Unique ID สำหรับป้องกันการยิงซ้ำ (Idempotency)
    ref_txn_id VARCHAR(100),                       -- อ้างอิง Transaction เดิม (เช่น บิลเดิมพันสำหรับ LOSS/ROLLBACK)
    user_id VARCHAR(50) REFERENCES users(id),
    amount NUMERIC(15, 2) NOT NULL,                -- ยอดเงินสุทธิที่ทำรายการ (THB)
    fee NUMERIC(15, 2) DEFAULT 0.00,               -- ค่าธรรมเนียม 3% ค่าน้ำ (House Fee / Commission)
    balance_after NUMERIC(15, 2),                  -- ยอดเงินคงเหลือหลังทำรายการ
    type VARCHAR(30) NOT NULL,                     -- 'DEPOSIT_BANKING', 'BET', 'WIN', 'CASHBACK_10%', 'ROLLBACK'
    game_id VARCHAR(50),                           -- เช่น 'SKY_RUSH', 'MINES_SLOT'
    status VARCHAR(20) DEFAULT 'SUCCESS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_txn_id ON transactions(txn_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_ref_txn_id ON transactions(ref_txn_id);`}
              </pre>
            </div>
          )}

          {/* TAB 5: INTEGRATION DOCS & CODE EXAMPLES */}
          {activeTab === "docs" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <h4 className="text-sm font-bold text-amber-400">Master Franchise Integration Rules:</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                  <li><strong>Currency:</strong> THB (Thai Baht) formatted to 2 decimal places.</li>
                  <li><strong>Security:</strong> All requests must include header <code className="text-amber-300 font-mono">x-signature</code> computed with <code className="text-amber-300 font-mono">crypto.createHmac('sha256', SECRET_KEY).update(JSON.stringify(req.body)).digest('hex')</code>.</li>
                  <li><strong>Win Calculation (3% Commission):</strong> <code className="text-emerald-400 font-mono">houseFee = grossWin * 0.03; netWin = grossWin - houseFee;</code></li>
                  <li><strong>Loss Calculation (10% Cashback):</strong> <code className="text-purple-400 font-mono">cashbackAmount = lossAmount * 0.10;</code> (auto credited back to player).</li>
                  <li><strong>Idempotency:</strong> Every <code className="text-amber-300 font-mono">txn_id</code> is checked before locking row. Duplicate calls return the existing transaction state without double-debiting or double-crediting.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Node.js (Express) Endpoint Client Implementation</span>
                  <button
                    onClick={() => copyToClipboard(`// Seamless Wallet Client Helper
const crypto = require('crypto');

function signPayload(body, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(JSON.stringify(body)).digest('hex');
}

async function callSeamlessWallet(endpoint, body) {
  const signature = signPayload(body, 'YOUR_SUPER_SECRET_HMAC_KEY');
  const res = await fetch('https://your-domain.com/api/v1/wallet/' + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature
    },
    body: JSON.stringify(body)
  });
  return await res.json();
}`)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy Node.js Snippet
                  </button>
                </div>

                <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">
{`const crypto = require('crypto');

// 1. Generate Signature
function signPayload(body, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(JSON.stringify(body)).digest('hex');
}

// 2. Call Debit (Bet)
const debitRes = await fetch('/api/v1/wallet/debit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-signature': signPayload({ txn_id: 'TXN_101', user_id: 'USER_TH_001', amount: 500, game_id: 'SKY_RUSH' }, API_SECRET_KEY)
  },
  body: JSON.stringify({ txn_id: 'TXN_101', user_id: 'USER_TH_001', amount: 500, game_id: 'SKY_RUSH' })
});

// 3. Call Credit (Win) with 3% House Fee Deduction
const winRes = await fetch('/api/v1/wallet/credit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-signature': signPayload({ txn_id: 'TXN_102', user_id: 'USER_TH_001', win_amount: 2000, game_id: 'SKY_RUSH' }, API_SECRET_KEY)
  },
  body: JSON.stringify({ txn_id: 'TXN_102', user_id: 'USER_TH_001', win_amount: 2000, game_id: 'SKY_RUSH' })
});`}
                </pre>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-[#0d1117] text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Master Franchise Central Server: <strong>0.0.0.0:3000</strong> (Active & Certified)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition-colors"
          >
            Close Console
          </button>
        </div>

      </div>
    </div>
  );
};
