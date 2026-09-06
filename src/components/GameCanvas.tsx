import React, { useEffect, useRef, useState, memo } from "react";
import { RoundState } from "../types";
import { getMultiplierColorTier } from "../utils/multiplierColor";

interface GameCanvasProps {
  multiplier: number;
  state: RoundState;
  countdown?: number;
  maxCountdown: number;
  flightStartTime?: number;
  crashMultiplier?: number;
  waitStartTime?: number;
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

function drawRocketShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pitchAngle: number,
  flameLen: number,
  isIdleMode: boolean,
  timestamp: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pitchAngle);

  // Dynamic Rocket Thruster Plumes
  if (isIdleMode) {
    const flameGradCenter = ctx.createLinearGradient(-26, 0, -26 - flameLen, 0);
    flameGradCenter.addColorStop(0, "#ffffff");
    flameGradCenter.addColorStop(0.3, "#38bdf8");
    flameGradCenter.addColorStop(0.7, "#6366f1");
    flameGradCenter.addColorStop(1, "rgba(99, 102, 241, 0)");

    ctx.fillStyle = flameGradCenter;
    ctx.beginPath();
    ctx.moveTo(-26, -4);
    ctx.lineTo(-26 - flameLen, 0);
    ctx.lineTo(-26, 4);
    ctx.closePath();
    ctx.fill();

    const boosterFlame = flameLen * 0.7;
    const flameGradTop = ctx.createLinearGradient(-22, -9, -22 - boosterFlame, -9);
    flameGradTop.addColorStop(0, "#ffffff");
    flameGradTop.addColorStop(0.4, "#38bdf8");
    flameGradTop.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = flameGradTop;
    ctx.beginPath();
    ctx.moveTo(-22, -11);
    ctx.lineTo(-22 - boosterFlame, -9);
    ctx.lineTo(-22, -7);
    ctx.closePath();
    ctx.fill();

    const flameGradBtm = ctx.createLinearGradient(-22, 9, -22 - boosterFlame, 9);
    flameGradBtm.addColorStop(0, "#ffffff");
    flameGradBtm.addColorStop(0.4, "#38bdf8");
    flameGradBtm.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = flameGradBtm;
    ctx.beginPath();
    ctx.moveTo(-22, 7);
    ctx.lineTo(-22 - boosterFlame, 9);
    ctx.lineTo(-22, 11);
    ctx.closePath();
    ctx.fill();
  } else {
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
  }

  // Rocket Body & Wings
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(-27, -6, 5, 12, [2, 0, 0, 2]);
  } else {
    ctx.rect(-27, -6, 5, 12);
  }
  ctx.fill();

  ctx.fillStyle = "#334155";
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(-23, -13, 4, 7, [2, 0, 0, 2]);
    (ctx as any).roundRect(-23, 6, 4, 7, [2, 0, 0, 2]);
  } else {
    ctx.rect(-23, -13, 4, 7);
    ctx.rect(-23, 6, 4, 7);
  }
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
}

function areGameCanvasPropsEqual(prev: GameCanvasProps, next: GameCanvasProps) {
  return (
    prev.state === next.state &&
    prev.maxCountdown === next.maxCountdown &&
    prev.flightStartTime === next.flightStartTime &&
    prev.crashMultiplier === next.crashMultiplier &&
    prev.waitStartTime === next.waitStartTime
  );
}

const GameCanvasComponent: React.FC<GameCanvasProps> = ({
  multiplier,
  state,
  countdown = 5.0,
  maxCountdown,
  flightStartTime = 0,
  crashMultiplier = 1.0,
  waitStartTime = 0,
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
  const flightStartTimeRef = useRef(flightStartTime);
  const crashMultiplierRef = useRef(crashMultiplier);
  const waitStartTimeRef = useRef(waitStartTime);
  const dimensionsRef = useRef(dimensions);

  // Sync refs instantly
  multiplierRef.current = multiplier;
  stateRef.current = state;
  countdownRef.current = countdown;
  maxCountdownRef.current = maxCountdown;
  flightStartTimeRef.current = flightStartTime;
  crashMultiplierRef.current = crashMultiplier;
  waitStartTimeRef.current = waitStartTime;
  dimensionsRef.current = dimensions;

  // Animation Engine State Container
  const engineRef = useRef({
    lastTimestamp: 0,
    gridOffset: 0,
    propellerAngle: 0,
    planeHoverPhase: 0,
    flewAwayTime: 0,
    flightStartTime: 0,
    waitStartTime: 0,
    bgGrad: null as CanvasGradient | null,
    bgGradHeight: 0,
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
      const curMaxCountdown = maxCountdownRef.current;
      const width = dimensionsRef.current.width;
      const height = dimensionsRef.current.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Track transition start times for hardware-synced smooth interpolation
      if (curState === "FLYING" && engine.prevRoundState !== "FLYING") {
        engine.flightStartTime = timestamp;
      } else if (curState === "WAITING" && engine.prevRoundState !== "WAITING") {
        engine.waitStartTime = timestamp;
      }

      if (!engine.waitStartTime && curState === "WAITING") {
        engine.waitStartTime = timestamp;
      }
      if (!engine.flightStartTime && curState === "FLYING") {
        engine.flightStartTime = timestamp;
      }

      // Smooth continuous real-time multiplier and countdown calculation
      let curMultiplier = 1.0;
      let curCountdown = curMaxCountdown;

      if (curState === "FLYING") {
        const fStart = engine.flightStartTime || timestamp;
        const elapsedFlight = Math.max(0, (timestamp - fStart) / 1000);
        const computedMult = 1.00 + 0.08 * elapsedFlight + 0.032 * Math.pow(elapsedFlight, 2.0);
        const crashLimit = (crashMultiplierRef.current && crashMultiplierRef.current > 1.0) ? crashMultiplierRef.current : 999999;
        curMultiplier = Math.min(Math.max(1.01, computedMult), crashLimit);
      } else if (curState === "FLEW_AWAY") {
        curMultiplier = (crashMultiplierRef.current && crashMultiplierRef.current > 1.0) 
          ? crashMultiplierRef.current 
          : Math.max(multiplierRef.current, 1.0);
      } else if (curState === "WAITING") {
        const wStart = engine.waitStartTime || timestamp;
        const elapsedWait = Math.max(0, (timestamp - wStart) / 1000);
        curCountdown = Math.max(0, curMaxCountdown - elapsedWait);
        curMultiplier = 1.00;
      }

      // Spawn takeoff blast particles immediately when state transitions to FLYING
      if (curState === "FLYING" && engine.prevRoundState === "WAITING") {
        const startX = 40;
        const startY = height - 40;
        for (let i = 0; i < 20; i++) {
          const p = engine.particles[i % MAX_PARTICLES];
          p.active = true;
          p.x = startX + (Math.random() - 0.5) * 8;
          p.y = startY + (Math.random() - 0.5) * 6;
          const ang = Math.PI * 0.75 + (Math.random() - 0.5) * 1.0;
          const spd = 2.0 + Math.random() * 4.5;
          p.vx = Math.cos(ang) * spd;
          p.vy = Math.sin(ang) * spd;
          p.life = 18 + Math.random() * 12;
          p.maxLife = p.life;
          p.size = 2.0 + Math.random() * 2.5;
          p.color = Math.random() < 0.6 ? "#fbbf24" : "#f43f5e";
        }
      }

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

      // Clear & Draw Space Dark Background (Cached gradient for 0 GC thrashing)
      if (!engine.bgGrad || engine.bgGradHeight !== height) {
        engine.bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        engine.bgGrad.addColorStop(0, "#020818");
        engine.bgGrad.addColorStop(1, "#0d0527");
        engine.bgGradHeight = height;
      }
      ctx.fillStyle = engine.bgGrad;
      ctx.fillRect(0, 0, width, height);

      // --- 1. INITIALIZE BACKGROUND ASSETS ONCE ---
      if (engine.stars.length === 0) {
        for (let i = 0; i < 90; i++) {
          engine.stars.push({
            xRatio: Math.random(),
            yRatio: Math.random(),
            size: 0.5 + Math.random() * 0.7,
            brightness: Math.random(),
            speed: 0.001 + Math.random() * 0.003,
            layer: "small",
          });
        }
        for (let i = 0; i < 35; i++) {
          engine.stars.push({
            xRatio: Math.random(),
            yRatio: Math.random(),
            size: 1.0 + Math.random() * 0.8,
            brightness: Math.random(),
            speed: 0.003 + Math.random() * 0.006,
            layer: "medium",
          });
        }
        for (let i = 0; i < 10; i++) {
          engine.stars.push({
            xRatio: Math.random(),
            yRatio: Math.random(),
            size: 1.8 + Math.random() * 0.8,
            brightness: Math.random(),
            speed: 0.002 + Math.random() * 0.004,
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

        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha.toFixed(2)})`;
        if (star.layer === "small") {
          ctx.fillRect(sX, sY, star.size, star.size);
        } else {
          ctx.beginPath();
          ctx.arc(sX, sY, star.size, 0, 2 * Math.PI);
          ctx.fill();
        }
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

      ctx.strokeStyle = "rgba(99, 102, 241, 0.015)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -40 + engine.gridOffset; x < width + 40; x += 40) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      const hOffset = (engine.gridOffset * 0.5) % 40;
      for (let y = -40 + hOffset; y < height + 40; y += 40) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Axes
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 0);
      ctx.lineTo(40, height - 40);
      ctx.lineTo(width, height - 40);
      ctx.stroke();

      // Tick marks (Batched paths)
      ctx.beginPath();
      for (let i = 1; i <= 5; i++) {
        const tickX = 40 + (width - 80) * (i / 5);
        ctx.moveTo(tickX, height - 40);
        ctx.lineTo(tickX, height - 35);
      }
      for (let i = 1; i <= 4; i++) {
        const tickY = height - 40 - (height - 80) * (i / 4);
        ctx.moveTo(35, tickY);
        ctx.lineTo(40, tickY);
      }
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "10px 'Chakra Petch', monospace";
      ctx.textAlign = "center";
      for (let i = 1; i <= 5; i++) {
        const tickX = 40 + (width - 80) * (i / 5);
        ctx.fillText(`${i * 2}s`, tickX, height - 20);
      }

      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 1; i <= 4; i++) {
        const tickY = height - 40 - (height - 80) * (i / 4);
        ctx.fillText(`x${(1 + i * 0.5).toFixed(1)}`, 28, tickY);
      }

      // --- 8. STATE SPECIFIC DRAWING ---
      if (curState === "WAITING") {
        const startX = 40;
        const startY = height - 40;
        const idleHover = Math.sin(timestamp / 120) * 1.5;
        const idleFlame = 12 + Math.sin(timestamp / 60) * 4;

        // Launchpad Docking Rail
        ctx.save();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(startX - 26, startY + 12);
        ctx.lineTo(startX + 22, startY + 12);
        ctx.stroke();

        // Beacon lights on launch rail
        const beaconPulse = 0.5 + 0.5 * Math.sin(timestamp / 120);
        ctx.fillStyle = `rgba(56, 189, 248, ${0.4 + beaconPulse * 0.5})`;
        ctx.beginPath();
        ctx.arc(startX - 24, startY + 12, 2.5, 0, Math.PI * 2);
        ctx.arc(startX + 20, startY + 12, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // In the final 0.4s of countdown: pre-ignition sparks
        if (curCountdown <= 0.4 && curCountdown > 0) {
          for (let i = 0; i < 2; i++) {
            const p = engine.particles[i];
            if (!p.active) {
              p.active = true;
              p.x = startX - 26;
              p.y = startY + (Math.random() - 0.5) * 4;
              p.vx = -1.5 - Math.random() * 2.5;
              p.vy = (Math.random() - 0.3) * 1.5;
              p.life = 12 + Math.random() * 8;
              p.maxLife = p.life;
              p.size = 1.5 + Math.random() * 2;
              p.color = Math.random() < 0.6 ? "#fbbf24" : "#f43f5e";
            }
          }
        }

        // Draw 3D rocket idling on launchpad (ready for takeoff at -0.20 pitch angle)
        drawRocketShip(ctx, startX, startY + idleHover, -0.20, idleFlame, true, timestamp);

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

        let finalPlaneX = planeX;
        let finalPlaneY = planeY + planeHoverY;

        if (curState === "FLEW_AWAY") {
          const elapsed = (timestamp - engine.flewAwayTime) / 1000;
          finalPlaneX += elapsed * 550;
          finalPlaneY -= elapsed * 300;
        }

        const pitchAngle = curState === "FLEW_AWAY" ? -0.32 : -0.06 - (1 - progress) * 0.20;
        const flameLen = 22 + Math.min(curMultiplier * 4.2, 58) + Math.sin(timestamp / 35) * 9;
        drawRocketShip(ctx, finalPlaneX, finalPlaneY, pitchAngle, flameLen, false, timestamp);
      }

      // --- 9. CENTRAL HUD & TELEMETRY ---
      const isWaitingState = curState === "WAITING";
      const flightElapsedSec = curState === "FLYING" ? Math.max(0, (timestamp - (engine.flightStartTime || timestamp)) / 1000) : 999;
      const waitingHudFade = isWaitingState ? 1.0 : Math.max(0, 1 - flightElapsedSec / 0.25);

      // A. Mission Control Waiting HUD Box (Centered, with smooth fadeout on takeoff)
      if (waitingHudFade > 0.01) {
        ctx.save();
        ctx.globalAlpha = waitingHudFade;

        const centerX = width / 2;
        const centerY = height / 2 - 10;
        const hudBoxWidth = Math.min(width - 48, 350);
        const hudBoxHeight = 72;
        const hudBoxX = centerX - hudBoxWidth / 2;
        const hudBoxY = centerY - hudBoxHeight / 2;
        const cornerCut = 8;

        // Chamfered cybernetic backdrop
        ctx.beginPath();
        ctx.moveTo(hudBoxX + cornerCut, hudBoxY);
        ctx.lineTo(hudBoxX + hudBoxWidth - cornerCut, hudBoxY);
        ctx.lineTo(hudBoxX + hudBoxWidth, hudBoxY + cornerCut);
        ctx.lineTo(hudBoxX + hudBoxWidth, hudBoxY + hudBoxHeight - cornerCut);
        ctx.lineTo(hudBoxX + hudBoxWidth - cornerCut, hudBoxY + hudBoxHeight);
        ctx.lineTo(hudBoxX + cornerCut, hudBoxY + hudBoxHeight);
        ctx.lineTo(hudBoxX, hudBoxY + hudBoxHeight - cornerCut);
        ctx.lineTo(hudBoxX, hudBoxY + cornerCut);
        ctx.closePath();

        const hudGrad = ctx.createLinearGradient(hudBoxX, hudBoxY, hudBoxX, hudBoxY + hudBoxHeight);
        hudGrad.addColorStop(0, "rgba(15, 23, 42, 0.90)");
        hudGrad.addColorStop(0.5, "rgba(8, 14, 26, 0.96)");
        hudGrad.addColorStop(1, "rgba(15, 23, 42, 0.90)");
        ctx.fillStyle = hudGrad;
        ctx.fill();

        // Glowing cybernetic border
        const borderPulse = 0.5 + 0.5 * Math.sin(timestamp / 240);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 + borderPulse * 0.35})`;
        ctx.stroke();

        // Corner brackets
        const bracketLen = 10;
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.75 + borderPulse * 0.25})`;

        ctx.beginPath();
        ctx.moveTo(hudBoxX, hudBoxY + bracketLen);
        ctx.lineTo(hudBoxX, hudBoxY + cornerCut);
        ctx.lineTo(hudBoxX + cornerCut, hudBoxY);
        ctx.lineTo(hudBoxX + bracketLen, hudBoxY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hudBoxX + hudBoxWidth - bracketLen, hudBoxY);
        ctx.lineTo(hudBoxX + hudBoxWidth - cornerCut, hudBoxY);
        ctx.lineTo(hudBoxX + hudBoxWidth, hudBoxY + cornerCut);
        ctx.lineTo(hudBoxX + hudBoxWidth, hudBoxY + bracketLen);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hudBoxX, hudBoxY + hudBoxHeight - bracketLen);
        ctx.lineTo(hudBoxX, hudBoxY + hudBoxHeight - cornerCut);
        ctx.lineTo(hudBoxX + cornerCut, hudBoxY + hudBoxHeight);
        ctx.lineTo(hudBoxX + bracketLen, hudBoxY + hudBoxHeight);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hudBoxX + hudBoxWidth - bracketLen, hudBoxY + hudBoxHeight);
        ctx.lineTo(hudBoxX + hudBoxWidth - cornerCut, hudBoxY + hudBoxHeight);
        ctx.lineTo(hudBoxX + hudBoxWidth, hudBoxY + hudBoxHeight - cornerCut);
        ctx.lineTo(hudBoxX + hudBoxWidth, hudBoxY + hudBoxHeight - bracketLen);
        ctx.stroke();

        // Title: WAITING FOR NEXT ROUND
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "800 15px 'Orbitron', 'Rajdhani', sans-serif";

        ctx.strokeStyle = "rgba(15, 23, 42, 0.95)";
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.strokeText("WAITING FOR NEXT ROUND", centerX, hudBoxY + 22);

        const titleGrad = ctx.createLinearGradient(0, hudBoxY + 12, 0, hudBoxY + 32);
        titleGrad.addColorStop(0, "#ffffff");
        titleGrad.addColorStop(0.5, "#e0f2fe");
        titleGrad.addColorStop(1, "#38bdf8");
        ctx.fillStyle = titleGrad;
        ctx.fillText("WAITING FOR NEXT ROUND", centerX, hudBoxY + 22);

        // Status: PLACING BETS (X.Xs)
        const countdownPercent = Math.max(0, Math.min(1, curCountdown / curMaxCountdown));
        const badgeY = hudBoxY + 46;

        const beaconPulse = 0.5 + 0.5 * Math.sin(timestamp / 120);
        const beaconX = centerX - 78;

        ctx.beginPath();
        ctx.arc(beaconX, badgeY, 3 + beaconPulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 158, 11, ${0.4 * (1 - beaconPulse)})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(beaconX, badgeY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();

        ctx.font = "700 13px 'Chakra Petch', 'Orbitron', monospace";
        ctx.fillStyle = "#fef08a";
        ctx.fillText(`PLACING BETS (${Math.max(0, curCountdown).toFixed(1)}s)`, centerX + 8, badgeY);

        // Integrated Countdown Progress Bar
        const barWidth = hudBoxWidth - 32;
        const barHeight = 3;
        const barX = centerX - barWidth / 2;
        const barY = hudBoxY + hudBoxHeight - 6;

        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(barX, barY, barWidth, barHeight, 2);
        } else {
          ctx.rect(barX, barY, barWidth, barHeight);
        }
        ctx.fill();

        const activeBarW = Math.max(0, Math.min(barWidth, barWidth * countdownPercent));
        if (activeBarW > 1) {
          const barGrad = ctx.createLinearGradient(barX, barY, barX + activeBarW, barY);
          barGrad.addColorStop(0, "#f43f5e");
          barGrad.addColorStop(0.5, "#fbbf24");
          barGrad.addColorStop(1, "#38bdf8");
          ctx.fillStyle = barGrad;
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === "function") {
            (ctx as any).roundRect(barX, barY, activeBarW, barHeight, 2);
          } else {
            ctx.rect(barX, barY, activeBarW, barHeight);
          }
          ctx.fill();
        }

        ctx.restore();
      }

      // B. Multiplier HUD
      const hudX = width / 2;
      const hudY = height / 2 - 20;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (curState === "FLYING") {
        const multAlpha = Math.min(1, flightElapsedSec / 0.18);
        const multScaleIn = Math.min(1, 0.88 + flightElapsedSec * 0.65);
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
        ctx.scale(scale * multScaleIn, scale * multScaleIn);
        ctx.globalAlpha = multAlpha;

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
          ctx.save();
          const flewAwayFontSize = Math.min(52, Math.max(28, Math.floor(width * 0.075)));
          const flewAwaySubSize = Math.min(40, Math.max(22, Math.floor(width * 0.055)));

          // 1. "FLEW AWAY" Title with bold arcade/esports typography & multi-layer glow
          ctx.font = `900 ${flewAwayFontSize}px 'Russo One', 'Orbitron', 'Syne', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const titleY = hudY - 22;

          // Outer glowing outline
          ctx.strokeStyle = "rgba(244, 63, 94, 0.4)";
          ctx.lineWidth = 14;
          ctx.lineJoin = "round";
          ctx.strokeText("FLEW AWAY", hudX, titleY);

          // High-contrast deep slate outer border for razor-sharp legibility
          ctx.strokeStyle = "rgba(10, 15, 29, 0.95)";
          ctx.lineWidth = 7;
          ctx.strokeText("FLEW AWAY", hudX, titleY);

          // Vivid metallic ruby-crimson gradient
          const titleGrad = ctx.createLinearGradient(hudX, titleY - flewAwayFontSize * 0.5, hudX, titleY + flewAwayFontSize * 0.5);
          titleGrad.addColorStop(0, "#ffe4e6"); // crystal rose white highlight
          titleGrad.addColorStop(0.25, "#fb7185"); // neon coral
          titleGrad.addColorStop(0.65, "#f43f5e"); // vibrant crash rose
          titleGrad.addColorStop(1, "#be123c"); // deep crimson base

          ctx.fillStyle = titleGrad;
          ctx.fillText("FLEW AWAY", hudX, titleY);

          // Inner subtle glossy highlight stroke
          ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
          ctx.lineWidth = 1;
          ctx.strokeText("FLEW AWAY", hudX, titleY);

          // 2. End-game Crash Multiplier with Sleek Cyber Telemetry Badge
          const multText = `${curMultiplier.toFixed(2)}x`;
          ctx.font = `900 ${flewAwaySubSize}px 'Russo One', 'Orbitron', 'Exo 2', sans-serif`;

          const textMetrics = ctx.measureText(multText);
          const badgeWidth = Math.max(textMetrics.width + 38, 126);
          const badgeHeight = flewAwaySubSize + 16;
          const badgeX = hudX - badgeWidth / 2;
          const badgeY = hudY + 14;
          const badgeRadius = 10;

          // Cyber badge container background
          ctx.save();
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === "function") {
            (ctx as any).roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeRadius);
          } else {
            ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
          }
          ctx.fillStyle = "rgba(10, 15, 29, 0.92)";
          ctx.fill();

          // Cyber badge border (illuminated ruby or gold depending on multiplier tier)
          const isHighMult = curMultiplier >= 10.0;
          const isMegaMult = curMultiplier >= 50.0;
          const borderColor = isMegaMult
            ? "rgba(234, 179, 8, 0.85)"
            : isHighMult
            ? "rgba(245, 158, 11, 0.75)"
            : "rgba(244, 63, 94, 0.55)";

          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();

          // Multiplier text rendering inside badge
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const multCenterY = badgeY + badgeHeight / 2;

          // Multiplier outer glow outline
          ctx.strokeStyle = isHighMult ? "rgba(245, 158, 11, 0.35)" : "rgba(244, 63, 94, 0.35)";
          ctx.lineWidth = 8;
          ctx.strokeText(multText, hudX, multCenterY);

          // Multiplier outer dark stroke
          ctx.strokeStyle = "rgba(0, 0, 0, 0.92)";
          ctx.lineWidth = 4;
          ctx.lineJoin = "round";
          ctx.strokeText(multText, hudX, multCenterY);

          // Multiplier vibrant gradient fill
          const multGrad = ctx.createLinearGradient(hudX, multCenterY - flewAwaySubSize * 0.5, hudX, multCenterY + flewAwaySubSize * 0.5);
          if (isMegaMult) {
            multGrad.addColorStop(0, "#ffffff");
            multGrad.addColorStop(0.3, "#fef08a");
            multGrad.addColorStop(1, "#eab308");
          } else if (isHighMult) {
            multGrad.addColorStop(0, "#ffffff");
            multGrad.addColorStop(0.3, "#fde68a");
            multGrad.addColorStop(1, "#f59e0b");
          } else {
            multGrad.addColorStop(0, "#ffffff");
            multGrad.addColorStop(0.35, "#fecdd3");
            multGrad.addColorStop(1, "#f43f5e");
          }

          ctx.fillStyle = multGrad;
          ctx.fillText(multText, hudX, multCenterY);

          ctx.restore();
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
};

export const GameCanvas = memo(GameCanvasComponent, areGameCanvasPropsEqual);

