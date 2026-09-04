import React, { useEffect, useRef } from "react";

export type GameTabType = "ALL" | "MY" | "TOP";

interface GameTabIconProps {
  type: GameTabType;
  active: boolean;
  size?: number;
  className?: string;
}

/**
 * HTML5 Canvas-powered Animated Game Icons for "ALL BETS", "MY BET", and "TOP" tabs.
 * Features high-DPI crisp rendering, futuristic cyber/arcade animations, glowing neon gradients,
 * dynamic radar sweeps, tactical reticles, and holographic gold crown starbursts.
 */
export const GameTabIcon: React.FC<GameTabIconProps> = ({
  type,
  active,
  size = 20,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef({
    angle: 0,
    pulse: 0,
    particles: Array.from({ length: 5 }, () => ({
      x: Math.random() * size,
      y: Math.random() * size,
      speed: 0.4 + Math.random() * 0.6,
      size: 0.8 + Math.random() * 1.2,
      alpha: 0.2 + Math.random() * 0.8,
    })),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let isMounted = true;

    const render = () => {
      if (!isMounted) return;

      const state = stateRef.current;
      state.angle += active ? 0.045 : 0.015;
      state.pulse = (state.pulse + (active ? 0.06 : 0.025)) % (Math.PI * 2);

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const cx = size / 2;
      const cy = size / 2;
      const pulseVal = (Math.sin(state.pulse) + 1) / 2; // 0 to 1

      if (type === "ALL") {
        // ==========================================
        // 1. ALL BETS: Cyber Gaming Squad & Human Avatars (รูปคน)
        // ==========================================
        const squadBaseY = cy + size * 0.32;

        // Ambient squad aura under feet
        if (active) {
          ctx.save();
          const aura = ctx.createRadialGradient(cx, squadBaseY, 1, cx, squadBaseY, size * 0.45);
          aura.addColorStop(0, "rgba(244, 63, 94, 0.4)");
          aura.addColorStop(1, "rgba(244, 63, 94, 0)");
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.ellipse(cx, squadBaseY, size * 0.45, size * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Floating holographic radar ring beneath squad
        ctx.beginPath();
        ctx.ellipse(cx, squadBaseY, size * 0.38, size * 0.14, 0, 0, Math.PI * 2);
        ctx.strokeStyle = active
          ? `rgba(251, 113, 133, ${0.4 + pulseVal * 0.4})`
          : "rgba(156, 163, 175, 0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // ----------------------------------------
        // Flanking Teammate LEFT (Person in background)
        // ----------------------------------------
        const leftHeadX = cx - size * 0.28;
        const leftHeadY = cy - size * 0.08;
        const leftHeadR = size * 0.11;

        // Left Head
        ctx.beginPath();
        ctx.arc(leftHeadX, leftHeadY, leftHeadR, 0, Math.PI * 2);
        ctx.fillStyle = active ? "#f43f5e" : "#6b7280";
        ctx.fill();

        // Left Torso / Shoulder
        ctx.beginPath();
        ctx.moveTo(leftHeadX - size * 0.15, squadBaseY);
        ctx.quadraticCurveTo(leftHeadX - size * 0.14, leftHeadY + leftHeadR + 1, leftHeadX, leftHeadY + leftHeadR + 1);
        ctx.quadraticCurveTo(cx - size * 0.06, leftHeadY + leftHeadR + 2, cx - size * 0.06, squadBaseY);
        ctx.closePath();
        ctx.fillStyle = active ? "#be123c" : "#4b5563";
        ctx.fill();

        // ----------------------------------------
        // Flanking Teammate RIGHT (Person in background)
        // ----------------------------------------
        const rightHeadX = cx + size * 0.28;
        const rightHeadY = cy - size * 0.08;
        const rightHeadR = size * 0.11;

        // Right Head
        ctx.beginPath();
        ctx.arc(rightHeadX, rightHeadY, rightHeadR, 0, Math.PI * 2);
        ctx.fillStyle = active ? "#f43f5e" : "#6b7280";
        ctx.fill();

        // Right Torso / Shoulder
        ctx.beginPath();
        ctx.moveTo(cx + size * 0.06, squadBaseY);
        ctx.quadraticCurveTo(cx + size * 0.06, rightHeadY + rightHeadR + 2, rightHeadX, rightHeadY + rightHeadR + 1);
        ctx.quadraticCurveTo(rightHeadX + size * 0.14, leftHeadY + leftHeadR + 1, rightHeadX + size * 0.15, squadBaseY);
        ctx.closePath();
        ctx.fillStyle = active ? "#be123c" : "#4b5563";
        ctx.fill();

        // ----------------------------------------
        // Main Foreground Commander / Hero Avatar (รูปคนหลักตรงกลาง)
        // ----------------------------------------
        const mainHeadX = cx;
        const mainHeadY = cy - size * 0.16;
        const mainHeadR = size * 0.16;

        // Center Head Contour
        ctx.beginPath();
        ctx.arc(mainHeadX, mainHeadY, mainHeadR, 0, Math.PI * 2);
        const headGrad = ctx.createLinearGradient(cx, mainHeadY - mainHeadR, cx, mainHeadY + mainHeadR);
        if (active) {
          headGrad.addColorStop(0, "#ffe4e6");
          headGrad.addColorStop(0.6, "#fb7185");
          headGrad.addColorStop(1, "#e11d48");
        } else {
          headGrad.addColorStop(0, "#f3f4f6");
          headGrad.addColorStop(0.7, "#9ca3af");
          headGrad.addColorStop(1, "#4b5563");
        }
        ctx.fillStyle = headGrad;
        if (active) {
          ctx.shadowColor = "rgba(244, 63, 94, 0.7)";
          ctx.shadowBlur = 4;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Gaming Headset / Earmuffs on hero avatar
        ctx.fillStyle = active ? "#fff" : "#d1d5db";
        ctx.beginPath();
        ctx.arc(mainHeadX - mainHeadR - 0.5, mainHeadY, 1.2, 0, Math.PI * 2);
        ctx.arc(mainHeadX + mainHeadR + 0.5, mainHeadY, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Cyber Visor across eyes (Glowing slit)
        const visorWidth = mainHeadR * 1.5;
        const visorHeight = 1.6;
        const visorY = mainHeadY - 0.5;
        ctx.beginPath();
        ctx.rect(mainHeadX - visorWidth / 2, visorY, visorWidth, visorHeight);
        ctx.fillStyle = active ? "#ffffff" : "#e5e7eb";
        if (active) {
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 5;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Animated Visor Scan Glint
        const scanOffset = Math.sin(state.angle * 2) * (visorWidth / 2);
        ctx.beginPath();
        ctx.arc(mainHeadX + scanOffset, visorY + visorHeight / 2, 0.9, 0, Math.PI * 2);
        ctx.fillStyle = active ? "#38bdf8" : "#9ca3af";
        ctx.fill();

        // Hero Torso / Armor Shoulders
        const torsoTopY = mainHeadY + mainHeadR + 0.8;
        const torsoBottomY = squadBaseY;
        const shoulderW = size * 0.28;

        ctx.beginPath();
        ctx.moveTo(mainHeadX - shoulderW, torsoBottomY);
        ctx.quadraticCurveTo(mainHeadX - shoulderW * 0.8, torsoTopY, mainHeadX - mainHeadR * 0.5, torsoTopY);
        ctx.lineTo(mainHeadX + mainHeadR * 0.5, torsoTopY);
        ctx.quadraticCurveTo(mainHeadX + shoulderW * 0.8, torsoTopY, mainHeadX + shoulderW, torsoBottomY);
        ctx.closePath();

        const armorGrad = ctx.createLinearGradient(cx, torsoTopY, cx, torsoBottomY);
        if (active) {
          armorGrad.addColorStop(0, "#fb7185");
          armorGrad.addColorStop(0.5, "#e11d48");
          armorGrad.addColorStop(1, "#881337");
        } else {
          armorGrad.addColorStop(0, "#d1d5db");
          armorGrad.addColorStop(0.5, "#6b7280");
          armorGrad.addColorStop(1, "#374151");
        }
        ctx.fillStyle = armorGrad;
        ctx.fill();

        // Armor outline & chest core
        ctx.strokeStyle = active ? "#ffe4e6" : "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Chest Core Reactor / Badge
        ctx.beginPath();
        ctx.arc(mainHeadX, torsoTopY + (torsoBottomY - torsoTopY) * 0.4, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = active ? "#38bdf8" : "#e5e7eb";
        if (active) {
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 4;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

      } else if (type === "MY") {
        // ==========================================
        // 2. MY BET: Valuable 3D Gold Coin (รูปเหรียญที่ดูมีค่า)
        // ==========================================
        const coinR = size * 0.40;

        // Dynamic 3D rotation tilt
        const rotY = Math.cos(state.angle * 1.6);
        const scaleX = 0.88 + 0.12 * Math.abs(rotY);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scaleX, 1);

        // Ambient Gold Glow Aura
        if (active) {
          const goldAura = ctx.createRadialGradient(0, 0, coinR * 0.3, 0, 0, coinR * 1.35);
          goldAura.addColorStop(0, "rgba(245, 158, 11, 0.45)");
          goldAura.addColorStop(0.7, "rgba(251, 191, 36, 0.2)");
          goldAura.addColorStop(1, "rgba(245, 158, 11, 0)");
          ctx.fillStyle = goldAura;
          ctx.beginPath();
          ctx.arc(0, 0, coinR * 1.35, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3D Coin Edge Depth (Side Rim for 3D thickness)
        const edgeOffset = 1.4;
        ctx.beginPath();
        ctx.arc(0, edgeOffset, coinR, 0, Math.PI * 2);
        ctx.fillStyle = active ? "#78350f" : "#374151";
        ctx.fill();

        // Outer Coin Face Base
        ctx.beginPath();
        ctx.arc(0, 0, coinR, 0, Math.PI * 2);
        const rimGrad = ctx.createLinearGradient(-coinR, -coinR, coinR, coinR);
        if (active) {
          rimGrad.addColorStop(0, "#fef08a"); // Bright 24k gold
          rimGrad.addColorStop(0.25, "#f59e0b"); // Pure rich gold
          rimGrad.addColorStop(0.5, "#d97706"); // Amber gold
          rimGrad.addColorStop(0.75, "#b45309"); // Deep bronze
          rimGrad.addColorStop(1, "#fef9c3"); // Gleam edge
        } else {
          rimGrad.addColorStop(0, "#f3f4f6");
          rimGrad.addColorStop(0.4, "#9ca3af");
          rimGrad.addColorStop(0.8, "#6b7280");
          rimGrad.addColorStop(1, "#d1d5db");
        }
        ctx.fillStyle = rimGrad;
        if (active) {
          ctx.shadowColor = "rgba(245, 158, 11, 0.8)";
          ctx.shadowBlur = 5;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Milled Coin Edge Teeth (Reeded rim notches like high-value mint coins)
        const teethCount = 16;
        for (let i = 0; i < teethCount; i++) {
          const tAngle = (i * Math.PI * 2) / teethCount + state.angle * 0.3;
          const tx1 = Math.cos(tAngle) * (coinR - 1.2);
          const ty1 = Math.sin(tAngle) * (coinR - 1.2);
          const tx2 = Math.cos(tAngle) * (coinR - 0.2);
          const ty2 = Math.sin(tAngle) * (coinR - 0.2);
          ctx.beginPath();
          ctx.moveTo(tx1, ty1);
          ctx.lineTo(tx2, ty2);
          ctx.strokeStyle = active ? "rgba(120, 53, 15, 0.45)" : "rgba(75, 85, 99, 0.4)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // Inner Concentric Bevel Channel (Engraved Ring)
        const innerBevelR = coinR * 0.74;
        ctx.beginPath();
        ctx.arc(0, 0, innerBevelR, 0, Math.PI * 2);
        ctx.strokeStyle = active ? "#78350f" : "#4b5563";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Inner Coin Core Dish
        ctx.beginPath();
        ctx.arc(0, 0, innerBevelR - 0.5, 0, Math.PI * 2);
        const coreGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, innerBevelR);
        if (active) {
          coreGrad.addColorStop(0, "#fde047");
          coreGrad.addColorStop(0.65, "#f59e0b");
          coreGrad.addColorStop(1, "#b45309");
        } else {
          coreGrad.addColorStop(0, "#e5e7eb");
          coreGrad.addColorStop(0.65, "#9ca3af");
          coreGrad.addColorStop(1, "#4b5563");
        }
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Stamped 3D Star / Diamond Gem Currency Crest (สัญลักษณ์ดวงดาว/เพชรนูน 3D กลางเหรียญ)
        const starR = innerBevelR * 0.65;
        const numPoints = 4;
        
        ctx.beginPath();
        for (let i = 0; i < numPoints * 2; i++) {
          const r = i % 2 === 0 ? starR : starR * 0.38;
          const a = (i * Math.PI) / numPoints - Math.PI / 2;
          const sx = Math.cos(a) * r;
          const sy = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        
        // Star Gradient (Facet shading)
        const starGrad = ctx.createLinearGradient(-starR, -starR, starR, starR);
        if (active) {
          starGrad.addColorStop(0, "#ffffff"); // Gleaming facet
          starGrad.addColorStop(0.4, "#fef08a");
          starGrad.addColorStop(1, "#78350f");
        } else {
          starGrad.addColorStop(0, "#ffffff");
          starGrad.addColorStop(0.5, "#d1d5db");
          starGrad.addColorStop(1, "#374151");
        }
        ctx.fillStyle = starGrad;
        ctx.fill();

        // Center jewel pip in star
        ctx.beginPath();
        ctx.arc(0, 0, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = active ? "#ffffff" : "#f3f4f6";
        ctx.fill();

        // Lustrous Specular Light Sweep across coin face
        const sweepX = -coinR * 1.4 + ((state.angle * 14) % (coinR * 2.8));
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, coinR - 0.5, 0, Math.PI * 2);
        ctx.clip();

        ctx.beginPath();
        ctx.moveTo(sweepX - 4, -coinR);
        ctx.lineTo(sweepX + 3, -coinR);
        ctx.lineTo(sweepX + 1, coinR);
        ctx.lineTo(sweepX - 6, coinR);
        ctx.closePath();
        ctx.fillStyle = active ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.25)";
        ctx.fill();
        ctx.restore();

        // Metallic Rim Highlight Stroke
        ctx.beginPath();
        ctx.arc(0, 0, coinR - 0.4, 0, Math.PI * 2);
        ctx.strokeStyle = active ? "#fffbeb" : "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.restore(); // end coin scale/translate

        // Sparkle Glint / Starburst twinkle on coin rim
        if (active) {
          const glintAngle = state.angle * 1.5;
          const gx = cx + Math.cos(glintAngle) * (coinR - 1);
          const gy = cy + Math.sin(glintAngle) * (coinR - 1);
          const glintSize = 1.8 + Math.sin(state.pulse * 3) * 0.8;

          ctx.beginPath();
          ctx.moveTo(gx - glintSize, gy);
          ctx.lineTo(gx + glintSize, gy);
          ctx.moveTo(gx, gy - glintSize);
          ctx.lineTo(gx, gy + glintSize);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.shadowColor = "#fef08a";
          ctx.shadowBlur = 4;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

      } else if (type === "TOP") {
        // ==========================================
        // 3. TOP: 3D Holographic Gaming Crown & Golden Sparkles
        // ==========================================
        const crownW = size * 0.75;
        const crownH = size * 0.55;
        const crownTop = cy - crownH * 0.45;
        const crownBottom = cy + crownH * 0.45;
        const crownLeft = cx - crownW * 0.5;
        const crownRight = cx + crownW * 0.5;

        // Floating ambient gold spark particles
        state.particles.forEach((p) => {
          p.y -= p.speed * 0.35;
          if (p.y < cy - size * 0.45) {
            p.y = cy + size * 0.45;
            p.x = cx - crownW * 0.4 + Math.random() * (crownW * 0.8);
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (active ? 0.7 : 0.4), 0, Math.PI * 2);
          ctx.fillStyle = active
            ? `rgba(251, 191, 36, ${p.alpha * (0.5 + pulseVal * 0.5)})`
            : `rgba(156, 163, 175, ${p.alpha * 0.25})`;
          ctx.fill();
        });

        // Ambient Gold Glow on active
        if (active) {
          ctx.save();
          const auraGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, size * 0.48);
          auraGrad.addColorStop(0, "rgba(245, 158, 11, 0.35)");
          auraGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
          ctx.fillStyle = auraGrad;
          ctx.fillRect(0, 0, size, size);
          ctx.restore();
        }

        // Geometric Cyber Crown Path
        const pLeftTop = { x: crownLeft, y: crownTop + crownH * 0.15 };
        const pMidLeft = { x: cx - crownW * 0.22, y: crownTop + crownH * 0.52 };
        const pCenterTop = { x: cx, y: crownTop - (active ? pulseVal * 1.5 : 0) };
        const pMidRight = { x: cx + crownW * 0.22, y: crownTop + crownH * 0.52 };
        const pRightTop = { x: crownRight, y: crownTop + crownH * 0.15 };
        const pBottomRight = { x: crownRight - 1.5, y: crownBottom };
        const pBottomLeft = { x: crownLeft + 1.5, y: crownBottom };

        ctx.beginPath();
        ctx.moveTo(pLeftTop.x, pLeftTop.y);
        ctx.lineTo(pMidLeft.x, pMidLeft.y);
        ctx.lineTo(pCenterTop.x, pCenterTop.y);
        ctx.lineTo(pMidRight.x, pMidRight.y);
        ctx.lineTo(pRightTop.x, pRightTop.y);
        ctx.lineTo(pBottomRight.x, pBottomRight.y);
        ctx.lineTo(pBottomLeft.x, pBottomLeft.y);
        ctx.closePath();

        // Crown Fill Gradient
        const crownGrad = ctx.createLinearGradient(cx, crownTop, cx, crownBottom);
        if (active) {
          crownGrad.addColorStop(0, "#fef08a"); // Bright 24k gold shine
          crownGrad.addColorStop(0.35, "#f59e0b"); // Vibrant amber
          crownGrad.addColorStop(1, "#b45309"); // Rich metallic bronze-gold
        } else {
          crownGrad.addColorStop(0, "#e5e7eb");
          crownGrad.addColorStop(0.5, "#9ca3af");
          crownGrad.addColorStop(1, "#4b5563");
        }
        ctx.fillStyle = crownGrad;
        if (active) {
          ctx.shadowColor = "rgba(245, 158, 11, 0.85)";
          ctx.shadowBlur = 6;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Metallic outline
        ctx.strokeStyle = active ? "#fef3c7" : "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 1;
        ctx.lineJoin = "round";
        ctx.stroke();

        // Crown base highlight bar
        ctx.beginPath();
        ctx.moveTo(pBottomLeft.x + 0.5, crownBottom - 1.5);
        ctx.lineTo(pBottomRight.x - 0.5, crownBottom - 1.5);
        ctx.strokeStyle = active ? "#ffffff" : "#d1d5db";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Top 3 Tip Jewels / Star Pips
        const tipPoints = [pLeftTop, pCenterTop, pRightTop];
        tipPoints.forEach((tip, idx) => {
          ctx.beginPath();
          const pipRadius = idx === 1 ? (active ? 1.6 : 1.3) : 1.1;
          ctx.arc(tip.x, tip.y - 1, pipRadius, 0, Math.PI * 2);
          ctx.fillStyle = active ? "#ffffff" : "#f3f4f6";
          if (active) {
            ctx.shadowColor = "#fde047";
            ctx.shadowBlur = 4;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        });

        // Shimmer Light sweep reflection across crown
        const sweepX = crownLeft + ((state.angle * 12) % (crownW * 1.8));
        ctx.save();
        ctx.beginPath();
        ctx.rect(crownLeft, crownTop - 2, crownW, crownH + 4);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(sweepX - 3, crownTop);
        ctx.lineTo(sweepX + 2, crownTop);
        ctx.lineTo(sweepX - 1, crownBottom);
        ctx.lineTo(sweepX - 6, crownBottom);
        ctx.closePath();
        ctx.fillStyle = active ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.2)";
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [type, active, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`inline-block pointer-events-none flex-shrink-0 align-middle ${className}`}
      aria-hidden="true"
    />
  );
};
