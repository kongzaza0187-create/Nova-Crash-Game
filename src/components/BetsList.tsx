import React, { useState, memo } from "react";
import { PlayerBet, RoundState, UserStats } from "../types";
import { Users, History, Trophy, RefreshCw, UserCheck } from "lucide-react";
import { formatToStandardUser } from "../utils/userTransform";
import { getMultiplierColorTier } from "../utils/multiplierColor";

export interface TopBetRecord {
  id: string;
  name: string;
  multiplier: number;
  amount: number;
  win: number;
  timestamp: string;
  isBot?: boolean;
}

interface BetsListProps {
  playerBets: PlayerBet[];
  myHistory: Array<{
    id: string;
    amount: number;
    multiplier?: number;
    winAmount?: number;
    timestamp: string;
    cashbackAmount?: number;
  }>;
  topBetsHistory?: TopBetRecord[];
  roundState: RoundState;
  multiplier?: number;
  userStats: UserStats;
  onResetStats: () => void;
}

const BetsListComponent: React.FC<BetsListProps> = ({
  playerBets,
  myHistory,
  topBetsHistory,
  roundState,
  userStats,
  onResetStats,
}) => {
  const [activeTab, setActiveTab] = useState<"ALL" | "MY" | "TOP">("ALL");

  // Fallback high scores with strictly standardized user_XXXXXXXXXXX naming
  const defaultTopBets: TopBetRecord[] = [
    { id: "top_1", name: "user_89401824901", multiplier: 154.20, amount: 2500, win: 385500, timestamp: "Just now", isBot: true },
    { id: "top_2", name: "user_71829401842", multiplier: 88.45, amount: 4000, win: 353800, timestamp: "2m ago", isBot: true },
    { id: "top_3", name: "user_49102849102", multiplier: 45.10, amount: 7500, win: 338250, timestamp: "5m ago", isBot: true },
    { id: "top_4", name: "user_19401829481", multiplier: 32.12, amount: 10000, win: 321200, timestamp: "8m ago", isBot: true },
    { id: "top_5", name: "user_62019481029", multiplier: 24.50, amount: 12500, win: 306250, timestamp: "11m ago", isBot: true },
    { id: "top_6", name: "user_39401829471", multiplier: 18.22, amount: 15000, win: 273300, timestamp: "15m ago", isBot: true },
    { id: "top_7", name: "user_50192849102", multiplier: 12.05, amount: 20000, win: 241000, timestamp: "18m ago", isBot: true },
    { id: "top_8", name: "user_98102938471", multiplier: 9.80, amount: 25000, win: 245000, timestamp: "22m ago", isBot: true },
  ];

  const displayTopBets = topBetsHistory && topBetsHistory.length > 0 ? topBetsHistory : defaultTopBets;
  const totalBetsVolume = playerBets.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div
      className="w-full lg:w-80 bg-[#281117]/90 border border-[#52252e]/80 rounded-xl flex flex-col h-64 sm:h-72 lg:h-[500px] overflow-hidden shadow-xl"
      id="bets_list_container"
    >
      {/* Sidebar Tabs Header */}
      <div className="flex bg-[#1D0A0F] border-b border-[#52252e]/70 p-1 select-none">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg transition ${
            activeTab === "ALL"
              ? "bg-[#3A1920] text-white border-b-2 border-rose-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
          id="btn_all_bets_tab"
        >
          <Users size={13} />
          All Bets ({playerBets.length})
        </button>
        <button
          onClick={() => setActiveTab("MY")}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg transition ${
            activeTab === "MY"
              ? "bg-[#3A1920] text-white border-b-2 border-rose-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
          id="btn_my_bets_tab"
        >
          <History size={13} />
          My Bets
        </button>
        <button
          onClick={() => setActiveTab("TOP")}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg transition ${
            activeTab === "TOP"
              ? "bg-[#3A1920] text-white border-b-2 border-rose-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
          id="btn_top_tab"
        >
          <Trophy size={13} />
          Top
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 flex flex-col min-h-0 p-3 overflow-hidden">
        
        {/* ALL BETS TAB */}
        {activeTab === "ALL" && (
          <div className="flex-1 flex flex-col min-h-0 gap-2.5">
            {/* Round Summary bar */}
            <div className="flex justify-between items-center text-[10px] bg-[#1A090D] p-2 rounded-lg border border-[#481E26] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 uppercase tracking-widest">Active Bets</span>
                <span className="text-[9px] bg-[#2E1218] text-slate-300 px-1.5 py-0.2 rounded font-sans border border-[#52252e]/50">
                  {playerBets.length} Players
                </span>
              </div>
              <span className="text-emerald-400 font-bold">
                {totalBetsVolume.toLocaleString()}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-1.5">
              {playerBets.length === 0 ? (
                <div className="text-center text-xs text-slate-400 my-auto py-10">
                  Waiting for players to place bets...
                </div>
              ) : (
                playerBets.map((player, pIdx) => {
                  const standardizedName = formatToStandardUser(player.name);
                  const isRealUser = (player as any).isRealUser === true;

                  return (
                    <div
                      key={player.id ? `${player.id}_${pIdx}` : `player_${pIdx}`}
                      className={`flex items-center justify-between p-2 rounded-lg bg-[#1A090D]/80 border text-xs transition ${
                        isRealUser
                          ? "border-amber-500/40 bg-amber-500/10 shadow-sm"
                          : player.isCashedOut
                          ? "border-emerald-500/20 bg-emerald-950/20"
                          : player.isBust
                          ? "border-rose-900/30 opacity-40"
                          : "border-[#481E26]"
                      }`}
                      id={`player_bet_item_${player.id}`}
                    >
                      {/* User profile identifier */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-5.5 h-5.5 rounded-md flex items-center justify-center text-[9.5px] font-black uppercase text-slate-950 shadow-sm shrink-0"
                          style={{ backgroundColor: player.avatarColor }}
                        >
                          {player.avatarSeed}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`font-mono text-[11px] font-bold truncate max-w-[110px] ${isRealUser ? "text-amber-300" : "text-slate-300"}`}>
                            {standardizedName}
                          </span>
                          {isRealUser && (
                            <span className="text-[8.5px] text-amber-400 font-sans font-semibold flex items-center gap-0.5">
                              <UserCheck size={9} /> You (Live API)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bet Amount */}
                      <div className="font-mono text-[11px] font-medium text-slate-300 text-right shrink-0">
                        {player.amount.toLocaleString()}
                      </div>

                      {/* Status badge */}
                      <div className="w-20 text-right shrink-0">
                        {player.isCashedOut ? (
                          <div
                            style={{
                              color: getMultiplierColorTier(player.cashOutMultiplier || 1.0).color,
                              borderColor: getMultiplierColorTier(player.cashOutMultiplier || 1.0).borderColor,
                              backgroundColor: getMultiplierColorTier(player.cashOutMultiplier || 1.0).bgColor,
                            }}
                            className="inline-block text-[10px] font-black font-mono px-2 py-0.5 rounded border animate-bounce-short"
                          >
                            {player.cashOutMultiplier?.toFixed(2)}x
                          </div>
                        ) : player.isBust ? (
                          <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
                            Bust
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 italic">
                            Flying ...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* MY BETS TAB */}
        {activeTab === "MY" && (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            {/* Quick stats dashboard */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-[#1A090D] p-2.5 rounded-xl border border-[#481E26]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-mono">Win Rate</span>
                <span className="font-bold text-slate-200">
                  {userStats.totalBets > 0
                    ? `${Math.round((userStats.winCount / userStats.totalBets) * 100)}%`
                    : "0%"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-mono">Net Profit</span>
                <span
                  className={`font-black font-mono ${
                    userStats.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {userStats.netProfit >= 0 ? "+" : ""}
                  {userStats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
              </div>
              
              <div className="col-span-2 pt-1.5 border-t border-[#481E26] flex justify-between items-center text-[9.5px] text-slate-400">
                <span>Bets: {userStats.totalBets}</span>
                <button
                  onClick={onResetStats}
                  className="flex items-center gap-1 hover:text-white transition uppercase font-bold tracking-widest text-[8px]"
                  id="reset_stats_btn"
                >
                  <RefreshCw size={10} /> Reset Session
                </button>
              </div>
            </div>

            {/* History stack */}
            <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-1.5">
              {myHistory.length === 0 ? (
                <div className="text-center text-xs text-slate-400 my-auto py-10">
                  No bets placed in this session.
                </div>
              ) : (
                myHistory.map((item, hIdx) => (
                  <div
                    key={item.id ? `${item.id}_${hIdx}` : `my_hist_${hIdx}`}
                    className="flex justify-between items-start bg-[#1A090D]/90 border border-[#481E26] p-2 rounded-lg text-xs"
                    id={`my_history_item_${item.id || hIdx}`}
                  >
                    {/* Timestamp & Bet info */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-mono tracking-wider">{item.timestamp}</span>
                      <span className="font-bold text-slate-200">
                        {item.amount.toLocaleString()}{!item.multiplier && " — LOSS"}
                      </span>
                    </div>

                    {/* Result details */}
                    <div className="text-right">
                      {item.multiplier ? (
                        <div className="flex flex-col items-end">
                          <span
                            style={{ color: getMultiplierColorTier(item.multiplier).color }}
                            className="text-[10.5px] font-black font-mono"
                          >
                            x{item.multiplier.toFixed(2)}
                          </span>
                          <span className="text-[9.5px] text-slate-300">
                            +{(item.winAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-500/30">
                          Loss
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TOP TAB */}
        {activeTab === "TOP" && (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono border-b border-[#481E26] pb-1.5 flex items-center justify-between">
              <span>Top High-Stakes Winners</span>
              <span>Multiplier / Payout</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
              {displayTopBets.map((item, index) => {
                const formattedName = formatToStandardUser(item.name);
                const tier = getMultiplierColorTier(item.multiplier);

                return (
                  <div
                    key={item.id ? `${item.id}_${index}` : `top_item_${index}`}
                    className="flex items-center justify-between bg-[#1A090D]/80 border border-[#481E26]/80 px-2.5 py-2 rounded-lg text-xs"
                    id={`top_leader_payout_${index}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Position circle */}
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                          index === 0
                            ? "bg-amber-400 text-slate-950 shadow-sm"
                            : index === 1
                            ? "bg-slate-300 text-slate-950"
                            : index === 2
                            ? "bg-amber-700 text-slate-100"
                            : "bg-[#2E1218] text-slate-300 border border-[#52252e]/50"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono font-bold text-slate-200 text-[11px] truncate max-w-[120px]">
                          {formattedName}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          Bet: {item.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Multipliers with calibrated colors */}
                    <div className="flex flex-col items-end shrink-0">
                      <span
                        style={{ color: tier.color }}
                        className="font-black font-mono text-[11px]"
                      >
                        x{item.multiplier.toFixed(2)}
                      </span>
                      <span className="text-[10.5px] text-amber-300 font-mono font-bold">
                        +{item.win.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export const BetsList: React.FC<BetsListProps> = memo(BetsListComponent);

