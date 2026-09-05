import React, { useEffect, useRef } from "react";
import { X, Play, ShieldAlert, Sparkles, AlertCircle, Clock, Wallet, HeartHandshake } from "lucide-react";
import { audioManager } from "../audio";

interface ResponsibleGamingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * High-Performance HTML5 Canvas Animated 3D Holographic Security Shield
 * Features:
 * - 3D Perspective rotation & floating dynamics
 * - Metallic 24K Gold / Radiant Amber layered shield geometry
 * - Stamped Neon Warning Symbol (!) with inner radiance
 * - Concentric expanding radar sonar wave pulses
 * - Orbiting cyber target brackets and floating energy embers
 * - Dynamic specular light sheen sweep
 */
const HologramShieldCanvas: React.FC<{ size?: number }> = ({ size = 96 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 2, 3);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let animId = 0;
    let isMounted = true;
    let tick = 0;

    // Embers / cyber sparks
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      life: number;
      maxLife: number;
      size: number;
    }> = [];

    const render = () => {
      if (!isMounted) return;
      tick += 0.035;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const cx = size / 2;
      const cy = size / 2 + Math.sin(tick * 1.5) * 2; // Gentle hover float

      // 1. Concentric Sonar Pulse Wave
      const pulsePhase = (tick * 0.5) % 1;
      const waveR = size * 0.22 + pulsePhase * (size * 0.26);
      ctx.beginPath();
      ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${Math.max(0, (1 - pulsePhase) * 0.6)})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 2. Ambient Radiant Aura (Gold & Amber Bloom)
      const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.48);
      aura.addColorStop(0, "rgba(251, 191, 36, 0.45)");
      aura.addColorStop(0.5, "rgba(245, 158, 11, 0.2)");
      aura.addColorStop(1, "rgba(217, 119, 6, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // 3. Rotating Orbital Cyber HUD Rings with Tick Marks
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tick * 0.6);

      const orbitR = size * 0.42;
      // 4 Segmented arcs
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(0, 0, orbitR, a + 0.18, a + Math.PI / 2 - 0.18);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Corner tick mark
        const tx = Math.cos(a) * (orbitR + 2);
        const ty = Math.sin(a) * (orbitR + 2);
        ctx.beginPath();
        ctx.arc(tx, ty, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "#fef08a";
        ctx.fill();
      }
      ctx.restore();

      // Reverse counter-rotating inner dashed ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-tick * 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 4. Draw 3D Metallic Shield
      const tiltX = Math.cos(tick * 1.2) * 0.08;
      const shieldW = size * 0.32;
      const shieldH = size * 0.38;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1 + tiltX * 0.5, 1);

      // Helper function to trace shield polygon
      const traceShieldPath = (w: number, h: number, yOff: number = 0) => {
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.95 + yOff);
        ctx.lineTo(w * 0.95, -h * 0.65 + yOff);
        ctx.quadraticCurveTo(w * 0.95, h * 0.25 + yOff, 0, h + yOff);
        ctx.quadraticCurveTo(-w * 0.95, h * 0.25 + yOff, -w * 0.95, -h * 0.65 + yOff);
        ctx.closePath();
      };

      // 3D Extrusion Shadow (Shield depth)
      traceShieldPath(shieldW, shieldH, 2.5);
      ctx.fillStyle = "#78350f";
      ctx.fill();

      // Outer Shield Rim (High-Voltage 24K Gold Gradient)
      traceShieldPath(shieldW, shieldH, 0);
      const outerGrad = ctx.createLinearGradient(-shieldW, -shieldH, shieldW, shieldH);
      outerGrad.addColorStop(0, "#fef08a");
      outerGrad.addColorStop(0.25, "#f59e0b");
      outerGrad.addColorStop(0.65, "#d97706");
      outerGrad.addColorStop(1, "#b45309");
      ctx.fillStyle = outerGrad;
      ctx.shadowColor = "rgba(245, 158, 11, 0.8)";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outer Bevel Highlight Stroke
      ctx.strokeStyle = "#fef9c3";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Inner Dark Obsidian Armor Core Plate
      const innerW = shieldW * 0.82;
      const innerH = shieldH * 0.82;
      traceShieldPath(innerW, innerH, 0);
      const innerPlateGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, innerH);
      innerPlateGrad.addColorStop(0, "#2a1506");
      innerPlateGrad.addColorStop(0.6, "#1a0b02");
      innerPlateGrad.addColorStop(1, "#0c0401");
      ctx.fillStyle = innerPlateGrad;
      ctx.fill();

      // Inner Circuit Border
      ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Specular Light Sheen Sweep (Passing laser glint)
      const sweepX = -shieldW * 1.5 + ((tick * 22) % (shieldW * 3.5));
      ctx.save();
      traceShieldPath(innerW, innerH, 0);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(sweepX - 5, -shieldH);
      ctx.lineTo(sweepX + 4, -shieldH);
      ctx.lineTo(sweepX + 1, shieldH);
      ctx.lineTo(sweepX - 8, shieldH);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fill();
      ctx.restore();

      // 5. Stamped Radiant Exclamation Mark (!) in Center
      const iconH = innerH * 0.52;
      const barTop = -iconH * 0.72;
      const barBottom = iconH * 0.12;
      const barTopW = 2.4;
      const barBottomW = 1.4;

      // Exclamation Bar
      ctx.beginPath();
      ctx.moveTo(-barTopW, barTop);
      ctx.lineTo(barTopW, barTop);
      ctx.lineTo(barBottomW, barBottom);
      ctx.lineTo(-barBottomW, barBottom);
      ctx.closePath();
      const exGrad = ctx.createLinearGradient(0, barTop, 0, barBottom);
      exGrad.addColorStop(0, "#ffffff");
      exGrad.addColorStop(0.5, "#fef08a");
      exGrad.addColorStop(1, "#f59e0b");
      ctx.fillStyle = exGrad;
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 6;
      ctx.fill();

      // Exclamation Dot
      const dotY = iconH * 0.46;
      const dotR = 2.2;
      ctx.beginPath();
      ctx.arc(0, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore(); // end shield translate & scale

      // 6. Sparkle Embers Particles (Ascending golden dust)
      if (Math.random() < 0.25) {
        particles.push({
          x: cx + (Math.random() - 0.5) * (size * 0.5),
          y: cy + size * 0.25 + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -0.6 - Math.random() * 0.8,
          alpha: 1,
          life: 0,
          maxLife: 40 + Math.random() * 30,
          size: 0.8 + Math.random() * 1.4,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(254, 240, 138, ${p.alpha})`;
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 3;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      // Sparkle Star on Shield Tip
      const tipGlint = (tick * 1.5) % Math.PI;
      if (tipGlint < 0.5) {
        const gx = cx;
        const gy = cy - shieldH * 0.95;
        const gSize = (Math.sin(tipGlint * Math.PI) * 2.5);
        ctx.beginPath();
        ctx.moveTo(gx - gSize, gy);
        ctx.lineTo(gx + gSize, gy);
        ctx.moveTo(gx, gy - gSize);
        ctx.lineTo(gx, gy + gSize);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.shadowColor = "#fef08a";
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${size}px`, height: `${size}px` }}
      className="inline-block pointer-events-none drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]"
    />
  );
};

/**
 * Ambient Cyber Matrix Background Canvas for Modal Card
 */
const CyberGridBackdropCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let isMounted = true;
    let t = 0;

    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const nodes: Array<{ x: number; y: number; s: number; speed: number; alpha: number }> = [];
    for (let i = 0; i < 24; i++) {
      nodes.push({
        x: Math.random() * (canvas.width || 400),
        y: Math.random() * (canvas.height || 400),
        s: 0.8 + Math.random() * 1.5,
        speed: 0.2 + Math.random() * 0.4,
        alpha: 0.2 + Math.random() * 0.4,
      });
    }

    const render = () => {
      if (!isMounted) return;
      t += 0.02;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cyber Grid lines
      const w = canvas.width;
      const h = canvas.height;
      const gridSize = 28;
      ctx.strokeStyle = "rgba(245, 158, 11, 0.035)";
      ctx.lineWidth = 0.8;

      ctx.beginPath();
      for (let x = 0; x <= w; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y <= h; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Floating digital nodes
      for (const node of nodes) {
        node.y -= node.speed;
        if (node.y < -5) {
          node.y = h + 5;
          node.x = Math.random() * w;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 191, 36, ${node.alpha * (0.5 + Math.sin(t + node.x) * 0.4)})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      isMounted = false;
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none rounded-3xl opacity-75"
    />
  );
};

export const ResponsibleGamingModal: React.FC<ResponsibleGamingModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleDismiss = () => {
    audioManager.playClick();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9990] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-300"
      id="responsible_gaming_modal_overlay"
    >
      {/* Sci-Fi Gaming Modal Card */}
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#13111c] via-[#0d0d18] to-[#070710] border border-amber-500/40 rounded-3xl p-5 sm:p-7 flex flex-col items-center text-center shadow-[0_0_50px_rgba(245,158,11,0.22),0_0_100px_rgba(0,0,0,0.85)] select-none overflow-hidden transition-all duration-300"
        id="responsible_gaming_modal_card"
      >
        {/* Dynamic Canvas Ambient Cyber Grid in background */}
        <CyberGridBackdropCanvas />

        {/* Tactical HUD Corner Brackets */}
        <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 border-amber-400/80 rounded-tl pointer-events-none" />
        <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 border-amber-400/80 rounded-tr pointer-events-none" />
        <div className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b-2 border-l-2 border-amber-400/80 rounded-bl pointer-events-none" />
        <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 border-amber-400/80 rounded-br pointer-events-none" />

        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b]" />

        {/* Top-Right Cyber Close Button - Dismiss and enter game */}
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 p-2 rounded-xl text-slate-400 hover:text-amber-300 bg-slate-900/80 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/50 shadow-[0_0_10px_rgba(0,0,0,0.5)] active:scale-95 transition-all focus:outline-none group"
          aria-label="Close"
          id="responsible_gaming_close_btn"
          title="Dismiss advisory and enter game"
        >
          <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* Center Animated 3D Holographic Shield via HTML5 Canvas */}
        <div className="relative z-10 my-2 flex items-center justify-center">
          <HologramShieldCanvas size={108} />
        </div>

        {/* Main Title */}
        <div className="relative z-10 mt-1 mb-2">
          <h2
            className="text-2xl sm:text-[26px] font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 font-sans drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: "'Orbitron', 'Chakra Petch', sans-serif" }}
            id="responsible_gaming_title"
          >
            Responsible Gaming
          </h2>
        </div>

        {/* Advisory Message Text - Exactly 2 lines, small bold typography */}
        <div
          className="relative z-10 text-slate-300 text-[11px] sm:text-xs font-bold leading-relaxed mb-5 px-1 select-none"
          id="responsible_gaming_description"
        >
          <p className="whitespace-normal sm:whitespace-nowrap">
            For the best gaming experience, please play responsibly
          </p>
          <p className="whitespace-normal sm:whitespace-nowrap text-slate-400 font-semibold mt-0.5">
            and always set a budget that works for you.
          </p>
        </div>

        {/* Mini Gaming Guidance Badges */}
        <div className="relative z-10 w-full grid grid-cols-3 gap-1.5 mb-5 px-1">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <Clock size={14} className="text-amber-400 mb-1" />
            <span className="text-[9px] font-mono font-bold text-slate-300">Set Limits</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <Wallet size={14} className="text-emerald-400 mb-1" />
            <span className="text-[9px] font-mono font-bold text-slate-300">Play Budget</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <HeartHandshake size={14} className="text-sky-400 mb-1" />
            <span className="text-[9px] font-mono font-bold text-slate-300">Stay in Control</span>
          </div>
        </div>

        {/* Action Button: PLAY GAME - Dismiss and enter game */}
        <button
          onClick={handleDismiss}
          className="relative z-10 w-full group overflow-hidden py-3.5 sm:py-4 px-6 rounded-2xl font-black text-slate-950 text-base sm:text-lg uppercase tracking-wider bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 border-t border-emerald-200 shadow-[0_0_30px_rgba(52,211,153,0.6),0_4px_0_#065f46] hover:shadow-[0_0_45px_rgba(52,211,153,0.85),0_4px_0_#065f46] hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_#065f46,0_0_20px_rgba(52,211,153,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          id="responsible_gaming_play_now_btn"
        >
          {/* Animated specular light sheen */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

          <Play size={20} className="fill-slate-950 text-slate-950 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="font-extrabold tracking-widest drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]">
            PLAY GAME
          </span>
        </button>

        {/* Disclaimer subtext */}
        <div className="relative z-10 text-[10px] text-slate-500 font-mono mt-3">
          18+ • Strictly for entertainment purposes
        </div>
      </div>
    </div>
  );
};
