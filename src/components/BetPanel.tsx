import React, { useState, useEffect } from "react";
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

export const BetPanel: React.FC<BetPanelProps> = ({
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
  
  // Rule check: Lock starts the instant the round state is FLYING
  const isLocked = roundState === "FLYING";
  
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
      return next > 1000000 ? 1000000 : next;
    });
  };

  const handleHalveAmount = () => {
    audioManager.playClick();
    setBetAmount((prev) => {
      const next = Math.floor(prev / 2);
      return next < 30 ? 30 : next;
    });
  };

  const setFixedAmount = (amt: number) => {
    audioManager.playClick();
    setBetAmount(Math.min(1000000, amt));
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
          bgColor: "bg-amber-600 hover:bg-amber-500",
          action: onCancelBet,
          disabled: false,
        };
      } else {
        return {
          label: "BET",
          sub: `${betAmount.toLocaleString()} THB`,
          bgColor: "bg-emerald-600 hover:bg-emerald-500",
          action: () => onPlaceBet(Math.max(30, Math.min(1000000, betAmount))),
          disabled: userBalance < betAmount || betAmount < 30,
        };
      }
    } else if (roundState === "FLYING") {
      if (bet.isPlaced && !bet.hasCashedOut) {
        const cashValue = (bet.amount * multiplier).toFixed(2);
        return {
          label: "CASH OUT",
          sub: `${cashValue} THB`,
          bgColor: "bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold",
          action: onCashOut,
          disabled: false,
        };
      } else if (bet.isPlaced && bet.hasCashedOut) {
        return {
          label: "CASHED OUT",
          sub: `+${(bet.winAmount || 0).toFixed(1)} THB`,
          bgColor: "bg-slate-800 text-emerald-400 font-medium",
          action: () => {},
          disabled: true,
        };
      } else {
        // Enqueueing bet for next round
        if (bet.isAutoBet) {
          return {
            label: "BET PLACED",
            sub: "Next Round",
            bgColor: "bg-slate-800 text-slate-400 font-medium",
            action: () => {},
            disabled: true,
          };
        } else {
          if (isLocked) {
            return {
              label: "WAITING...",
              sub: `${betAmount.toLocaleString()} THB`,
              bgColor: "bg-slate-800 text-slate-500",
              action: () => {},
              disabled: true,
            };
          }
          return {
            label: "BET ON NEXT ROUND",
            sub: `${betAmount.toLocaleString()} THB`,
            bgColor: "bg-emerald-700/50 hover:bg-emerald-700/80 text-emerald-100",
            action: () => onPlaceBet(Math.max(30, Math.min(1000000, betAmount))),
            disabled: userBalance < betAmount || betAmount < 30,
          };
        }
      }
    } else {
      // FLEW AWAY state
      return {
        label: "ROUND OVER",
        sub: "",
        bgColor: "bg-slate-800 text-slate-500",
        action: () => {},
        disabled: true,
      };
    }
  };

  const btn = getActionButtonConfig();

  return (
    <div
      className={`relative flex-1 bg-slate-950/70 border p-4 rounded-xl flex flex-col gap-3 min-w-[280px] transition-all duration-300 ${
        showCelebration 
          ? "border-amber-500/50 celebrate-glow" 
          : isLocked 
            ? "border-slate-800 opacity-50" 
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
      <div className="flex gap-3 min-h-[110px] h-auto items-stretch">
        {/* Stake Counter input */}
        <div className="flex-1 flex flex-col justify-between bg-slate-900 rounded-lg p-2.5 min-w-[130px] gap-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
            Amount THB
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={handleHalveAmount}
              disabled={isLocked}
              className="p-1 hover:bg-slate-850 rounded text-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
              id={`minus_amount_${id}`}
            >
              <Minus size={16} />
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
                  setBetAmount(Math.min(1000000, val));
                }
              }}
              onBlur={() => {
                if (betAmount < 30) {
                  setBetAmount(30);
                }
              }}
              className="w-full text-center bg-transparent border-none text-white text-base font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-70"
              id={`bet_input_${id}`}
            />
            <button
              onClick={handleDoubleAmount}
              disabled={isLocked}
              className="p-1 hover:bg-slate-850 rounded text-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
              id={`plus_amount_${id}`}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Quick numbers */}
          <div className="grid grid-cols-4 gap-1">
            {[30, 50, 100, 200, 500, 1000, 5000, 10000].map((val) => (
              <button
                key={val}
                disabled={isLocked}
                onClick={() => setFixedAmount(val)}
                className={`text-[9px] font-bold py-0.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed ${
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

        {/* Massive Bet trigger Button */}
        <button
          onClick={btn.action}
          disabled={btn.disabled}
          className={`w-28 md:w-36 rounded-xl flex flex-col items-center justify-center transition select-none ${
            btn.bgColor
          } ${btn.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer active:scale-95 shadow-md shadow-emerald-950/20"}`}
          id={`bet_action_btn_${id}`}
        >
          <div className="text-xs md:text-sm font-black tracking-wide leading-tight text-center px-1">{btn.label}</div>
          {btn.sub && <div className="text-[10px] md:text-xs opacity-90 mt-1 font-mono text-center px-1">{btn.sub}</div>}
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
                +{bet.winAmount ? bet.winAmount.toFixed(1) : "0.0"} THB
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
