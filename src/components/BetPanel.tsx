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

  // Keep state synced with prop when autos are modified externally
  useEffect(() => {
    setIsAutoBet(bet.isAutoBet);
    setIsAutoCashOut(bet.isAutoCashOut);
    setAutoCashOutVal(bet.autoCashOutMultiplier);
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
      return next < 100 ? 100 : next;
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
          action: () => onPlaceBet(Math.max(100, Math.min(1000000, betAmount))),
          disabled: userBalance < betAmount || betAmount < 100,
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
            action: () => onPlaceBet(Math.max(100, Math.min(1000000, betAmount))),
            disabled: userBalance < betAmount || betAmount < 100,
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
      className={`flex-1 bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex flex-col gap-3 min-w-[280px] transition-opacity duration-300 ${
        isLocked ? "opacity-50" : ""
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
      <div className="flex gap-3 h-24 items-center">
        {/* Stake Counter input */}
        <div className="flex-1 flex flex-col justify-between h-full bg-slate-900 rounded-lg p-2.5 min-w-[130px]">
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
                if (betAmount < 100) {
                  setBetAmount(100);
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
            {[100, 200, 500, 1000].map((val) => (
              <button
                key={val}
                disabled={isLocked}
                onClick={() => setFixedAmount(val)}
                className={`text-[9.5px] font-bold py-0.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  betAmount === val
                    ? "bg-rose-900/30 text-rose-400 border border-rose-500/20"
                    : "bg-slate-850 text-slate-400 hover:text-white"
                }`}
                id={`preset_btn_${id}_${val}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Massive Bet trigger Button */}
        <button
          onClick={btn.action}
          disabled={btn.disabled}
          className={`flex-1 h-full rounded-xl flex flex-col items-center justify-center transition select-none ${
            btn.bgColor
          } ${btn.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer active:scale-95 shadow-md shadow-emerald-950/20"}`}
          id={`bet_action_btn_${id}`}
        >
          <div className="text-sm font-black tracking-wide leading-tight">{btn.label}</div>
          {btn.sub && <div className="text-xs opacity-90 mt-0.5 font-mono">{btn.sub}</div>}
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
    </div>
  );
};
