import React from "react";
import { X, Award, Sparkles, BookOpen, ShieldCheck } from "lucide-react";

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
        className="w-full max-w-2xl bg-slate-900 border border-slate-850 rounded-2xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl text-slate-100"
        id="help_modal_content"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-950/40 flex items-center justify-center text-rose-500 border border-rose-500/20">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Game Rules & Guide</h2>
              <p className="text-[11px] text-slate-500 font-medium">Standard Crash Game Operations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition"
            id="close_help_btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 text-sm leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Quick Intro Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles size={14} /> Basic Gameplay
              </div>
              <ul className="text-xs text-slate-400 list-disc list-inside flex flex-col gap-1">
                <li>Choose your wager amount and place bet before round takeoff.</li>
                <li>The flight ascends and the payout multiplier increases.</li>
                <li>Press <strong className="text-white">CASH OUT</strong> at any moment to secure winnings.</li>
                <li>If the flight crashes before you cash out, the wager is lost.</li>
              </ul>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck size={14} /> Key Financial Rules
              </div>
              <ul className="text-xs text-slate-400 list-disc list-inside flex flex-col gap-1">
                <li><strong className="text-white">10% Instant Cashback:</strong> Automatically credited on lost rounds.</li>
                <li><strong className="text-white">3% House Commission:</strong> Automatically deducted from gross winnings.</li>
                <li><strong className="text-white">Dual Bet Panels:</strong> Play with two independent bet slips simultaneously.</li>
                <li><strong className="text-white">Auto Controls:</strong> Set automated bet repetition and cashout multipliers.</li>
              </ul>
            </div>
          </div>

          {/* 📊 Provably Fair Continuous RNG Architecture */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Award size={14} className="text-amber-400" /> ระบบการสุ่มแบบยุติธรรม Provably Fair RNG (Max Cap 50.00x)
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                RTP 84.00% – 85.00% | House Edge 15.00% – 16.00%
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Sparkles size={14} /> ระบบการสุ่มยุติธรรมแบบแยกโหมด (Provably Fair RNG & Special Weighted Mode)
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                ตัวคูณในแต่ละรอบเกมคำนวณผ่านสถาปัตยกรรม 2 ระบบที่ทำงานร่วมกัน โดยกราฟเริ่มต้นวิ่งตั้งแต่ <strong className="text-emerald-400">1.00x</strong> และล็อกเพดานสูงสุดที่ <strong className="text-amber-400">50.00x</strong> พร้อมควบคุมค่าสถิติระยะยาวให้มี Expected Value (EV) เป็นบวกสำหรับเจ้ามือ (RTP รวม 84.00% – 85.00% | House Edge 15.00% – 16.00%):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1 font-mono text-[11px]">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                  <span className="text-emerald-400 font-bold">1. Pure Fair Continuous RNG (การสุ่มรางวัลปกติ)</span>
                  <span className="text-slate-400 text-[10px]">สุ่มตัวคูณอย่างยุติธรรมตามทฤษฎีความน่าจะเป็นต่อเนื่อง รางวัลใหญ่ บิ๊กวิน หรือเมก้าวิน สามารถเกิดขึ้นได้จริงอย่างเป็นธรรมชาติ โดยมีระบบตรวจจับจังหวะไม่ให้ออกตัวคูณสูงติดกันทุกตา และจำกัดเพดานสูงสุดที่ 50.00x</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                  <span className="text-rose-400 font-bold">2. Special Weighted Capital Cut-off (โหมดตัดทุนผู้เล่น)</span>
                  <span className="text-slate-400 text-[10px]">เป็นเงื่อนไขพิเศษถ่วงน้ำหนัก (Special Weighted Mode) ที่ทำงานตัดทุนที่ 1.00x (Instant Bust) หรือวิ่งสะดุดช่วง 1.01x – 1.06x เพื่อตัดจังหวะการทำกำไรระยะสั้นของฝั่งผู้เล่น</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gameplay steps details */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Award size={14} className="text-rose-500" /> Core Mechanics
            </h3>
            <div className="border border-slate-850 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-2 text-slate-400 font-bold border-b border-slate-850">
                <div>Feature</div>
                <div className="col-span-2">Description</div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2.5 border-b border-slate-850/60">
                <div className="font-bold text-white">Dual Bets</div>
                <div className="col-span-2 text-slate-400">
                  Place up to two independent bets per round to execute split strategies (e.g. cash out one bet early at 1.50x and let the second fly higher).
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2.5 border-b border-slate-850/60">
                <div className="font-bold text-white">Auto Bet</div>
                <div className="col-span-2 text-slate-400">
                  Automatically re-submits your chosen bet amount at the start of each subsequent round.
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2.5">
                <div className="font-bold text-white">Auto Cash Out</div>
                <div className="col-span-2 text-slate-400">
                  Configure a target multiplier (e.g. 2.00x). The engine automatically settles your winnings when the flight coefficient reaches or exceeds that threshold.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition"
            id="help_modal_got_it_btn"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
