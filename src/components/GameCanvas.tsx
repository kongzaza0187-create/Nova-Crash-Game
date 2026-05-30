import React, { useEffect, useRef, useState } from "react";
import { RoundState } from "../types";

interface GameCanvasProps {
  multiplier: number;
  state: RoundState;
  countdown: number;
  maxCountdown: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  multiplier,
  state,
  countdown,
  maxCountdown,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Store dimensions dynamically
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // References for keeping track of high-frequency animation states
  const animStateRef = useRef({
    gridOffset: 0,
    propellerAngle: 0,
    planeAnimY: 0, // ambient hovering
    particles: [] as Array<{ x: number; y: number; life: number; size: number; alpha: number; vx: number; vy: number }>,
    screencrashEffect: 0, // screen shake or flash trigger
    flewAwayTime: 0, // time elapsed since crash
    stars: [] as Array<{ xRatio: number; yRatio: number; size: number; brightness: number; speed: number; layer?: string }>,
    nebulae: [] as Array<{ xRatio: number; yRatio: number; vx: number; vy: number; radiusRatio: number; baseRadiusRatio?: number; color1: string; pulseSpeed?: number; phase?: number }>,
    speedLines: [] as Array<{ x: number; y: number; length: number; speed: number; alpha: number }>,
    shootingStars: [] as Array<{ x: number; y: number; vx: number; vy: number; length: number; alpha: number; active: boolean }>,
    lastShootingStarSpawn: 0,
  });

  // Track state change
  const prevStateRef = useRef<RoundState>(state);

  // Resize observer to make the canvas completely fluid and responsive
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Make sure it has adequate height
        const resolvedHeight = Math.max(height, 350);
        setDimensions({ width, height: resolvedHeight });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Update canvas sizing attribute
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
  }, [dimensions]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localFrameId: number;

    const render = () => {
      const anim = animStateRef.current;
      const { width, height } = dimensions;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Space Dark Background (Gradient from dark navy #020818 to deep purple #0d0527)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#020818");
      bgGrad.addColorStop(1, "#0d0527");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // --- INITIALIZE BACKGROUND ELEMENTS ONCE ---
      if (anim.stars.length === 0) {
        // Small distant stars (220 dots), slow twinkle
        for (let i = 0; i < 220; i++) {
          anim.stars.push({
            xRatio: Math.random(),
            yRatio: Math.random(),
            size: 0.3 + Math.random() * 0.5,
            brightness: Math.random(),
            speed: 0.001 + Math.random() * 0.003,
            layer: "small"
          });
        }
        // Medium stars (80 dots), medium twinkle
        for (let i = 0; i < 80; i++) {
          anim.stars.push({
            xRatio: Math.random(),
            yRatio: Math.random(),
            size: 0.8 + Math.random() * 0.7,
            brightness: Math.random(),
            speed: 0.004 + Math.random() * 0.007,
            layer: "medium"
          });
        }
        // Large near stars (20 dots) with glow
        for (let i = 0; i < 20; i++) {
          anim.stars.push({
            xRatio: Math.random(),
            yRatio: Math.random(),
            size: 1.8 + Math.random() * 1.0,
            brightness: Math.random(),
            speed: 0.002 + Math.random() * 0.005,
            layer: "large"
          });
        }
      }

      if (anim.nebulae.length === 0) {
        anim.nebulae.push(
          {
            xRatio: 0.3,
            yRatio: 0.25,
            vx: 0.012,
            vy: 0.006,
            radiusRatio: 0.45,
            baseRadiusRatio: 0.45,
            color1: "#4a0080", // purple
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
            color1: "#001a6e", // deep blue
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
            color1: "#4a0080", // purple
            pulseSpeed: 0.0008,
            phase: Math.PI / 1.5,
          }
        );
      }

      if (anim.speedLines.length === 0) {
        for (let i = 0; i < 12; i++) {
          anim.speedLines.push({
            x: Math.random() * width,
            y: Math.random() * (height - 40),
            length: 40 + Math.random() * 100,
            speed: 1.5 + Math.random() * 4,
            alpha: 0.03 + Math.random() * 0.1,
          });
        }
      }

      // --- DRAW TWINKLING STARS (3 depths) ---
      anim.stars.forEach((star) => {
        star.brightness += star.speed;
        if (star.brightness > 1 || star.brightness < 0.15) {
          star.speed = -star.speed;
        }
        const sX = star.xRatio * width;
        const sY = star.yRatio * height;
        const currentAlpha = Math.max(0.15, Math.min(1, star.brightness));

        if (star.layer === "large") {
          ctx.save();
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
          ctx.shadowColor = "rgba(255, 255, 255, 0.75)";
          ctx.shadowBlur = 5;
          ctx.beginPath();
          ctx.arc(sX, sY, star.size, 0, 2 * Math.PI);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(sX, sY, star.size, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      // --- DRAW MOVING CLOUDS / NEBULA (PULSE & PARALLAX) ---
      anim.nebulae.forEach((n) => {
        n.xRatio += n.vx / 60;
        n.yRatio += n.vy / 60;
        if (n.xRatio < -0.3) n.xRatio = 1.3;
        if (n.xRatio > 1.3) n.xRatio = -0.3;
        if (n.yRatio < -0.3) n.yRatio = 1.3;
        if (n.yRatio > 1.3) n.yRatio = -0.3;

        n.phase = (n.phase || 0) + (n.pulseSpeed || 0.001);
        const currentRadiusRatio = (n.baseRadiusRatio || n.radiusRatio) * (1 + Math.sin(n.phase) * 0.12);

        const nebX = n.xRatio * width;
        const nebY = n.yRatio * height;
        const nebRadius = currentRadiusRatio * Math.min(width, height);

        if (nebRadius > 0) {
          const cloudGrad = ctx.createRadialGradient(nebX, nebY, 0, nebX, nebY, nebRadius);
          const opacity = 0.15 + (Math.sin(n.phase) + 1) * 0.05; // range 0.15 - 0.25 opacity
          
          cloudGrad.addColorStop(0, n.color1 === "#4a0080" ? `rgba(74, 0, 128, ${opacity})` : `rgba(0, 26, 110, ${opacity})`);
          cloudGrad.addColorStop(0.5, n.color1 === "#4a0080" ? `rgba(74, 0, 128, ${opacity * 0.4})` : `rgba(0, 26, 110, ${opacity * 0.4})`);
          cloudGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.fillStyle = cloudGrad;
          ctx.beginPath();
          ctx.arc(nebX, nebY, nebRadius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.restore();
        }
      });

      // --- RANDOM SHOOTING STAR STREAKS EVERY 4-8 SECONDS ---
      const nowMs = Date.now();
      if (!anim.shootingStars) {
        anim.shootingStars = [];
        anim.lastShootingStarSpawn = nowMs - 2000;
      }
      if (anim.shootingStars.length === 0 && nowMs - anim.lastShootingStarSpawn > 4000 + Math.random() * 4000) {
        anim.shootingStars.push({
          x: (0.4 + Math.random() * 0.5) * width,
          y: Math.random() * 0.25 * height,
          vx: -7 - Math.random() * 7,
          vy: 3.5 + Math.random() * 3.5,
          length: 50 + Math.random() * 60,
          alpha: 1.0,
          active: true,
        });
        anim.lastShootingStarSpawn = nowMs;
      }
      anim.shootingStars = anim.shootingStars.filter(ss => ss.active);
      anim.shootingStars.forEach(ss => {
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.alpha -= 0.022;
        if (ss.alpha <= 0 || ss.x < -100 || ss.y > height + 100) {
          ss.active = false;
        } else {
          const trailGrad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * 2.5, ss.y - ss.vy * 2.5);
          trailGrad.addColorStop(0, `rgba(255, 255, 255, ${ss.alpha})`);
          trailGrad.addColorStop(0.3, `rgba(219, 39, 119, ${ss.alpha * 0.5})`); // vibrant pink trail tint
          trailGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

          ctx.save();
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(ss.x, ss.y);
          ctx.lineTo(ss.x - ss.vx * 1.1, ss.y - ss.vy * 1.1);
          ctx.stroke();
          ctx.restore();
        }
      });

      // --- DISTANT HELICAL GALAXY (faint spiral in top right corner) ---
      const galX = width * 0.82;
      const galY = height * 0.18;
      ctx.save();
      ctx.translate(galX, galY);
      ctx.rotate(-0.35); // galaxy tilt

      const galGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
      galGrad.addColorStop(0, "rgba(255, 230, 255, 0.13)");
      galGrad.addColorStop(0.3, "rgba(139, 92, 246, 0.08)");
      galGrad.addColorStop(0.7, "rgba(79, 70, 229, 0.03)");
      galGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = galGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 14, 0, 0, 2 * Math.PI);
      ctx.fill();

      // Galaxy Core
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.2)");
      coreGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 3, 0, 0, 2 * Math.PI);
      ctx.fill();

      // Faint spiral points
      ctx.fillStyle = "rgba(196, 181, 253, 0.1)";
      for (let theta = 0; theta < 2 * Math.PI * 1.6; theta += 0.25) {
        const r1 = 6 + theta * 7.5;
        const arm1X = r1 * Math.cos(theta);
        const arm1Y = r1 * Math.sin(theta) * 0.35;
        ctx.beginPath();
        ctx.arc(arm1X, arm1Y, 0.7, 0, 2 * Math.PI);
        ctx.fill();

        const arm2X = r1 * Math.cos(theta + Math.PI);
        const arm2Y = r1 * Math.sin(theta + Math.PI) * 0.35;
        ctx.beginPath();
        ctx.arc(arm2X, arm2Y, 0.7, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();

      // --- DRAW DYNAMIC SPEED LINES ---
      // Speed multiplier factor: increases as game multiplier speeds up
      let speedFactor = 1;
      if (state === "FLYING") {
        speedFactor = Math.min(1 + multiplier * 2.2, 28);
      } else if (state === "FLEW_AWAY") {
        speedFactor = 18;
      }

      anim.speedLines.forEach((line) => {
        line.x -= line.speed * speedFactor;
        // If line scrolls entirely off screen, loop back to right
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
      });

      // --- SCROLLING GRID ---
      // Speed of scroll depends on multiplier or status
      let scrollSpeed = 0.5;
      if (state === "FLYING") {
        scrollSpeed = Math.min(2 + multiplier * 1.5, 12);
      } else if (state === "FLEW_AWAY") {
        scrollSpeed = 5;
      }
      anim.gridOffset = (anim.gridOffset + scrollSpeed) % 40;

      // Make grid lines more subtle (lower opacity, indigo/blue tint)
      ctx.strokeStyle = "rgba(99, 102, 241, 0.012)";
      ctx.lineWidth = 1;

      // Draw Grid Lines (Vertical)
      for (let x = -40 + anim.gridOffset; x < width + 40; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw Grid Lines (Horizontal)
      const hOffset = (anim.gridOffset * 0.5) % 40;
      for (let y = -40 + hOffset; y < height + 40; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Side/Bottom Borders representing scale axes
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 0);
      ctx.lineTo(40, height - 40);
      ctx.lineTo(width, height - 40);
      ctx.stroke();

      // Tick marks on Axes
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      // X-Ticks
      for (let i = 1; i <= 5; i++) {
        const tickX = 40 + (width - 80) * (i / 5);
        ctx.beginPath();
        ctx.moveTo(tickX, height - 40);
        ctx.lineTo(tickX, height - 35);
        ctx.stroke();
        ctx.fillText(`${i * 2}s`, tickX, height - 20);
      }
      // Y-Ticks
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

      // 2. State specific drawings
      if (state === "WAITING") {
        // --- DRAW LOADING INDICATOR PRE-GAME ---
        const percent = countdown / maxCountdown;
        const centerX = width / 2;
        const centerY = height / 2 - 20;

        // Glowing outer arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, 55, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.beginPath();
        // Counter-clockwise loader
        ctx.arc(centerX, centerY, 55, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * percent, false);
        ctx.strokeStyle = "#e91e63"; // Deep pink glowing red
        ctx.shadowColor = "#e91e63";
        ctx.shadowBlur = 15;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset glow

        // Airplane inside waiting loader facing up
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.fillStyle = "#ffffff";
        // Draw simple stylized mini-plane in center
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(4, -8);
        ctx.lineTo(18, -4);
        ctx.lineTo(18, 0);
        ctx.lineTo(4, -2);
        ctx.lineTo(2, 10);
        ctx.lineTo(8, 14);
        ctx.lineTo(8, 16);
        ctx.lineTo(0, 14);
        ctx.lineTo(-8, 16);
        ctx.lineTo(-8, 14);
        ctx.lineTo(-2, 10);
        ctx.lineTo(-4, -2);
        ctx.lineTo(-18, 0);
        ctx.lineTo(-18, -4);
        ctx.lineTo(-4, -8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Display Status Text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("WAITING FOR NEXT ROUND", centerX, centerY + 90);

        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "bold 13px 'Orbitron', sans-serif";
        ctx.fillText(`PLACING BETS (${countdown.toFixed(1)}s)`, centerX, centerY + 115);

      } else if (state === "FLYING" || state === "FLEW_AWAY") {
        // --- DRAW REBELS FLIGHT CURVE ---
        // Calculate curve ending coordinates based on progressive multiplier/progress
        // We simulate quadratic Bezier curve
        // Start curve at: 40, height - 40
        const startX = 40;
        const startY = height - 40;

        // Plane coordinates scale with multiplier
        // Max range of graph: 1.00x to 3.00x over 15 seconds
        // x-axis represents progress (0 to 1)
        const progress = Math.min((multiplier - 1) / 4, 0.85); // caps out around 85% of graph width
        const planeX = startX + (width -startX - 80) * progress;
        // quadratic upward rise
        const rise = Math.pow(progress, 1.4);
        const planeY = startY - (height - 80) * rise;

        // Control point represents a nice bending curve
        const cpX = startX + (planeX - startX) * 0.65;
        const cpY = startY; // pulls down curve to keep it flat initially then steep

        // Gradient filled area under the curve
        const curveGrad = ctx.createLinearGradient(0, startY, 0, planeY);
        curveGrad.addColorStop(0, "rgba(233, 30, 99, 0.0)");
        curveGrad.addColorStop(1, "rgba(233, 30, 99, 0.28)");

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, planeX, planeY);
        ctx.lineTo(planeX, startY);
        ctx.closePath();
        ctx.fillStyle = curveGrad;
        ctx.fill();

        // The bold glowing trace line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, planeX, planeY);
        ctx.strokeStyle = "#e11d48"; // vibrant rise red
        ctx.lineWidth = 4;
        ctx.shadowColor = "#e11d48";
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset glow

        // Generate engine trail particles on flight
        if (state === "FLYING" && Math.random() < 0.4) {
          anim.particles.push({
            x: planeX - 10,
            y: planeY + 5,
            vx: -2 - Math.random() * 2,
            vy: 1 - Math.random() * 2 + (Math.random() - 0.5) * 2,
            size: 2 + Math.random() * 3,
            life: 30 + Math.random() * 30,
            alpha: 1,
          });
        }

        // --- DRAW PARTICLES ---
        anim.particles = anim.particles.filter((p) => p.life > 0);
        anim.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          p.alpha = p.life / 60;
          ctx.fillStyle = `rgba(225, 29, 72, ${p.alpha})`; // particle matching plane color
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
          ctx.fill();
        });

        // --- ANIMATE & RENDER THE RED PLANE ---
        anim.propellerAngle = (anim.propellerAngle + 0.3) % (2 * Math.PI);
        anim.planeHoverY = Math.sin(Date.now() / 150) * 4; // subtle floating oscillation

        ctx.save();
        
        let finalPlaneX = planeX;
        let finalPlaneY = planeY + anim.planeHoverY;

        if (state === "FLEW_AWAY") {
          // Accelerate off-screen on cash out bust
          if (anim.flewAwayTime === 0) anim.flewAwayTime = Date.now();
          const elapsed = (Date.now() - anim.flewAwayTime) / 1000;
          finalPlaneX += elapsed * 500; // accelerates extremely fast
          finalPlaneY -= elapsed * 280; // climbs into the sky
        }

        ctx.translate(finalPlaneX, finalPlaneY);
        // Tilt slightly upwards
        ctx.rotate(-0.1); 

        // --- 1. ENGINE GLOW / FLICKERING JET OUTLET FLAME ---
        const flameLen = 14 + Math.random() * 12;
        const flameGrad = ctx.createLinearGradient(-22, 0, -22 - flameLen, 0);
        flameGrad.addColorStop(0, "rgba(253, 224, 71, 1)"); // Yellow
        flameGrad.addColorStop(0.3, "rgba(249, 115, 22, 0.95)"); // Orange
        flameGrad.addColorStop(1, "rgba(239, 68, 68, 0)"); // Red fade
        
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-22, -3.5);
        ctx.lineTo(-22 - flameLen, 0);
        ctx.lineTo(-22, 3.5);
        ctx.closePath();
        ctx.fill();

        // Inner hot core of fire
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(-22, -1.8);
        ctx.lineTo(-22 - (flameLen * 0.45), 0);
        ctx.lineTo(-22, 1.8);
        ctx.closePath();
        ctx.fill();

        // --- 2. MAIN JET FUSELAGE WITH NEON GLOW ---
        ctx.save();
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 12;

        ctx.fillStyle = "#e11d48"; // vibrant rise red
        ctx.beginPath();
        ctx.moveTo(-22, -4); // exhaust top
        ctx.quadraticCurveTo(-10, -7, 0, -7); // low profile mid body
        ctx.lineTo(15, -3.2); // sleek windshield approach
        ctx.quadraticCurveTo(24, -1.5, 28, 0); // sharp pointed nose tip
        ctx.quadraticCurveTo(24, 1.5, 15, 3.2);
        ctx.quadraticCurveTo(0, 5, -22, 4); // aircraft body bottom
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // --- 3. VERTICAL TAIL STABILIZER FIN ---
        ctx.fillStyle = "#9f1239"; // darker maroon crimson
        ctx.beginPath();
        ctx.moveTo(-14, -6);
        ctx.lineTo(-25, -21); // back-angled high tip
        ctx.lineTo(-20, -21);
        ctx.lineTo(-6, -6);
        ctx.closePath();
        ctx.fill();

        // Tail fin leading edge highlight
        ctx.fillStyle = "#fda4af"; // light rose highlight
        ctx.beginPath();
        ctx.moveTo(-14, -6);
        ctx.lineTo(-25, -21);
        ctx.lineTo(-23, -21);
        ctx.lineTo(-12, -6);
        ctx.closePath();
        ctx.fill();

        // --- 4. COCKPIT CANOPY GLASS ---
        ctx.fillStyle = "#38bdf8"; // cyan canopy
        ctx.beginPath();
        ctx.moveTo(3, -6.5);
        ctx.quadraticCurveTo(10, -8.5, 14, -3.2);
        ctx.lineTo(5, -3.2);
        ctx.closePath();
        ctx.fill();

        // High gloss gleam line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(5, -5.8);
        ctx.lineTo(9, -6.8);
        ctx.stroke();

        // --- 5. MILITARY SWEPT WINGS ---
        // Underside / shadow wing (bottom-side perspective)
        ctx.fillStyle = "#881337"; // deep navy shadow maroon
        ctx.beginPath();
        ctx.moveTo(-2, 3);
        ctx.lineTo(-14, 18); // bottom swept wing tip
        ctx.lineTo(-8, 18);
        ctx.lineTo(8, 3);
        ctx.closePath();
        ctx.fill();

        // Main top swept wing
        ctx.save();
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#f43f5e"; // bright neon pinkish red
        ctx.beginPath();
        ctx.moveTo(3, -4);
        ctx.lineTo(-11, -26); // top wings tip
        ctx.lineTo(-5, -26);
        ctx.lineTo(13, -4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Wing details panel line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(-8, -24);
        ctx.stroke();

        ctx.restore();

        // 3. Central HUD Multiplier text
        const hudX = width / 2;
        const hudY = height / 2 - 20;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (state === "FLYING") {
          let multiplierColor = "#ffffff";
          let scale = 1.0;
          let glowColor = "rgba(0,0,0,0.8)";
          let glowBlur = 8;

          if (multiplier >= 1.0 && multiplier < 2.0) {
            multiplierColor = "#32CD32";
          } else if (multiplier >= 2.0 && multiplier < 3.0) {
            multiplierColor = "#00CED1";
          } else if (multiplier >= 3.0 && multiplier < 4.0) {
            multiplierColor = "#FFD700";
          } else if (multiplier >= 4.0 && multiplier < 6.0) {
            multiplierColor = "#FFA500";
          } else if (multiplier >= 6.0 && multiplier < 7.0) {
            multiplierColor = "#FF4500";
          } else if (multiplier >= 7.0 && multiplier < 8.0) {
            multiplierColor = "#FF0000";
          } else if (multiplier >= 8.0 && multiplier < 9.0) {
            multiplierColor = "#FF00FF";
          } else if (multiplier >= 9.0 && multiplier < 10.0) {
            multiplierColor = "#8A2BE2";
          } else if (multiplier >= 10.0) {
            multiplierColor = "#FFFFFF";
            const pulse = (Math.sin((Date.now() / 500) * Math.PI * 2) + 1) / 2;
            scale = 1.0 + pulse * 0.05;
            glowColor = "#FFFFFF";
            glowBlur = 15;
          }

          ctx.save();
          ctx.translate(hudX, hudY);
          ctx.scale(scale, scale);

          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = multiplierColor;
          ctx.font = "bold 64px 'Orbitron', sans-serif";
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = glowBlur;
          ctx.fillText(`${multiplier.toFixed(2)}x`, 0, 0);
          ctx.restore();
        } else if (state === "FLEW_AWAY") {
          // Large RED Flew Away status
          ctx.fillStyle = "#f43f5e";
          ctx.font = "bold 46px 'Orbitron', sans-serif";
          ctx.shadowColor = "rgba(0,0,0,1)";
          ctx.shadowBlur = 10;
          ctx.fillText("FLEW AWAY", hudX, hudY - 15);

          ctx.fillStyle = "#9ca3af"; // silver gray
          ctx.font = "bold 32px 'Orbitron', monospace";
          ctx.fillText(`${multiplier.toFixed(2)}x`, hudX, hudY + 30);
          ctx.shadowBlur = 0; // reset
        }
      }

      localFrameId = requestAnimationFrame(render);
    };

    localFrameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(localFrameId);
  }, [multiplier, state, countdown, dimensions]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[350px] bg-slate-900 overflow-hidden flex items-center justify-center rounded-xl border border-slate-800"
      id="aviator_canvas_container"
    >
      <canvas ref={canvasRef} className="block w-full h-full" id="aviator_game_canvas" />
    </div>
  );
};
