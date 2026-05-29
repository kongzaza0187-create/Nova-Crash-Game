import React, { useState } from "react";
import { PlayerBet, RoundState, UserStats } from "../types";
import { Users, History, GraduationCap, Trophy, RefreshCw } from "lucide-react";

interface BetsListProps {
  playerBets: PlayerBet[];
  myHistory: Array<{
    id: string;
    amount: number;
    multiplier?: number;
    winAmount?: number;
    timestamp: string;
  }>;
  roundState: RoundState;
  multiplier: number;
  userStats: UserStats;
  onResetStats: () => void;
}

export const BetsList: React.FC<BetsListProps> = ({
  playerBets,
  myHistory,
  roundState,
  multiplier,
  userStats,
  onResetStats,
}) => {
  const [activeTab, setActiveTab] = useState<"ALL" | "MY" | "TOP">("ALL");

  // Filter out simulated top multipliers for the TOP tab
  const simulatedTopBets = [
    { name: "Captain_Awesome", multiplier: 154.2, amount: 50, win: 7710 },
    { name: "SkyHeist", multiplier: 88.45, amount: 200, win: 17690 },
    { name: "LuckyWing", multiplier: 45.1, amount: 500, win: 22550 },
    { name: "TurboRacer", multiplier: 32.12, amount: 150, win: 4818 },
    { name: "FlyHigh_99", multiplier: 24.5, amount: 300, win: 7350 },
    { name: "BollyGambling", multiplier: 18.22, amount: 1000, win: 18220 },
    { name: "AviationGuru", multiplier: 12.05, amount: 500, win: 6025 },
  ];

  const totalBetsVolume = playerBets.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div
      className="w-full lg:w-80 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col h-[500px] overflow-hidden"
      id="bets_list_container"
    >
      {/* Sidebar Tabs Header */}
      <div className="flex bg-slate-900/60 border-b border-slate-850 p-1 select-none">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg transition ${
            activeTab === "ALL"
              ? "bg-slate-850 text-white border-b-2 border-rose-500"
              : "text-slate-400 hover:text-white"
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
              ? "bg-slate-850 text-white border-b-2 border-rose-500"
              : "text-slate-400 hover:text-white"
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
              ? "bg-slate-850 text-white border-b-2 border-rose-500"
              : "text-slate-400 hover:text-white"
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
            <div className="flex justify-between items-center text-[10px] bg-slate-900/40 p-2 rounded-lg border border-slate-900 font-mono">
              <span className="text-slate-500 uppercase tracking-widest">Active Stakes</span>
              <span className="text-emerald-400 font-bold">
                {totalBetsVolume.toLocaleString()} THB
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-1.5">
              {playerBets.length === 0 ? (
                <div className="text-center text-xs text-slate-500 my-auto py-10">
                  Waiting for players to place bets...
                </div>
              ) : (
                playerBets.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-2 rounded-lg bg-slate-900/30 border text-xs transition ${
                      player.isCashedOut
                        ? "border-emerald-500/10 bg-emerald-950/5"
                        : player.isBust
                        ? "border-rose-900/20 opacity-40"
                        : "border-slate-900"
                    }`}
                    id={`player_bet_item_${player.id}`}
                  >
                    {/* User profile identifier */}
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5.5 h-5.5 rounded-md flex items-center justify-center text-[9.5px] font-black uppercase text-slate-950 shadow-sm"
                        style={{ backgroundColor: player.avatarColor }}
                      >
                        {player.avatarSeed}
                      </div>
                      <span className="font-bold text-slate-300 truncate max-w-[85px]">
                        {player.name}
                      </span>
                    </div>

                    {/* Bet Amount */}
                    <div className="font-mono text-[11px] font-medium text-slate-400 text-right">
                      {player.amount.toLocaleString()}
                    </div>

                    {/* Status badge */}
                    <div className="w-20 text-right">
                      {player.isCashedOut ? (
                        <div className="inline-block bg-emerald-500/10 text-emerald-400 text-[10px] font-black font-mono px-2 py-0.5 rounded border border-emerald-500/10 animate-bounce-short">
                          {player.cashOutMultiplier?.toFixed(2)}x
                        </div>
                      ) : player.isBust ? (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/5">
                          Bust
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500 italic">
                          Flying ...
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MY BETS TAB */}
        {activeTab === "MY" && (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            {/* Quick stats dashboard */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/40 p-2.5 rounded-xl border border-slate-900">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9.5px] text-slate-500 uppercase tracking-wider font-mono">Win Rate</span>
                <span className="font-bold text-slate-200">
                  {userStats.totalBets > 0
                    ? `${Math.round((userStats.winCount / userStats.totalBets) * 100)}%`
                    : "0%"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9.5px] text-slate-500 uppercase tracking-wider font-mono">Net Profit</span>
                <span
                  className={`font-black font-mono ${
                    userStats.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {userStats.netProfit >= 0 ? "+" : ""}
                  {userStats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} THB
                </span>
              </div>
              
              <div className="col-span-2 pt-1.5 border-t border-slate-850 flex justify-between items-center text-[9.5px] text-slate-500">
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
                <div className="text-center text-xs text-slate-500 my-auto py-10">
                  No bets placed in this session.
                </div>
              ) : (
                myHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-slate-900/20 border border-slate-900 p-2 rounded-lg text-xs"
                    id={`my_history_item_${item.id}`}
                  >
                    {/* Timestamp & Stake info */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-mono tracking-wider">{item.timestamp}</span>
                      <span className="font-bold text-slate-300">{item.amount.toLocaleString()} THB</span>
                    </div>

                    {/* Result details */}
                    <div className="text-right">
                      {item.multiplier ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[10.5px] font-black text-emerald-400 font-mono">
                            x{item.multiplier.toFixed(2)}
                          </span>
                          <span className="text-[9.5px] text-slate-400">
                            +{(item.winAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} THB
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/5">
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
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono border-b border-slate-900 pb-1.5 flex items-center justify-between">
              <span>Leaderboard</span>
              <span>Top Coeffs</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
              {simulatedTopBets.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-slate-900/10 border border-slate-900/50 px-2.5 py-2 rounded-lg text-xs"
                  id={`top_leader_payout_${index}`}
                >
                  <div className="flex items-center gap-2">
                    {/* Position circle */}
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                        index === 0
                          ? "bg-amber-400 text-slate-950 shadow-sm"
                          : index === 1
                          ? "bg-slate-300 text-slate-950"
                          : index === 2
                          ? "bg-amber-700 text-slate-100"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="font-semibold text-slate-300 truncate max-w-[110px]">
                      {item.name}
                    </span>
                  </div>

                  {/* Multipliers with colors representing size */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-black font-mono text-[11px] ${
                        item.multiplier >= 100
                          ? "text-fuchsia-400 shadow-fuchsia-500/10"
                          : item.multiplier >= 30
                          ? "text-rose-400"
                          : "text-blue-400"
                      }`}
                    >
                      x{item.multiplier.toFixed(2)}
                    </span>
                    <span className="text-[10.5px] text-slate-500 font-mono text-right w-14">
                      {item.win.toLocaleString()} THB
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
