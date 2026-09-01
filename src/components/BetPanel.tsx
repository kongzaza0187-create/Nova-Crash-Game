import React, { useState, useEffect, memo } from "react";
import { Bet, RoundState } from "../types";
import { Plus, Minus, Coins, TrendingUp } from "lucide-react";
import { audioManager } from "../audio";

interface BetPanelProps {
  id: string;
  bet: Bet;
  roundState: RoundState;
  multiplier: number;
  userBalance: number;
  onPlaceBet: (amount: number) => void;
  onCancelBet: () => void;
  onCashOut: () => void;
  onUpdateAutoSettings: (isAutoBet: boolean, isAutoCashOut: boolean, autoCashOutMultiplier: number) => void;
}

function areBetPanelPropsEqual(prev: BetPanelProps, next: BetPanelProps) {
  // If active round is flying and user has an active un-cashed bet, we must update when multiplier updates
  const isActivelyCashingOut = next.roundState === "FLYING" && next.bet.isPlaced && !next.bet.hasCashedOut;
  const wasActivelyCashingOut = prev.roundState === "FLYING" && prev.bet.isPlaced && !prev.bet.hasCashedOut;

  if (isActivelyCashingOut || wasActivelyCashingOut) {
    if (prev.multiplier !== next.multiplier) return false;
  }

  return (
    prev.id === next.id &&
    prev.roundState === next.roundState &&
    prev.userBalance === next.userBalance &&
    prev.bet === next.bet &&
    prev.onPlaceBet === next.onPlaceBet &&
    prev.onCancelBet === next.onCancelBet &&
    prev.onCashOut === next.onCashOut &&
    prev.onUpdateAutoSettings === next.onUpdateAutoSettings
  );
}

const BetPanelComponent: React.FC<BetPanelProps> = ({
  id,
  bet,
  roundState,
  multiplier,
  userBalance,
  onPlaceBet,
  onCancelBet,
  onCashOut,
  onUpdateAutoSettings,
}) => {
  const [selectedTab, setSelectedTab] = useState<"MANUAL" | "AUTO">("MANUAL");
  const [betAmount, setBetAmount] = useState<number>(100);
  
  // Rule check: Lock betting inputs if round is FLYING, FLEW_AWAY, or if bet is already placed
  const isLocked = roundState === "FLYING" || roundState === "FLEW_AWAY" || bet.isPlaced;
  
  // Auto configs
  const [isAutoBet, setIsAutoBet] = useState<boolean>(bet.isAutoBet);
  const [isAutoCashOut, setIsAutoCashOut] = useState<boolean>(bet.isAutoCashOut);
  const [autoCashOutVal, setAutoCashOutVal] = useState<number>(bet.autoCashOutMultiplier);

  // Celebratory overlay state when cashing out with > 6.0x
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // Keep state synced with prop when autos are modified externally
  useEffect(() => {
    setIsAutoBet(bet.isAutoBet);
    setIsAutoCashOut(bet.isAutoCashOut);
    setAutoCashOutVal(bet.autoCashOutMultiplier);

    if (bet.hasCashedOut && bet.cashedOutMultiplier && bet.cashedOutMultiplier > 6.0) {
      setShowCelebration(true);
    } else {
      setShowCelebration(false);
    }
  }, [bet]);

  // Handle amount doubling (plus button) and halving (minus button)
  const handleDoubleAmount = () => {
    audioManager.playClick();
    setBetAmount((prev) => {
      const next = prev * 2;
      return next > 8000 ? 8000 : next;
    });
  };

  const handleHalveAmount = () => {
    audioManager.playClick();
    setBetAmount((prev) => {
      const next = Math.floor(prev / 2);
      return next < 20 ? 20 : next;
    });
  };

  const setFixedAmount = (amt: number) => {
    audioManager.playClick();
    setBetAmount(Math.min(8000, Math.max(20, amt)));
  };

  // Safe decimal parsing for auto Cash Out
  const handleAutoMultiplierChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setAutoCashOutVal(num);
      onUpdateAutoSettings(isAutoBet, isAutoCashOut, num);
    } else {
      setAutoCashOutVal(1.01);
    }
  };

  const toggleAutoBet = () => {
    audioManager.playClick();
    const next = !isAutoBet;
    setIsAutoBet(next);
    onUpdateAutoSettings(next, isAutoCashOut, autoCashOutVal);
  };

  const toggleAutoCashOut = () => {
    audioManager.playClick();
    const next = !isAutoCashOut;
    setIsAutoCashOut(next);
    onUpdateAutoSettings(isAutoBet, next, autoCashOutVal);
  };

  // Determine button state and label
  const getActionButtonConfig = () => {
    if (roundState === "WAITING") {
      if (bet.isPlaced) {
        return {
          label: "CANCEL",
          sub: "Waiting...",
          outerLayer: "bg-gradient-to-b from-amber-600 via-amber-800 to-amber-950 shadow-[0_6px_14px_rgba(217,119,6,0.35),0_3px_0_#451a03] border border-amber-500/40",
          innerLayer: "bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 border-t border-amber-200/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]",
          textClass: "text-slate-950 font-black",
          subClass: "text-amber-950 font-bold bg-amber-300/70 border border-amber-200/50",
          action: onCancelBet,
          disabled: false,
        };
      } else {
        return {
          label: "BET",
          sub: `${betAmount.toLocaleString()}`,
          outerLayer: "bg-gradient-to-b from-emerald-500 via-emerald-700 to-emerald-950 shadow-[0_8px_18px_rgba(16,185,129,0.4),0_4px_0_#022c22,inset_0_1px_1px_rgba(255,255,255,0.4)] border border-emerald-400/40",
          innerLayer: "bg-gradient-to-b from-emerald-300 via-emerald-500 to-teal-600 border-t border-emerald-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-2px_6px_rgba(2,44,34,0.3)]",
          textClass: "text-slate-950 font-black tracking-wider drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]",
          subClass: "text-emerald-950 font-extrabold bg-emerald-200/80 border border-emerald-100/60 shadow-sm",
          action: () => onPlaceBet(Math.max(20, Math.min(8000, betAmount))),
          disabled: userBalance < betAmount || betAmount < 20,
        };
      }
    } else if (roundState === "FLYING") {
      if (bet.isPlaced && !bet.hasCashedOut) {
        const cashValue = (bet.amount * multiplier).toFixed(2);
        return {
          label: "CASH OUT",
          sub: `${cashValue}`,
          outerLayer: "bg-gradient-to-b from-amber-400 via-amber-600 to-amber-950 shadow-[0_8px_18px_rgba(245,158,11,0.5),0_4px_0_#451a03] border border-amber-300/60 animate-pulse",
          innerLayer: "bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 border-t border-yellow-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
          textClass: "text-slate-950 font-black tracking-wider",
          subClass: "text-slate-950 font-extrabold bg-yellow-200/90 border border-yellow-100/70",
          action: onCashOut,
          disabled: false,
        };
      } else if (bet.isPlaced && bet.hasCashedOut) {
        return {
          label: "CASHED OUT",
          sub: `+${(bet.winAmount || 0).toFixed(2)}`,
          outerLayer: "bg-slate-900 border border-slate-800 shadow-[0_3px_0_#0f172a]",
          innerLayer: "bg-slate-800/90 border-t border-slate-700",
          textClass: "text-emerald-400 font-bold",
          subClass: "text-emerald-300 font-mono bg-emerald-950/60 border border-emerald-800/40",
          action: () => {},
          disabled: true,
        };
      } else {
        // Enqueueing bet for next round
        if (bet.isAutoBet) {
          return {
            label: "AUTO BET ACTIVE",
            sub: "Next Round",
            outerLayer: "bg-rose-950 border border-rose-800/40 shadow-[0_3px_0_#4c0519]",
            innerLayer: "bg-rose-900/40 border-t border-rose-700/30",
            textClass: "text-rose-300 font-bold",
            subClass: "text-rose-400 font-mono bg-rose-950/50",
            action: () => {},
            disabled: true,
          };
        } else {
          return {
            label: "BET ON NEXT ROUND",
            sub: `${betAmount.toLocaleString()}`,
            outerLayer: "bg-gradient-to-b from-amber-500 via-amber-700 to-amber-950 shadow-[0_6px_14px_rgba(245,158,11,0.35),0_3px_0_#451a03] border border-yellow-400/40",
            innerLayer: "bg-gradient-to-b from-yellow-400 via-amber-500 to-amber-600 border-t border-yellow-200/60",
            textClass: "text-slate-950 font-black tracking-wide",
            subClass: "text-amber-950 font-extrabold bg-yellow-200/80 border border-yellow-100/60",
            action: () => onPlaceBet(Math.max(20, Math.min(8000, betAmount))),
            disabled: userBalance < betAmount || betAmount < 20,
          };
        }
      }
    } else {
      // FLEW AWAY state
      if (bet.isAutoBet) {
        return {
          label: "AUTO BET ACTIVE",
          sub: "Starting soon...",
          outerLayer: "bg-rose-950 border border-rose-800/40 shadow-[0_3px_0_#4c0519]",
          innerLayer: "bg-rose-900/40 border-t border-rose-700/30",
          textClass: "text-rose-300 font-bold",
          subClass: "text-rose-400 font-mono bg-rose-950/50",
          action: () => {},
          disabled: true,
        };
      }
      return {
        label: "ROUND OVER",
        sub: "Starting soon...",
        outerLayer: "bg-slate-900 border border-slate-800 shadow-[0_3px_0_#0f172a]",
        innerLayer: "bg-slate-800/80 border-t border-slate-700",
        textClass: "text-slate-500 font-bold",
        subClass: "text-slate-600 font-mono",
        action: () => {},
        disabled: true,
      };
    }
  };

  const btn = getActionButtonConfig();

  return (
    <div
      className={`relative flex-1 w-full min-w-0 sm:min-w-[280px] bg-slate-950/70 border p-3 sm:p-4 rounded-xl flex flex-col gap-2.5 sm:gap-3 transition-all duration-300 ${
        showCelebration 
          ? "border-amber-500/50 celebrate-glow" 
          : isLocked 
            ? "border-slate-800 opacity-75" 
            : "border-slate-800"
      }`}
      id={`bet_panel_${id}`}
    >
      {/* Tabs */}
      <div className="flex bg-slate-900 p-1 rounded-lg text-xs font-semibold">
        <button
          onClick={() => {
            audioManager.playClick();
            setSelectedTab("MANUAL");
          }}
          className={`flex-1 py-1.5 rounded-md transition ${
            selectedTab === "MANUAL"
              ? "bg-slate-850 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
          id={`tab_manual_${id}`}
        >
          Manual
        </button>
        <button
          onClick={() => {
            audioManager.playClick();
            setSelectedTab("AUTO");
          }}
          className={`flex-1 py-1.5 rounded-md transition ${
            selectedTab === "AUTO"
              ? "bg-slate-850 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
          id={`tab_auto_${id}`}
        >
          Auto Settings
        </button>
      </div>

      {/* Main Betting Area */}
      <div className="flex gap-2 sm:gap-3 min-h-[105px] h-auto items-stretch">
        {/* Bet Amount Counter input */}
        <div className="flex-1 flex flex-col justify-between bg-slate-900 rounded-lg p-2 sm:p-2.5 min-w-0 gap-1.5 sm:gap-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
            Bet Amount
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={handleHalveAmount}
              disabled={isLocked}
              className="p-1 sm:p-1.5 hover:bg-slate-850 rounded text-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
              id={`minus_amount_${id}`}
            >
              <Minus size={15} />
            </button>
            <input
              type="number"
              value={betAmount === 0 ? "" : betAmount}
              readOnly={isLocked}
              disabled={isLocked}
              onChange={(e) => {
                if (isLocked) return;
                const val = parseInt(e.target.value);
                if (isNaN(val)) {
                  setBetAmount(0);
                } else {
                  setBetAmount(Math.min(8000, val));
                }
              }}
              onBlur={() => {
                if (betAmount < 20) {
                  setBetAmount(20);
                }
              }}
              className="w-full text-center bg-transparent border-none text-white text-sm sm:text-base font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-70"
              id={`bet_input_${id}`}
            />
            <button
              onClick={handleDoubleAmount}
              disabled={isLocked}
              className="p-1 sm:p-1.5 hover:bg-slate-850 rounded text-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
              id={`plus_amount_${id}`}
            >
              <Plus size={15} />
            </button>
          </div>

          {/* Quick numbers */}
          <div className="grid grid-cols-4 gap-1">
            {[20, 50, 100, 200, 500, 1000, 5000, 8000].map((val) => (
              <button
                key={val}
                disabled={isLocked}
                onClick={() => setFixedAmount(val)}
                className={`text-[8.5px] sm:text-[9px] font-bold py-0.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation ${
                  betAmount === val
                    ? "bg-rose-900/40 text-rose-400 border border-rose-500/30"
                    : "bg-slate-850 text-slate-400 hover:text-white"
                }`}
                id={`preset_btn_${id}_${val}`}
              >
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </button>
            ))}
          </div>
        </div>

        {/* Massive 2-Layer Bet trigger Button */}
        <button
          onClick={btn.action}
          disabled={btn.disabled}
          className={`group relative w-24 sm:w-28 md:w-36 p-[3px] pb-[5px] rounded-2xl transition-all duration-150 select-none touch-manipulation flex flex-col items-stretch ${
            btn.outerLayer
          } ${
            btn.disabled
              ? "cursor-not-allowed opacity-60 grayscale-[15%]"
              : "cursor-pointer active:translate-y-[2px] active:pb-[3px] hover:scale-[1.02]"
          }`}
          id={`bet_action_btn_${id}`}
        >
          {/* Top Layer Deck */}
          <div
            className={`w-full h-full min-h-[92px] rounded-[13px] flex flex-col items-center justify-center relative overflow-hidden transition-all duration-150 p-1.5 ${
              btn.innerLayer
            }`}
          >
            {/* Top Gloss Reflection Highlight */}
            <div className="absolute inset-x-0 top-0 h-[44%] bg-gradient-to-b from-white/35 via-white/10 to-transparent pointer-events-none rounded-t-[12px]" />

            {/* Primary Action Label */}
            <div className={`relative z-10 text-xs sm:text-sm leading-tight text-center px-1 font-black ${btn.textClass}`}>
              {btn.label}
            </div>

            {/* Sub-label / Bet Amount pill */}
            {btn.sub && (
              <div className={`relative z-10 text-[9.5px] sm:text-[11px] px-2 py-0.5 rounded-full mt-1 sm:mt-1.5 font-mono text-center truncate max-w-full leading-normal ${btn.subClass}`}>
                {btn.sub}
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Auto Toggles Section */}
      {selectedTab === "AUTO" && (
        <div
          className="grid grid-cols-2 gap-3 bg-slate-900/50 p-2.5 rounded-lg border border-slate-900"
          id={`auto_settings_${id}`}
        >
          {/* Auto Bet Option */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
              <Coins size={10} /> Auto Bet
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAutoBet}
                onChange={toggleAutoBet}
                className="sr-only peer"
                id={`toggle_autobet_${id}`}
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600 peer-checked:after:bg-white"></div>
              <span className="ml-2.5 text-xs text-slate-400">On / Off</span>
            </label>
          </div>

          {/* Auto Cash Out Option */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
              <TrendingUp size={10} /> Auto Cash Out
            </span>
            <div className="flex items-center gap-1.5">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAutoCashOut}
                  onChange={toggleAutoCashOut}
                  className="sr-only peer"
                  id={`toggle_autocashout_${id}`}
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600 peer-checked:after:bg-white"></div>
              </label>

              <input
                type="number"
                step="0.01"
                min="1.01"
                placeholder="2.00"
                disabled={!isAutoCashOut}
                value={autoCashOutVal}
                onChange={(e) => handleAutoMultiplierChange(e.target.value)}
                className={`w-16 text-center text-xs font-bold p-1 bg-slate-900 border border-slate-850 rounded text-white focus:outline-none ${
                  !isAutoCashOut ? "opacity-30 cursor-not-allowed" : "border-rose-500/30"
                }`}
                id={`autocashout_mul_input_${id}`}
              />
              <span className="text-[11px] text-slate-500 font-bold font-mono">x</span>
            </div>
          </div>
        </div>
      )}

      {showCelebration && (
        <>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes gold-pulse {
              0%, 100% {
                box-shadow: 0 0 15px rgba(251, 191, 36, 0.4), inset 0 0 10px rgba(251, 191, 36, 0.2);
                border-color: rgba(251, 191, 36, 0.6);
              }
              50% {
                box-shadow: 0 0 35px rgba(251, 191, 36, 0.95), inset 0 0 25px rgba(251, 191, 36, 0.5);
                border-color: rgba(253, 224, 71, 1);
              }
            }
            @keyframes p-float-1 {
              0% { transform: translateY(110%) translateX(0px) rotate(0deg); opacity: 0; }
              15% { opacity: 1; }
              90% { opacity: 1; }
              100% { transform: translateY(-110%) translateX(-30px) rotate(360deg); opacity: 0; }
            }
            @keyframes p-float-2 {
              0% { transform: translateY(110%) translateX(0px) rotate(0deg); opacity: 0; }
              10% { opacity: 1; }
              85% { opacity: 1; }
              100% { transform: translateY(-110%) translateX(40px) rotate(-360deg); opacity: 0; }
            }
            @keyframes p-float-3 {
              0% { transform: translateY(110%) translateX(0px) rotate(0deg); opacity: 0; }
              20% { opacity: 1; }
              80% { opacity: 1; }
              100% { transform: translateY(-110%) translateX(-15px) rotate(180deg); opacity: 0; }
            }
            @keyframes win-text-pulse {
              0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.6)); }
              50% { transform: scale(1.05); filter: drop-shadow(0 0 18px rgba(251, 191, 36, 1)); }
            }
            @keyframes ribbon-sweep {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .celebrate-glow {
              animation: gold-pulse 1.8s infinite ease-in-out !important;
            }
            .particle-1 { animation: p-float-1 3.0s infinite linear; }
            .particle-2 { animation: p-float-2 2.6s infinite linear; }
            .particle-3 { animation: p-float-3 3.4s infinite linear; }
          `}} />
          
          <div 
            onClick={() => setShowCelebration(false)}
            className="absolute inset-0 cursor-pointer pointer-events-auto rounded-xl overflow-hidden z-20 flex flex-col items-center justify-center p-4 bg-slate-950/90 text-center select-none"
            title="Click to dismiss overlay"
          >
            {/* Background radial glow */}
            <div className="absolute inset-0 bg-radial-gradient from-amber-500/20 via-transparent to-transparent opacity-85 animate-pulse pointer-events-none" />
            
            {/* Celebration Badge Area */}
            <div className="relative border-2 border-amber-500/80 bg-slate-900/95 rounded-xl p-3.5 w-full max-w-[240px] shadow-2xl animate-[win-text-pulse_2.2s_infinite_ease-in-out] flex flex-col items-center justify-center z-10 pointer-events-none">
              <div className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                <span>★</span> <span>EPIC WIN</span> <span>★</span>
              </div>
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 bg-[size:200%_auto] animate-[ribbon-sweep_3s_infinite_linear] font-display mt-0.5">
                {bet.cashedOutMultiplier ? bet.cashedOutMultiplier.toFixed(2) : "6.00"}+x
              </div>
              <div className="text-sm font-extrabold text-emerald-400 mt-1">
                +{bet.winAmount ? bet.winAmount.toFixed(1) : "0.0"}
              </div>
              <div className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest font-mono">
                Click Panel to Close
              </div>
            </div>

            {/* Confetti / Glitter Particles */}
            <div className="absolute inset-0 pointer-events-none">
              {[
                { left: "10%", delay: "0s", color: "bg-yellow-400", size: "w-2.5 h-2.5", p: "particle-1" },
                { left: "25%", delay: "0.4s", color: "bg-amber-400", size: "w-2 h-2", p: "particle-2" },
                { left: "40%", delay: "0.8s", color: "bg-yellow-300", size: "w-1.5 h-3", p: "particle-3" },
                { left: "55%", delay: "1.2s", color: "bg-red-500", size: "w-2.5 h-2", p: "particle-1" },
                { left: "70%", delay: "0.2s", color: "bg-amber-500", size: "w-2 h-3", p: "particle-2" },
                { left: "85%", delay: "0.7s", color: "bg-yellow-400", size: "w-3 h-1.5", p: "particle-3" },
                { left: "15%", delay: "1.5s", color: "bg-emerald-400", size: "w-1.5 h-2.5", p: "particle-2" },
                { left: "45%", delay: "1.9s", color: "bg-yellow-500", size: "w-2.5 h-2.5", p: "particle-1" },
                { left: "75%", delay: "2.3s", color: "bg-cyan-400", size: "w-2 h-2", p: "particle-3" },
              ].map((particle, idx) => (
                <div
                  key={idx}
                  className={`absolute bottom-0 rounded-full ${particle.size} ${particle.color} ${particle.p} opacity-0`}
                  style={{
                    left: particle.left,
                    animationDelay: particle.delay,
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const BetPanel: React.FC<BetPanelProps> = memo(BetPanelComponent, areBetPanelPropsEqual);

