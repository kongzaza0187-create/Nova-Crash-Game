import React from "react";
import { X, HelpCircle, Shield, Award, Sparkles, BookOpen } from "lucide-react";

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
              <h2 className="text-base font-bold tracking-tight">How to Play? / วิธีเล่นเกม</h2>
              <p className="text-[11px] text-slate-500 font-medium">BollyGaming Aviator Guide</p>
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
                <Sparkles size={14} /> English Guide
              </div>
              <ul className="text-xs text-slate-400 list-disc list-inside flex flex-col gap-1">
                <li>Choose a stake and place your bet before takeoff.</li>
                <li>The plane ascends and multiplier rises.</li>
                <li>Press <strong className="text-white">CASH OUT</strong> at any moment to lock-in profits.</li>
                <li>If the plane flies away before you cash out, you lose!</li>
              </ul>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles size={14} /> วิธีการเล่น (ภาษาไทย)
              </div>
              <ul className="text-xs text-slate-400 list-disc list-inside flex flex-col gap-1">
                <li>เลือกจำนวนเงินเดิมพัน และกดยืนยันตัวเลขก่อนเครื่องขึ้น</li>
                <li>เครื่องบินจะทะยานขึ้นไปพร้อมตัวคูณที่สูงขึ้น</li>
                <li>กดปุ่ม <strong className="text-white">CASH OUT</strong> เพื่อรับเงินรางวัลตามตัวคูณปัจจุบัน</li>
                <li>หากเครื่องบิน "หนีหาย (FLEW AWAY)" ก่อนกดถอน เงินเดิมพันจะค้างทันที!</li>
              </ul>
            </div>
          </div>

          {/* Gameplay steps details */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Award size={14} className="text-rose-500" /> Core Mechanisms / ระบบเกณฑ์รางวัล
            </h3>
            <div className="border border-slate-850 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-2 text-slate-400 font-bold border-b border-slate-850">
                <div>Feature / คุณสมบัติ</div>
                <div className="col-span-2">How it works / อธิบายเพิ่มเติม</div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2.5 border-b border-slate-850/60">
                <div className="font-bold text-white">Dual Bets</div>
                <div className="col-span-2 text-slate-400">
                  Place up to two independent bets! Play with different strategies (e.g. cash out one early at 1.50x and let the other fly higher).
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2.5 border-b border-slate-850/60">
                <div className="font-bold text-white">Auto Bet</div>
                <div className="col-span-2 text-slate-400">
                  Enable Auto Bet in Auto Settings to automatically replicate your bet amount for every new round.
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2.5">
                <div className="font-bold text-white">Auto Cash Out</div>
                <div className="col-span-2 text-slate-400">
                  Set a threshold (e.g. 2.0x). The engine will withdraw your credits automatically if the plane passes that target coefficient.
                </div>
              </div>
            </div>
          </div>

          {/* Provably Fair Safety */}
          <div className="bg-rose-950/20 p-4 rounded-xl border border-rose-500/10 flex gap-3 text-xs">
            <div className="text-rose-500 shrink-0">
              <Shield size={24} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-rose-400">Provably Fair Algorithm / อัลกอริทึมที่ยุติธรรม</h4>
              <p className="text-slate-400">
                The escape crash point is generated via a cryptographically secure random sweep at the exact beginning of each round. Payout coordinates are completely transparent and cannot be altered or predicted mid-flight.
              </p>
              <p className="text-slate-500 italic mt-1">
                พิกัดการสิ้นสุดของเที่ยวบินถูกสุ่มขึ้นล่วงหน้าด้วยความโปร่งใสทางคณิตศาสตร์ ไม่สามารถแก้ไขหรือแทรกแซงในขณะบินได้
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/20 active:scale-95 transition"
            id="help_modal_close_footer"
          >
            Acknowledge / เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  );
};
