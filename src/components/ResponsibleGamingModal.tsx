import React from "react";
import { X, Play, ShieldAlert } from "lucide-react";
import { audioManager } from "../audio";

interface ResponsibleGamingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResponsibleGamingModal: React.FC<ResponsibleGamingModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePlayNow = () => {
    audioManager.playClick();
    onClose();
  };

  const handleClose = () => {
    audioManager.playClick();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9990] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      id="responsible_gaming_modal_overlay"
    >
      {/* Modal Container */}
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-[#0d0d1a] border border-rose-500/40 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-[0_0_40px_rgba(244,63,94,0.25)] select-none"
        id="responsible_gaming_modal_card"
      >
        {/* Top-Right Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors focus:outline-none"
          aria-label="Close"
          id="responsible_gaming_close_btn"
        >
          <X size={20} />
        </button>

        {/* Center Shield Alert Badge */}
        <div 
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-amber-500/20 to-orange-500/10 border border-amber-500/50 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.35)] mt-2 mb-5"
          id="responsible_gaming_badge"
        >
          <ShieldAlert size={36} className="text-amber-400 sm:w-10 sm:h-10" />
        </div>

        {/* Title */}
        <h2 
          className="text-xl sm:text-2xl font-bold text-white tracking-wide font-sans mb-3"
          id="responsible_gaming_title"
        >
          Responsible Gaming
        </h2>

        {/* Description */}
        <p 
          className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xs font-normal mb-8"
          id="responsible_gaming_description"
        >
          For the best gaming experience, please play responsibly and always set a budget that works for you.
        </p>

        {/* Action Button: PLAY NOW */}
        <button
          onClick={handlePlayNow}
          className="w-full py-3.5 sm:py-4 px-6 rounded-2xl font-black text-slate-950 text-base sm:text-lg uppercase tracking-wider bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.55)] hover:shadow-[0_0_35px_rgba(52,211,153,0.8)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          id="responsible_gaming_play_now_btn"
        >
          <Play size={20} className="fill-slate-950 text-slate-950 shrink-0" />
          <span>PLAY NOW</span>
        </button>
      </div>
    </div>
  );
};
