import React from "react";
import { 
  X, 
  HelpCircle, 
  Coins, 
  TrendingUp, 
  HandCoins, 
  ShieldCheck, 
  SlidersHorizontal,
  Flame
} from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in"
      id="help_modal_overlay"
    >
      <div
        className="w-full max-w-lg bg-[#140b10] border border-[#3b1c24] rounded-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl text-slate-100"
        id="help_modal_content"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#2d141b] bg-[#1a0c13]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-500 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]">
              <HelpCircle size={20} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide text-white uppercase font-sans">
                How to Play
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Quick 3-Step Crash Game Guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-rose-950/40 rounded-xl transition border border-transparent hover:border-rose-900/40"
            id="close_help_btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-3.5 text-xs leading-relaxed scrollbar-thin scrollbar-thumb-rose-950">
          
          {/* Section: 3 Steps */}
          <div className="flex items-center gap-2 px-1">
            <Flame size={15} className="text-rose-500" />
            <span className="text-xs font-black tracking-wider text-rose-400 uppercase">
              3 Simple Steps to Win
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Step 1 */}
            <div className="bg-[#1c0e15] border border-[#381822] hover:border-rose-500/40 p-3.5 rounded-xl flex items-start gap-3.5 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                <Coins size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/40">
                    Step 1
                  </span>
                  <span className="font-bold text-white text-xs">Set Your Bet</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                  Select your stake and click <strong className="text-white font-bold">Bet</strong> before the flight starts. You can place <strong className="text-amber-300">2 simultaneous bets</strong> per round.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#1c0e15] border border-[#381822] hover:border-rose-500/40 p-3.5 rounded-xl flex items-start gap-3.5 transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                <TrendingUp size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/40">
                    Step 2
                  </span>
                  <span className="font-bold text-white text-xs">Watch Multiplier Rise</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                  The aircraft launches and the multiplier starts soaring up from <strong className="text-rose-300 font-mono">1.00x</strong> towards the stratosphere.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-[#1c0e15] border border-[#381822] hover:border-rose-500/40 p-3.5 rounded-xl flex items-start gap-3.5 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                <HandCoins size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                    Step 3
                  </span>
                  <span className="font-bold text-white text-xs">Cash Out & Collect</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                  Hit <strong className="text-emerald-400 font-bold">Cash Out</strong> before the plane flies away. Your win payout is calculated instantly: <span className="text-emerald-300 font-mono font-semibold">Bet × Multiplier</span>!
                </p>
              </div>
            </div>
          </div>

          {/* Pro-Tips & Auto Cashout */}
          <div className="bg-[#180a12] p-3.5 rounded-xl border border-[#2f131c] flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <SlidersHorizontal size={16} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-blue-300">Pro Tip: Auto Cash Out</span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Enable <strong className="text-slate-200">Auto Cash Out</strong> at a target (e.g. 2.00x) to automatically lock in profits with zero reaction delay.
              </p>
            </div>
          </div>

          {/* 100% Fair Play */}
          <div className="bg-[#180a12] p-3.5 rounded-xl border border-[#2f131c] flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-emerald-400">100% Fair & Random</span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Every flight multiplier is generated independently with random outcomes for fair and transparent gameplay.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1a0c13] border-t border-[#2d141b] flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-rose-950/60 uppercase tracking-wider"
            id="help_modal_got_it_btn"
          >
            Got it, let's play!
          </button>
        </div>
      </div>
    </div>
  );
};
