import React, { useEffect, useRef, useState, memo } from "react";
import { RoundState } from "../types";
import { getMultiplierColorTier } from "../utils/multiplierColor";

interface GameCanvasProps {
  multiplier: number;
  state: RoundState;
  countdown: number;
  maxCountdown: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const MAX_PARTICLES = 50;
const MAX_SPEED_LINES = 12;

export const GameCanvas: React.FC<GameCanvasProps> = memo(({
  multiplier,
  state,
  countdown,
  maxCountdown,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Store dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // References to decouple high-frequency state from React re-renders
  const multiplierRef = useRef(multiplier);
  const stateRef = useRef(state);
  const countdownRef = useRef(countdown);
  const maxCountdownRef = useRef(maxCountdown);
  const dimensionsRef = useRef(dimensions);

  // Sync refs instantly
  multiplierRef.current = multiplier;
  stateRef.current = state;
  countdownRef.current = countdown;
  maxCountdownRef.current = maxCountdown;
  dimensionsRef.current = dimensions;

  // Animation Engine State Container
  const engineRef = useRef({
    lastTimestamp: 0,
    gridOffset: 0,
    propellerAngle: 0,
    planeHoverPhase: 0,
    flewAwayTime: 0,
    particles: [] as Particle[],
    burstShockwave: { active: false, x: 0, y: 0, radius: 0, alpha: 0 },
    stars: [] as Array<{ xRatio: number; yRatio: number; size: number; brightness: number; speed: number; layer: "small" | "medium" | "large" }>,
    nebulae: [] as Array<{ xRatio: number; yRatio: number; vx: number; vy: number; radiusRatio: number; baseRadiusRatio: number; color1: string; pulseSpeed: number; phase: number }>,
    speedLines: [] as Array<{ x: number; y: number; length: number; speed: number; alpha: number }>,
    shootingStars: [] as Array<{ x: number; y: number; vx: number; vy: number; length: number; alpha: number; active: boolean }>,
    lastShootingStarSpawn: 0,
    prevRoundState: state,
  });

  // Pre-initialize particle pool once
  useEffect(() => {
    const engine = engineRef.current;
    if (engine.particles.length === 0) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        engine.particles.push({
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          life: 0,
          maxLife: 30,
          size: 2,
          color: "#f97316",
        });
      }
    }
  }, []);

  // Resize observer with smooth hardware dimension sync
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const resolvedWidth = Math.max(Math.floor(width), 280);
        const resolvedHeight = Math.max(Math.floor(height), 220);
        setDimensions({ width: resolvedWidth, height: resolvedHeight });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Update canvas internal buffer dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // limit to 2x DPR for GPU efficiency
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
  }, [dimensions]);

  // Main Hardware-Synced 60 FPS Animation & Render Loop (Never destroyed on multiplier ticks!)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animFrameId: number;

    const renderLoop = (timestamp: number) => {
      const engine = engineRef.current;
      if (!engine.lastTimestamp) engine.lastTimestamp = timestamp;
      
      // Calculate delta time (clamped between 1ms and 100ms for safety against tab throttling)
      const dt = Math.min(Math.max((timestamp - engine.lastTimestamp) / 1000, 0.001), 0.1);
      engine.lastTimestamp = timestamp;
      const dtScale = dt * 60; // 1.0 at standard 60 FPS

      const curState = stateRef.current;
      const curMultiplier = Math.max(multiplierRef.current, 1.0);
      const curCountdown = countdownRef.current;
      const curMaxCountdown = maxCountdownRef.current;
      const width = dimensionsRef.current.width;
      const height = dimensionsRef.current.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Trigger burst shockwave immediately when state transitions to FLEW_AWAY
      if (curState === "FLEW_AWAY" && engine.prevRoundState === "FLYING") {
        engine.flewAwayTime = timestamp;
        // Compute last rocket position
        const startX = 40;
        const startY = height - 40;
        const safeMult = typeof curMultiplier === "number" && isFinite(curMultiplier) ? curMultiplier : 1.0;
        const progress = Math.max(0, Math.min((safeMult - 1) / 4, 0.85));
        const planeX = startX + Math.max(0, width - startX - 80) * progress;
        const rise = Math.pow(Math.max(0, progress), 1.4);
        const planeY = startY - Math.max(0, height - 80) * rise;

        engine.burstShockwave = {
          active: true,
          x: planeX,
          y: planeY,
          radius: 10,
          alpha: 1.0,
        };

        // Spawn rapid blast particles
        const blastColors = ["#ffffff", "#fef08a", "#fb7185", "#f43f5e", "#f97316"];
        for (let i = 0; i < 24; i++) {
          const p = engine.particles[i % MAX_PARTICLES];
          const angle = Math.random() * Math.PI * 2;
          const spd = 2.5 + Math.random() * 5.5;
          p.active = true;
          p.x = planeX;
          p.y = planeY;
          p.vx = Math.cos(angle) * spd;
          p.vy = Math.sin(angle) * spd;
          p.life = 25 + Math.random() * 15;
          p.maxLife = p.life;
          p.size = 2.5 + Math.random() * 3.5;
          p.color = blastColors[Math.floor(Math.random() * blastColors.length)];
        }
      } else if (curState === "WAITING" && engine.prevRoundState !== "WAITING") {
        engine.flewAwayTime = 0;
        engine.burstShockwave.active = false;
        // Kill particles on round reset
        for (let i = 0; i < MAX_PARTICLES; i++) {
          engine.particles[i].active = false;
        }
      }
      engine.prevRoundState = curState;

      // Apply DPR scaling for crisp canvas rendering
      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear & Draw Space Dark Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#020818");
      bgGrad.addColorStop(1, "#0d0527");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // --- 1. INITIALIZE BACKGROUND ASSETS ONCE ---
      if (engine.stars.length === 0) {
        for (let i = 0; i < 180; i++) {
          engine.stars.push({
            xRatio: Math.random(),
            yRatio: Math.random(),
            size: 0.3 + Math.random() * 0.5,
            brightness: Math.random(),
            speed: 0.001 + Math.random() * 0.003,
            layer: "small",
          });
        }
        for (let i = 0; i < 60; i++) {
          engine.stars.push({
            xRatio: Math.random(),
            yRatio: Math.random(),
            size: 0.8 + Math.random() * 0.7,
            brightness: Math.random(),
            speed: 0.004 + Math.random() * 0.007,
            layer: "medium",
          });
        }
        for (let i = 0; i < 16; i++) {
          engine.stars.push({
            xRatio: Math.random(),
            yRatio: Math.random(),
            size: 1.8 + Math.random() * 1.0,
            brightness: Math.random(),
            speed: 0.002 + Math.random() * 0.005,
            layer: "large",
          });
        }
      }

      if (engine.nebulae.length === 0) {
        engine.nebulae.push(
          {
            xRatio: 0.3,
            yRatio: 0.25,
            vx: 0.012,
            vy: 0.006,
            radiusRatio: 0.45,
            baseRadiusRatio: 0.45,
            color1: "#4a0080",
            pulseSpeed: 0.001,
            phase: 0,
          },
          {
            xRatio: 0.75,
            yRatio: 0.65,
            vx: -0.008,
            vy: 0.012,
            radiusRatio: 0.55,
            baseRadiusRatio: 0.55,
            color1: "#001a6e",
            pulseSpeed: 0.0015,
            phase: Math.PI / 3,
          },
          {
            xRatio: 0.5,
            yRatio: 0.45,
            vx: 0.006,
            vy: -0.006,
            radiusRatio: 0.4,
            baseRadiusRatio: 0.4,
            color1: "#4a0080",
            pulseSpeed: 0.0008,
            phase: Math.PI / 1.5,
          }
        );
      }

      if (engine.speedLines.length === 0) {
        for (let i = 0; i < MAX_SPEED_LINES; i++) {
          engine.speedLines.push({
            x: Math.random() * width,
            y: Math.random() * (height - 40),
            length: 40 + Math.random() * 100,
            speed: 1.5 + Math.random() * 4,
            alpha: 0.03 + Math.random() * 0.1,
          });
        }
      }

      // --- 2. DRAW TWINKLING STARS (Delta-time synced) ---
      for (let i = 0; i < engine.stars.length; i++) {
        const star = engine.stars[i];
        star.brightness += star.speed * dtScale;
        if (star.brightness > 1 || star.brightness < 0.15) {
          star.speed = -star.speed;
        }
        const sX = star.xRatio * width;
        const sY = star.yRatio * height;
        const currentAlpha = Math.max(0.15, Math.min(1, star.brightness));

        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(sX, sY, star.size, 0, 2 * Math.PI);
        ctx.fill();
      }

      // --- 3. DRAW NEBULAE (Fast lightweight radial rendering) ---
      for (let i = 0; i < engine.nebulae.length; i++) {
        const n = engine.nebulae[i];
        n.xRatio += (n.vx / 60) * dtScale;
        n.yRatio += (n.vy / 60) * dtScale;
        if (n.xRatio < -0.3) n.xRatio = 1.3;
        if (n.xRatio > 1.3) n.xRatio = -0.3;
        if (n.yRatio < -0.3) n.yRatio = 1.3;
        if (n.yRatio > 1.3) n.yRatio = -0.3;

        n.phase += n.pulseSpeed * dtScale;
        const currentRadius = n.baseRadiusRatio * (1 + Math.sin(n.phase) * 0.12) * Math.min(width, height);
        const nebX = n.xRatio * width;
        const nebY = n.yRatio * height;

        if (currentRadius > 1) {
          const cloudGrad = ctx.createRadialGradient(nebX, nebY, 0, nebX, nebY, currentRadius);
          const opacity = 0.14 + (Math.sin(n.phase) + 1) * 0.04;
          cloudGrad.addColorStop(0, n.color1 === "#4a0080" ? `rgba(74, 0, 128, ${opacity})` : `rgba(0, 26, 110, ${opacity})`);
          cloudGrad.addColorStop(0.6, n.color1 === "#4a0080" ? `rgba(74, 0, 128, ${opacity * 0.3})` : `rgba(0, 26, 110, ${opacity * 0.3})`);
          cloudGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.fillStyle = cloudGrad;
          ctx.beginPath();
          ctx.arc(nebX, nebY, currentRadius, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // --- 4. RANDOM SHOOTING STAR (Non-blocking) ---
      if (engine.shootingStars.length === 0 && timestamp - engine.lastShootingStarSpawn > 5000 + Math.random() * 5000) {
        engine.shootingStars.push({
          x: (0.4 + Math.random() * 0.5) * width,
          y: Math.random() * 0.25 * height,
          vx: -7 - Math.random() * 7,
          vy: 3.5 + Math.random() * 3.5,
          length: 50 + Math.random() * 60,
          alpha: 1.0,
          active: true,
        });
        engine.lastShootingStarSpawn = timestamp;
      }

      for (let i = 0; i < engine.shootingStars.length; i++) {
        const ss = engine.shootingStars[i];
        if (!ss.active) continue;
        ss.x += ss.vx * dtScale;
        ss.y += ss.vy * dtScale;
        ss.alpha -= 0.022 * dtScale;
        if (ss.alpha <= 0 || ss.x < -100 || ss.y > height + 100) {
          ss.active = false;
        } else {
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, ss.alpha)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(ss.x, ss.y);
          ctx.lineTo(ss.x - ss.vx * 1.1, ss.y - ss.vy * 1.1);
          ctx.stroke();
        }
      }
      for (let i = engine.shootingStars.length - 1; i >= 0; i--) {
        if (!engine.shootingStars[i].active) {
          engine.shootingStars.splice(i, 1);
        }
      }

      // --- 5. DISTANT FAINT GALAXY ---
      const galX = width * 0.82;
      const galY = height * 0.18;
      ctx.save();
      ctx.translate(galX, galY);
      ctx.rotate(-0.35);
      const galGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
      galGrad.addColorStop(0, "rgba(255, 230, 255, 0.12)");
      galGrad.addColorStop(0.4, "rgba(139, 92, 246, 0.06)");
      galGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = galGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 14, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // --- 6. DYNAMIC SPEED LINES ---
      let speedFactor = 1;
      if (curState === "FLYING") {
        speedFactor = Math.min(1 + curMultiplier * 2.2, 28);
      } else if (curState === "FLEW_AWAY") {
        speedFactor = 18;
      }

      for (let i = 0; i < engine.speedLines.length; i++) {
        const line = engine.speedLines[i];
        line.x -= line.speed * speedFactor * dtScale;
        if (line.x < -line.length) {
          line.x = width + Math.random() * 50;
          line.y = Math.random() * (height - 40);
          line.length = 40 + Math.random() * 120;
          line.alpha = 0.03 + Math.random() * 0.12;
          line.speed = 1.2 + Math.random() * 3.8;
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${line.alpha * Math.min(speedFactor * 0.45, 1.2)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x + line.length, line.y);
        ctx.stroke();
      }

      // --- 7. SCROLLING GRID & AXES ---
      let scrollSpeed = 0.5;
      if (curState === "FLYING") {
        scrollSpeed = Math.min(2 + curMultiplier * 1.5, 12);
      } else if (curState === "FLEW_AWAY") {
        scrollSpeed = 5;
      }
      engine.gridOffset = (engine.gridOffset + scrollSpeed * dtScale) % 40;

      ctx.strokeStyle = "rgba(99, 102, 241, 0.012)";
      ctx.lineWidth = 1;

      for (let x = -40 + engine.gridOffset; x < width + 40; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      const hOffset = (engine.gridOffset * 0.5) % 40;
      for (let y = -40 + hOffset; y < height + 40; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 0);
      ctx.lineTo(40, height - 40);
      ctx.lineTo(width, height - 40);
      ctx.stroke();

      // Tick marks
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "10px 'Chakra Petch', monospace";
      ctx.textAlign = "center";
      for (let i = 1; i <= 5; i++) {
        const tickX = 40 + (width - 80) * (i / 5);
        ctx.beginPath();
        ctx.moveTo(tickX, height - 40);
        ctx.lineTo(tickX, height - 35);
        ctx.stroke();
        ctx.fillText(`${i * 2}s`, tickX, height - 20);
      }

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 1; i <= 4; i++) {
        const tickY = height - 40 - (height - 80) * (i / 4);
        ctx.beginPath();
        ctx.moveTo(35, tickY);
        ctx.lineTo(40, tickY);
        ctx.stroke();
        ctx.fillText(`x${(1 + i * 0.5).toFixed(1)}`, 28, tickY);
      }

      // --- 8. STATE SPECIFIC DRAWING ---
      if (curState === "WAITING") {
        const percent = Math.max(0, Math.min(1, curCountdown / curMaxCountdown));
        const centerX = width / 2;
        const centerY = height / 2 - 20;

        // Glowing outer circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 55, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, 55, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * percent, false);
        ctx.strokeStyle = "#e91e63";
        ctx.lineWidth = 6;
        ctx.stroke();

        // 3D Sci-Fi Rocket - Vertical Waiting Position
        ctx.save();
        ctx.translate(centerX, centerY);

        const idleFlame = 6 + Math.sin(timestamp / 80) * 3;
        const idleFlameGrad = ctx.createLinearGradient(0, 16, 0, 16 + idleFlame);
        idleFlameGrad.addColorStop(0, "#ffffff");
        idleFlameGrad.addColorStop(0.3, "#38bdf8");
        idleFlameGrad.addColorStop(0.8, "#6366f1");
        idleFlameGrad.addColorStop(1, "rgba(99, 102, 241, 0)");
        ctx.fillStyle = idleFlameGrad;
        ctx.beginPath();
        ctx.moveTo(-4, 16);
        ctx.lineTo(0, 16 + idleFlame);
        ctx.lineTo(4, 16);
        ctx.closePath();
        ctx.fill();

        // Left Fin
        ctx.fillStyle = "#1e1b4b";
        ctx.beginPath();
        ctx.moveTo(-6, 8);
        ctx.lineTo(-17, 18);
        ctx.lineTo(-13, 20);
        ctx.lineTo(-5, 15);
        ctx.closePath();
        ctx.fill();

        // Right Fin
        ctx.fillStyle = "#312e81";
        ctx.beginPath();
        ctx.moveTo(6, 8);
        ctx.lineTo(17, 18);
        ctx.lineTo(13, 20);
        ctx.lineTo(5, 15);
        ctx.closePath();
        ctx.fill();

        // Rocket Body Left
        const bodyGradL = ctx.createLinearGradient(-10, 0, 0, 0);
        bodyGradL.addColorStop(0, "#cbd5e1");
        bodyGradL.addColorStop(1, "#f8fafc");
        ctx.fillStyle = bodyGradL;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(-8, -10, -7, 16);
        ctx.lineTo(0, 16);
        ctx.closePath();
        ctx.fill();

        // Rocket Body Right
        const bodyGradR = ctx.createLinearGradient(0, 0, 10, 0);
        bodyGradR.addColorStop(0, "#ffffff");
        bodyGradR.addColorStop(1, "#94a3b8");
        ctx.fillStyle = bodyGradR;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(8, -10, 7, 16);
        ctx.lineTo(0, 16);
        ctx.closePath();
        ctx.fill();

        // Nose Cone Trim
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(-3.5, -14);
        ctx.lineTo(3.5, -14);
        ctx.closePath();
        ctx.fill();

        // Rocket Porthole Window
        ctx.fillStyle = "#0284c7";
        ctx.beginPath();
        ctx.arc(0, -4, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(0, -4, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-1, -5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Keel
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(-1.2, 16);
        ctx.lineTo(1.2, 16);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Display Status Text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px 'Rajdhani', 'Orbitron', 'Montserrat', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("WAITING FOR NEXT ROUND", centerX, centerY + 90);

        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "600 14px 'Chakra Petch', monospace";
        ctx.fillText(`PLACING BETS (${curCountdown.toFixed(1)}s)`, centerX, centerY + 115);

      } else if (curState === "FLYING" || curState === "FLEW_AWAY") {
        // --- FLIGHT CURVE & ROCKET RENDERING ---
        const startX = 40;
        const startY = height - 40;

        // Dynamic flight trajectory synchronized with rapid launch & acceleration
        const deltaMult = Math.max(0, curMultiplier - 1.0);
        const progress = Math.min(0.88, Math.pow(deltaMult / (deltaMult + 3.0), 0.72) * 1.38);
        const planeX = startX + Math.max(0, width - startX - 80) * progress;
        const rise = Math.pow(progress, 1.35);
        const rawPlaneY = startY - Math.max(0, height - 85) * rise;
        const planeY = isFinite(rawPlaneY) ? rawPlaneY : startY;

        const cpX = startX + (planeX - startX) * 0.55;
        const cpY = startY - (startY - planeY) * 0.08;

        // Gradient filled under-curve
        const curveGrad = ctx.createLinearGradient(0, startY, 0, planeY);
        curveGrad.addColorStop(0, "rgba(239, 68, 68, 0.0)");
        curveGrad.addColorStop(0.6, "rgba(249, 115, 22, 0.12)");
        curveGrad.addColorStop(1, "rgba(239, 68, 68, 0.32)");

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, planeX, planeY);
        ctx.lineTo(planeX, startY);
        ctx.closePath();
        ctx.fillStyle = curveGrad;
        ctx.fill();

        // 1. Broad outer halo (lightweight layered stroke without heavy shadowBlur)
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, planeX, planeY);
        ctx.strokeStyle = "rgba(249, 115, 22, 0.22)";
        ctx.lineWidth = 10;
        ctx.stroke();

        // 2. Fiery Plasma Gradient along the curve
        const fireBeamGrad = ctx.createLinearGradient(startX, startY, planeX, planeY);
        fireBeamGrad.addColorStop(0, "rgba(225, 29, 72, 0.7)");
        fireBeamGrad.addColorStop(0.45, "rgba(239, 68, 68, 0.95)");
        fireBeamGrad.addColorStop(0.8, "rgba(249, 115, 22, 1.0)");
        fireBeamGrad.addColorStop(0.96, "rgba(253, 224, 71, 1.0)");
        fireBeamGrad.addColorStop(1, "rgba(255, 255, 255, 1.0)");

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, planeX, planeY);
        ctx.strokeStyle = fireBeamGrad;
        ctx.lineWidth = 4.5;
        ctx.stroke();

        // 3. Crisp Laser Core
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, planeX, planeY);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Spawn Jet exhaust flame particles (in-place pool, zero allocation)
        if (curState === "FLYING") {
          for (let i = 0; i < MAX_PARTICLES; i++) {
            const p = engine.particles[i];
            if (!p.active) {
              const t = 0.6 + Math.random() * 0.4;
              const oneMinusT = 1 - t;
              const curveEmberX = (oneMinusT * oneMinusT * startX) + (2 * oneMinusT * t * cpX) + (t * t * planeX);
              const curveEmberY = (oneMinusT * oneMinusT * startY) + (2 * oneMinusT * t * cpY) + (t * t * planeY);

              p.active = true;
              p.x = curveEmberX + (Math.random() - 0.5) * 4;
              p.y = curveEmberY + (Math.random() - 0.5) * 4;
              p.vx = -1.2 - Math.random() * 2.2;
              p.vy = (Math.random() - 0.3) * 2.0;
              p.life = 20 + Math.random() * 20;
              p.maxLife = p.life;
              p.size = 1.5 + Math.random() * 3;
              p.color = Math.random() < 0.5 ? "#fef08a" : "#f97316";
              break;
            }
          }
        }

        // Draw Active Particles (Batch rendered without save/restore overhead)
        for (let i = 0; i < MAX_PARTICLES; i++) {
          const p = engine.particles[i];
          if (!p.active) continue;

          p.x += p.vx * dtScale;
          p.y += p.vy * dtScale;
          p.life -= dtScale;

          if (p.life <= 0) {
            p.active = false;
            continue;
          }

          const lifeRatio = p.life / p.maxLife;
          const currentRadius = p.size * lifeRatio;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, lifeRatio));
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.2, currentRadius), 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Render Shockwave on Bust (Smooth expanding ring)
        if (engine.burstShockwave.active) {
          const sw = engine.burstShockwave;
          sw.radius += 3.5 * dtScale;
          sw.alpha -= 0.04 * dtScale;
          if (sw.alpha <= 0 || sw.radius > 80) {
            sw.active = false;
          } else {
            ctx.strokeStyle = `rgba(244, 63, 94, ${Math.max(0, sw.alpha)})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, sw.alpha * 0.7)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius * 0.6, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }

        // --- RENDER ROCKET ---
        engine.propellerAngle = (engine.propellerAngle + 0.3 * dtScale) % (2 * Math.PI);
        engine.planeHoverPhase += 0.04 * dtScale;
        const planeHoverY = Math.sin(engine.planeHoverPhase) * 3;

        ctx.save();
        let finalPlaneX = planeX;
        let finalPlaneY = planeY + planeHoverY;

        if (curState === "FLEW_AWAY") {
          const elapsed = (timestamp - engine.flewAwayTime) / 1000;
          finalPlaneX += elapsed * 550;
          finalPlaneY -= elapsed * 300;
        }

        ctx.translate(finalPlaneX, finalPlaneY);
        // Dynamic pitch angle synced with launch speed & climb vector
        const pitchAngle = curState === "FLEW_AWAY" ? -0.32 : -0.06 - (1 - progress) * 0.20;
        ctx.rotate(pitchAngle);

        // Dynamic Rocket Thruster Plumes
        const flameLen = 22 + Math.min(curMultiplier * 4.2, 58) + Math.sin(timestamp / 35) * 9;
        const flameGradCenter = ctx.createLinearGradient(-26, 0, -26 - flameLen, 0);
        flameGradCenter.addColorStop(0, "#ffffff");
        flameGradCenter.addColorStop(0.2, "#fef08a");
        flameGradCenter.addColorStop(0.5, "#f97316");
        flameGradCenter.addColorStop(0.85, "#ef4444");
        flameGradCenter.addColorStop(1, "rgba(239, 68, 68, 0)");

        ctx.fillStyle = flameGradCenter;
        ctx.beginPath();
        ctx.moveTo(-26, -5);
        ctx.lineTo(-26 - flameLen, 0);
        ctx.lineTo(-26, 5);
        ctx.closePath();
        ctx.fill();

        // Top Booster Flame
        const topBoosterFlame = flameLen * 0.75;
        const flameGradTop = ctx.createLinearGradient(-22, -9, -22 - topBoosterFlame, -9);
        flameGradTop.addColorStop(0, "#ffffff");
        flameGradTop.addColorStop(0.3, "#38bdf8");
        flameGradTop.addColorStop(0.8, "#6366f1");
        flameGradTop.addColorStop(1, "rgba(99, 102, 241, 0)");
        ctx.fillStyle = flameGradTop;
        ctx.beginPath();
        ctx.moveTo(-22, -12);
        ctx.lineTo(-22 - topBoosterFlame, -9);
        ctx.lineTo(-22, -6);
        ctx.closePath();
        ctx.fill();

        // Bottom Booster Flame
        const btmBoosterFlame = flameLen * 0.75;
        const flameGradBtm = ctx.createLinearGradient(-22, 9, -22 - btmBoosterFlame, 9);
        flameGradBtm.addColorStop(0, "#ffffff");
        flameGradBtm.addColorStop(0.3, "#38bdf8");
        flameGradBtm.addColorStop(0.8, "#6366f1");
        flameGradBtm.addColorStop(1, "rgba(99, 102, 241, 0)");
        ctx.fillStyle = flameGradBtm;
        ctx.beginPath();
        ctx.moveTo(-22, 6);
        ctx.lineTo(-22 - btmBoosterFlame, 9);
        ctx.lineTo(-22, 12);
        ctx.closePath();
        ctx.fill();

        // Rocket Body & Wings
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(-27, -6, 5, 12, [2, 0, 0, 2]);
        ctx.fill();

        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.roundRect(-23, -13, 4, 7, [2, 0, 0, 2]);
        ctx.roundRect(-23, 6, 4, 7, [2, 0, 0, 2]);
        ctx.fill();

        // Top Wing
        ctx.fillStyle = "#e11d48";
        ctx.beginPath();
        ctx.moveTo(-10, -7);
        ctx.lineTo(-26, -23);
        ctx.lineTo(-18, -23);
        ctx.lineTo(2, -7);
        ctx.closePath();
        ctx.fill();

        // Top Wing Edge Highlight
        ctx.fillStyle = "#fda4af";
        ctx.beginPath();
        ctx.moveTo(-10, -7);
        ctx.lineTo(-26, -23);
        ctx.lineTo(-24, -23);
        ctx.lineTo(-8, -7);
        ctx.closePath();
        ctx.fill();

        // Bottom Wing
        ctx.fillStyle = "#881337";
        ctx.beginPath();
        ctx.moveTo(-10, 7);
        ctx.lineTo(-24, 21);
        ctx.lineTo(-17, 21);
        ctx.lineTo(2, 7);
        ctx.closePath();
        ctx.fill();

        // Lower Fuselage
        const lowerBodyGrad = ctx.createLinearGradient(0, 0, 0, 10);
        lowerBodyGrad.addColorStop(0, "#cbd5e1");
        lowerBodyGrad.addColorStop(1, "#475569");
        ctx.fillStyle = lowerBodyGrad;
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(16, 0);
        ctx.quadraticCurveTo(28, 2, 34, 0);
        ctx.quadraticCurveTo(24, 6, 12, 8);
        ctx.lineTo(-25, 6);
        ctx.closePath();
        ctx.fill();

        // Upper Fuselage
        const upperBodyGrad = ctx.createLinearGradient(0, -9, 0, 0);
        upperBodyGrad.addColorStop(0, "#f8fafc");
        upperBodyGrad.addColorStop(0.7, "#e2e8f0");
        upperBodyGrad.addColorStop(1, "#cbd5e1");
        ctx.fillStyle = upperBodyGrad;
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(16, 0);
        ctx.quadraticCurveTo(28, -2, 34, 0);
        ctx.quadraticCurveTo(24, -6, 12, -8);
        ctx.lineTo(-25, -6);
        ctx.closePath();
        ctx.fill();

        // Nose Cone
        const noseGrad = ctx.createLinearGradient(16, 0, 34, 0);
        noseGrad.addColorStop(0, "#e11d48");
        noseGrad.addColorStop(1, "#fb7185");
        ctx.fillStyle = noseGrad;
        ctx.beginPath();
        ctx.moveTo(18, -6.5);
        ctx.quadraticCurveTo(27, 0, 34, 0);
        ctx.quadraticCurveTo(27, 0, 18, 6.5);
        ctx.closePath();
        ctx.fill();

        // Cockpit Visor
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.ellipse(3, -1, 7, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();

        const visorGrad = ctx.createLinearGradient(0, -5, 6, 3);
        visorGrad.addColorStop(0, "#38bdf8");
        visorGrad.addColorStop(1, "#0284c7");
        ctx.fillStyle = visorGrad;
        ctx.beginPath();
        ctx.ellipse(3, -1, 5.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.ellipse(1.5, -2.5, 2.5, 1, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Fore Keel
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.moveTo(-16, -0.8);
        ctx.lineTo(15, -0.8);
        ctx.lineTo(15, 0.8);
        ctx.lineTo(-16, 0.8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // --- 9. CENTRAL HUD MULTIPLIER (Zero-Lag Optical Light Radiance & Rays) ---
        const hudX = width / 2;
        const hudY = height / 2 - 20;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (curState === "FLYING") {
          const tier = getMultiplierColorTier(curMultiplier);
          const hudFontSize = Math.min(74, Math.max(38, Math.floor(width * 0.095)));

          // Dynamic scale pulse that scales with high multipliers
          let scale = 1.0;
          if (curMultiplier >= 20.0) {
            const pulse = (Math.sin((timestamp / 280) * Math.PI * 2) + 1) / 2;
            scale = 1.0 + pulse * 0.10;
          } else if (curMultiplier >= 10.0) {
            const pulse = (Math.sin((timestamp / 380) * Math.PI * 2) + 1) / 2;
            scale = 1.0 + pulse * 0.06;
          } else if (curMultiplier >= 2.0) {
            const pulse = (Math.sin((timestamp / 500) * Math.PI * 2) + 1) / 2;
            scale = 1.0 + pulse * 0.03;
          }

          ctx.save();
          ctx.translate(hudX, hudY);
          ctx.scale(scale, scale);







          // CRISP 2-LAYER MULTIPLIER TEXT
          ctx.font = `800 ${hudFontSize}px 'Rajdhani', 'Orbitron', 'Montserrat', sans-serif`;

          // Layer 1: High contrast outer stroke / border
          ctx.strokeStyle = tier.borderColor || "rgba(0, 0, 0, 0.85)";
          ctx.lineWidth = 6;
          ctx.lineJoin = "round";
          ctx.strokeText(`${curMultiplier.toFixed(2)}x`, 0, 0);

          // Layer 2: Vibrant primary tier fill
          ctx.fillStyle = tier.color;
          ctx.fillText(`${curMultiplier.toFixed(2)}x`, 0, 0);

          ctx.restore();
        } else if (curState === "FLEW_AWAY") {
          const flewAwayFontSize = Math.min(48, Math.max(26, Math.floor(width * 0.065)));
          const flewAwaySubSize = Math.min(34, Math.max(18, Math.floor(width * 0.045)));

          ctx.fillStyle = "#f43f5e";
          ctx.font = `800 ${flewAwayFontSize}px 'Rajdhani', 'Orbitron', 'Montserrat', sans-serif`;
          ctx.fillText("FLEW AWAY", hudX, hudY - 15);

          ctx.fillStyle = "#9ca3af";
          ctx.font = `700 ${flewAwaySubSize}px 'Chakra Petch', monospace`;
          ctx.fillText(`${curMultiplier.toFixed(2)}x`, hudX, hudY + 30);
        }
      }

      ctx.restore();
      animFrameId = requestAnimationFrame(renderLoop);
    };

    animFrameId = requestAnimationFrame(renderLoop);

    return () => cancelAnimationFrame(animFrameId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[220px] sm:min-h-[300px] md:min-h-[350px] bg-slate-900 overflow-hidden flex items-center justify-center rounded-xl border border-slate-800 will-change-transform"
      style={{
        contain: "layout style paint",
        transform: "translateZ(0)",
      }}
      id="aviator_canvas_container"
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full will-change-transform"
        style={{
          transform: "translateZ(0)",
        }}
        id="aviator_game_canvas"
      />
    </div>
  );
});

