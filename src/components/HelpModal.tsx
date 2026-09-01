import React from "react";
import { X, BookOpen, ShieldCheck, Sparkles, Percent, Zap, CheckCircle2 } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in"
      id="help_modal_overlay"
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl text-slate-100"
        id="help_modal_content"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-950/40 flex items-center justify-center text-rose-500 border border-rose-500/20">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">How to Play</h2>
              <p className="text-[11px] text-slate-400 font-medium">Quick & Simple Game Guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            id="close_help_btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-4 text-xs leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Simple 3-step Gameplay */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles size={14} /> 3 Easy Steps to Play
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-slate-300">
                  <strong className="text-white">Place your bet</strong> before the plane takes off. You can even place 2 bets at once!
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-slate-300">
                  <strong className="text-white">Watch it fly</strong> — the higher the plane flies, the bigger your multiplier grows.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-slate-300">
                  <strong className="text-emerald-400 font-semibold">Cash out</strong> anytime before the plane flies away to grab your winnings!
                </p>
              </div>
            </div>
          </div>

          {/* Key Benefits / Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 10% Cashback */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                <Percent size={14} /> 10% Instant Cashback
              </div>
              <p className="text-[11px] text-slate-300">
                If a round doesn't go your way, <strong className="text-emerald-300">10% of your lost bet is automatically credited back</strong> to your wallet balance instantly.
              </p>
            </div>

            {/* 3% Commission */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                <Zap size={14} /> 3% Round Commission
              </div>
              <p className="text-[11px] text-slate-300">
                A transparent <strong className="text-amber-300">3% commission</strong> is applied to each round to maintain smooth, uninterrupted gameplay.
              </p>
            </div>
          </div>

          {/* 100% Fair Play */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
              <ShieldCheck size={15} /> 100% Fair Play & Random Outcomes
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Every single round is completely random, fair, and cryptographically verified with <strong className="text-white">Provably Fair</strong> technology. The outcome is generated by open mathematics — nothing is rigged or predetermined.
            </p>
          </div>

          {/* Helpful Tips */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-rose-400" /> Handy Pro-Tips
            </span>
            <ul className="text-[11px] text-slate-400 list-disc list-inside flex flex-col gap-1">
              <li>Use <strong className="text-slate-200">Auto Cash Out</strong> to automatically lock in profits at your target multiplier (e.g. 2.00x).</li>
              <li>Split your strategy using both bet panels — cash out one early for safety and let the other shoot for high skies!</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-rose-950/50"
            id="help_modal_got_it_btn"
          >
            Got it, let's play!
          </button>
        </div>
      </div>
    </div>
  );
};
