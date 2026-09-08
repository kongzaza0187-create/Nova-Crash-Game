import React, { useState } from "react";
import { 
  X, 
  HelpCircle, 
  Coins, 
  TrendingUp, 
  HandCoins, 
  ShieldCheck, 
  SlidersHorizontal,
  Flame,
  Languages
} from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [lang, setLang] = useState<"th" | "en">("th");

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
                {lang === "th" ? "วิธีเล่นเกม" : "How to Play"}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {lang === "th" ? "คู่มือ 3 ขั้นตอนง่ายๆ เข้าใจได้ทันที" : "Quick 3-Step Crash Game Guide"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center bg-[#10060c] p-0.5 rounded-lg border border-[#3b1c24]">
              <button
                onClick={() => setLang("th")}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 ${
                  lang === "th"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="เปลี่ยนเป็นภาษาไทย"
              >
                <span>🇹🇭</span> ไทย
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 ${
                  lang === "en"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Switch to English"
              >
                <span>🇬🇧</span> EN
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-rose-950/40 rounded-xl transition border border-transparent hover:border-rose-900/40"
              id="close_help_btn"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-3.5 text-xs leading-relaxed scrollbar-thin scrollbar-thumb-rose-950">
          
          {/* Section: 3 Steps */}
          <div className="flex items-center gap-2 px-1">
            <Flame size={15} className="text-rose-500" />
            <span className="text-xs font-black tracking-wider text-rose-400 uppercase">
              {lang === "th" ? "3 ขั้นตอนสู่ชัยชนะ" : "3 Simple Steps to Win"}
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
                    {lang === "th" ? "ขั้นตอนที่ 1" : "Step 1"}
                  </span>
                  <span className="font-bold text-white text-xs">
                    {lang === "th" ? "กำหนดเงินเดิมพัน (Set Your Bet)" : "Set Your Bet"}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-300 mt-1 leading-normal">
                  {lang === "th" ? (
                    <>
                      เลือกจำนวนเงินเดิมพันแล้วกดปุ่ม <strong className="text-white font-bold">เดิมพัน (Bet)</strong> ก่อนจรวดเริ่มบิน สามารถวางเดิมพันได้สูงสุด <strong className="text-amber-300">2 ไม้พร้อมกัน</strong> ในรอบเดียว
                    </>
                  ) : (
                    <>
                      Select your stake and click <strong className="text-white font-bold">Bet</strong> before the flight starts. You can place <strong className="text-amber-300">2 simultaneous bets</strong> per round.
                    </>
                  )}
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
                    {lang === "th" ? "ขั้นตอนที่ 2" : "Step 2"}
                  </span>
                  <span className="font-bold text-white text-xs">
                    {lang === "th" ? "ดูตัวคูณพุ่งทะยาน (Watch Multiplier Rise)" : "Watch Multiplier Rise"}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-300 mt-1 leading-normal">
                  {lang === "th" ? (
                    <>
                      เมื่อจรวดทะยานขึ้น ตัวคูณเงินรางวัลจะเริ่มวิ่งจาก <strong className="text-rose-300 font-mono font-bold">1.00x</strong> พุ่งทะยานสูงขึ้นเรื่อยๆ ไปสู่ชั้นบรรยากาศ ยิ่งจรวดบินสูงเท่าไหร่ ตัวคูณและผลตอบแทนก็ยิ่งทวีคูณมากขึ้นเท่านั้น!
                    </>
                  ) : (
                    <>
                      The aircraft launches and the multiplier starts soaring up from <strong className="text-rose-300 font-mono">1.00x</strong> towards the stratosphere. The higher the flight, the larger your payout multiplier grows!
                    </>
                  )}
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
                    {lang === "th" ? "ขั้นตอนที่ 3" : "Step 3"}
                  </span>
                  <span className="font-bold text-white text-xs">
                    {lang === "th" ? "กดรับเงินรางวัลทันที (Cash Out & Collect)" : "Cash Out & Collect"}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-300 mt-1 leading-normal">
                  {lang === "th" ? (
                    <>
                      กดปุ่ม <strong className="text-emerald-400 font-bold">รับเงิน (Cash Out)</strong> ก่อนจรวดบินหนีหรือระเบิด รับเงินรางวัลทันที: <span className="text-emerald-300 font-mono font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">เงินเดิมพัน × ตัวคูณ</span> ที่กดได้!
                    </>
                  ) : (
                    <>
                      Hit <strong className="text-emerald-400 font-bold">Cash Out</strong> before the plane flies away. Your win payout is calculated instantly: <span className="text-emerald-300 font-mono font-semibold">Bet × Multiplier</span>!
                    </>
                  )}
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
              <span className="text-xs font-bold text-blue-300">
                {lang === "th" ? "เทคนิคพิเศษ: รับเงินอัตโนมัติ (Auto Cash Out)" : "Pro Tip: Auto Cash Out"}
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                {lang === "th" ? (
                  <>
                    เปิดใช้งาน <strong className="text-slate-200">Auto Cash Out</strong> และตั้งค่าเป้าหมายตัวคูณที่ต้องการ (เช่น 1.50x หรือ 2.00x) เมื่อกราฟพุ่งถึงจุดที่ตั้งไว้ ระบบจะดึงเงินรางวัลเข้ากระเป๋าให้อัตโนมัติทันที 100% โดยไม่มีดีเลย์
                  </>
                ) : (
                  <>
                    Enable <strong className="text-slate-200">Auto Cash Out</strong> at a target (e.g. 2.00x) to automatically lock in profits with zero reaction delay.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* 100% Fair Play */}
          <div className="bg-[#180a12] p-3.5 rounded-xl border border-[#2f131c] flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-emerald-400">
                {lang === "th" ? "ยุติธรรม 100% โปร่งใสและสุ่มอิสระ" : "100% Fair & Transparent"}
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                {lang === "th" ? (
                  <>
                    ผลลัพธ์ทุกรอบบินถูกสร้างขึ้นด้วยอัลกอริทึม Provably Fair ทางคณิตศาสตร์ที่มีการสุ่มอย่างแท้จริง โปร่งใส ไร้การแทรกแซง และเป็นอิสระในทุกๆ เที่ยวบิน เพื่อความสนุกและยุติธรรมสูงสุดสำหรับผู้เล่นทุกคน
                  </>
                ) : (
                  <>
                    Every flight multiplier is generated independently with provably fair cryptographic RNG algorithms for 100% transparent, tamper-proof, and exciting gameplay.
                  </>
                )}
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
            {lang === "th" ? "เข้าใจแล้ว เริ่มเล่นเลย!" : "Got it, let's play!"}
          </button>
        </div>
      </div>
    </div>
  );
};
