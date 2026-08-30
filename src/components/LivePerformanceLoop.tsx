import React, { useState, useMemo, useRef, useCallback, memo } from "react";
import { TrendingUp, TrendingDown, Activity, Flame, Target } from "lucide-react";
import type { UserStats } from "../types";

export interface PerformanceRoundPoint {
  roundId: string;
  roundIndex: number;
  betAmount: number;
  outcome: "WIN" | "LOSS";
  multiplier?: number;
  cashoutWin?: number;
  cashback?: number;
  roundNet: number;
  cumulativePnL: number;
  timestamp: string;
}

interface LivePerformanceLoopProps {
  userStats: UserStats;
  myHistory: Array<{
    id: string;
    amount: number;
    multiplier?: number;
    winAmount?: number;
    timestamp?: string;
    cashbackAmount?: number;
  }>;
}

/**
 * Fritsch-Carlson Monotone Cubic Spline Interpolation for silky smooth, overshoot-free curves
 */
function getMonotoneCubicSplinePath(points: Array<{ svgX: number; svgY: number }>): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].svgX.toFixed(1)} ${points[0].svgY.toFixed(1)}`;
  if (n === 2) {
    const p0 = points[0];
    const p1 = points[1];
    const midX = (p0.svgX + p1.svgX) / 2;
    return `M ${p0.svgX.toFixed(1)} ${p0.svgY.toFixed(1)} C ${midX.toFixed(1)} ${p0.svgY.toFixed(1)}, ${midX.toFixed(1)} ${p1.svgY.toFixed(1)}, ${p1.svgX.toFixed(1)} ${p1.svgY.toFixed(1)}`;
  }

  // Slopes
  const dxs: number[] = [];
  const dys: number[] = [];
  const ms: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].svgX - points[i].svgX;
    const dy = points[i + 1].svgY - points[i].svgY;
    dxs.push(dx);
    dys.push(dy);
    ms.push(dx === 0 ? 0 : dy / dx);
  }

  // Tangents
  const tangents: number[] = [ms[0]];
  for (let i = 1; i < n - 1; i++) {
    const m0 = ms[i - 1];
    const m1 = ms[i];
    if (m0 * m1 <= 0) {
      tangents.push(0);
    } else {
      const dx0 = dxs[i - 1];
      const dx1 = dxs[i];
      const common = dx0 + dx1;
      tangents.push((3 * common) / ((common + dx1) / m0 + (common + dx0) / m1));
    }
  }
  tangents.push(ms[n - 2]);

  // Cubic Bézier string
  let path = `M ${points[0].svgX.toFixed(1)} ${points[0].svgY.toFixed(1)}`;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = dxs[i];
    const cp1x = p0.svgX + dx / 3;
    const cp1y = p0.svgY + (tangents[i] * dx) / 3;
    const cp2x = p1.svgX - dx / 3;
    const cp2y = p1.svgY - (tangents[i + 1] * dx) / 3;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.svgX.toFixed(1)} ${p1.svgY.toFixed(1)}`;
  }

  return path;
}

export const LivePerformanceLoop: React.FC<LivePerformanceLoopProps> = memo(({
  userStats,
  myHistory,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<PerformanceRoundPoint | null>(null);
  const [viewFilter, setViewFilter] = useState<"ALL" | "LAST20" | "LAST10">("ALL");
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Performance points calculation
  const performancePoints: PerformanceRoundPoint[] = useMemo(() => {
    let chronological = [...myHistory].reverse();

    if (viewFilter === "LAST10") {
      chronological = chronological.slice(-10);
    } else if (viewFilter === "LAST20") {
      chronological = chronological.slice(-20);
    }

    if (chronological.length === 0) {
      return [
        {
          roundId: "start_0",
          roundIndex: 0,
          betAmount: 0,
          outcome: "WIN",
          multiplier: 1.0,
          roundNet: 0,
          cumulativePnL: 0,
          timestamp: "Start",
        },
      ];
    }

    let runningPnL = 0;
    const points: PerformanceRoundPoint[] = [
      {
        roundId: "start_0",
        roundIndex: 0,
        betAmount: 0,
        outcome: "WIN",
        multiplier: 1.0,
        roundNet: 0,
        cumulativePnL: 0,
        timestamp: "Start",
      },
    ];

    chronological.forEach((item, idx) => {
      const isWin = typeof item.winAmount === "number" && item.winAmount > 0;
      let roundNet = 0;
      if (isWin) {
        roundNet = (item.winAmount || 0) - item.amount;
      } else {
        const cb = item.cashbackAmount || item.amount * 0.10;
        roundNet = -(item.amount - cb);
      }

      runningPnL += roundNet;

      points.push({
        roundId: item.id,
        roundIndex: idx + 1,
        betAmount: item.amount,
        outcome: isWin ? "WIN" : "LOSS",
        multiplier: item.multiplier,
        cashoutWin: item.winAmount,
        cashback: item.cashbackAmount,
        roundNet: parseFloat(roundNet.toFixed(2)),
        cumulativePnL: parseFloat(runningPnL.toFixed(2)),
        timestamp: item.timestamp || "Now",
      });
    });

    return points;
  }, [myHistory, viewFilter]);

  // Performance metrics
  const metrics = useMemo(() => {
    const totalBets = myHistory.length;
    const wins = myHistory.filter((h) => (h.winAmount || 0) > 0).length;
    const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

    let peakMult = 0;
    myHistory.forEach((h) => {
      if (h.multiplier && h.multiplier > peakMult) {
        peakMult = h.multiplier;
      }
    });

    let streakCount = 0;
    let streakType: "WIN" | "LOSS" | "NONE" = "NONE";
    for (let i = 0; i < myHistory.length; i++) {
      const isWin = (myHistory[i].winAmount || 0) > 0;
      const type = isWin ? "WIN" : "LOSS";
      if (i === 0) {
        streakType = type;
        streakCount = 1;
      } else if (streakType === type) {
        streakCount++;
      } else {
        break;
      }
    }

    const currentTotalPnL =
      performancePoints.length > 0
        ? performancePoints[performancePoints.length - 1].cumulativePnL
        : 0;

    return {
      winRate,
      peakMult,
      streakCount,
      streakType,
      currentTotalPnL,
      totalBets,
    };
  }, [myHistory, performancePoints]);

  // Standardized dimensions
  const svgWidth = 840;
  const svgHeight = 210;
  const paddingX = 45;
  const paddingY = 28;

  const chartPoints = useMemo(() => {
    if (performancePoints.length === 0) return [];

    let minVal = Math.min(0, ...performancePoints.map((p) => p.cumulativePnL));
    let maxVal = Math.max(50, ...performancePoints.map((p) => p.cumulativePnL));

    const range = Math.max(40, maxVal - minVal);
    const yMin = minVal - range * 0.18;
    const yMax = maxVal + range * 0.18;
    const yRange = yMax - yMin;

    const usableWidth = svgWidth - paddingX * 2;
    const usableHeight = svgHeight - paddingY * 2;
    const numPoints = performancePoints.length;

    return performancePoints.map((p, idx) => {
      const x =
        numPoints === 1
          ? svgWidth / 2
          : paddingX + (idx / (numPoints - 1)) * usableWidth;

      const normalizedY = (p.cumulativePnL - yMin) / yRange;
      const y = svgHeight - paddingY - normalizedY * usableHeight;

      return {
        ...p,
        svgX: x,
        svgY: y,
      };
    });
  }, [performancePoints, svgWidth, svgHeight, paddingX, paddingY]);

  // Zero-line Y coordinate
  const zeroLineY = useMemo(() => {
    let minVal = Math.min(0, ...performancePoints.map((p) => p.cumulativePnL));
    let maxVal = Math.max(50, ...performancePoints.map((p) => p.cumulativePnL));
    const range = Math.max(40, maxVal - minVal);
    const yMin = minVal - range * 0.18;
    const yMax = maxVal + range * 0.18;
    const yRange = yMax - yMin;
    const usableHeight = svgHeight - paddingY * 2;
    const normalizedZero = (0 - yMin) / yRange;
    return svgHeight - paddingY - normalizedZero * usableHeight;
  }, [performancePoints, svgHeight, paddingY]);

  // Generate paths
  const { linePath, areaPath } = useMemo(() => {
    if (chartPoints.length < 2) {
      const singleY = chartPoints[0]?.svgY || svgHeight / 2;
      return {
        linePath: `M ${paddingX} ${singleY} L ${svgWidth - paddingX} ${singleY}`,
        areaPath: `M ${paddingX} ${singleY} L ${svgWidth - paddingX} ${singleY} L ${svgWidth - paddingX} ${svgHeight - paddingY} L ${paddingX} ${svgHeight - paddingY} Z`,
      };
    }

    const d = getMonotoneCubicSplinePath(chartPoints);
    const firstPt = chartPoints[0];
    const lastPt = chartPoints[chartPoints.length - 1];
    const area = `${d} L ${lastPt.svgX.toFixed(1)} ${svgHeight - paddingY} L ${firstPt.svgX.toFixed(1)} ${svgHeight - paddingY} Z`;

    return { linePath: d, areaPath: area };
  }, [chartPoints, svgWidth, svgHeight, paddingX, paddingY]);

  // High-performance hover calculation
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || chartPoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relativeX = (clientX / rect.width) * svgWidth;

    let nearest = chartPoints[0];
    let minDistance = Math.abs(chartPoints[0].svgX - relativeX);

    for (let i = 1; i < chartPoints.length; i++) {
      const dist = Math.abs(chartPoints[i].svgX - relativeX);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = chartPoints[i];
      }
    }

    if (minDistance < 65) {
      setHoveredPoint(nearest);
    } else {
      setHoveredPoint(null);
    }
  }, [chartPoints, svgWidth]);

  const isNetPositive = metrics.currentTotalPnL >= 0;

  return (
    <div
      className="w-full bg-[#281117]/95 rounded-2xl border border-[#52252e] p-3 sm:p-4 mt-2 sm:mt-3 shadow-2xl shadow-[#18080c]/50 relative overflow-hidden transition-all duration-300"
      id="live_performance_loop_card"
      style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
    >
      {/* Background Volumetric Aura (GPU accelerated) */}
      <div 
        className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-bl from-rose-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-16"
        style={{ transform: "translate3d(0,0,0)" }}
      />
      <div 
        className="absolute bottom-0 left-0 w-80 h-36 bg-gradient-to-tr from-cyan-600/10 via-rose-600/5 to-transparent rounded-full blur-2xl pointer-events-none -ml-16 -mb-10"
        style={{ transform: "translate3d(0,0,0)" }}
      />

      {/* Top Header Bar & Real-Time Performance Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 z-10 relative">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-3 w-3 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black font-display tracking-widest bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent uppercase">
                PERFORMANCE LOOP
              </span>
              <span className="text-[9px] bg-emerald-950/90 text-emerald-400 font-mono font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-500/40 shadow-sm shadow-emerald-950">
                LIVE SPLINE
              </span>
            </div>
          </div>
        </div>

        {/* View Filter Switchers & Quick Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick HUD Chips without THB / ฿ symbols */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1C0A0F] border border-[#481E26] text-slate-300">
              <Target size={11} className="text-cyan-400" />
              <span>Win: <strong className="text-white">{metrics.winRate.toFixed(1)}%</strong></span>
            </div>

            {metrics.streakCount > 1 && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${
                metrics.streakType === "WIN"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}>
                <Flame size={11} className={metrics.streakType === "WIN" ? "text-amber-400" : "text-rose-400"} />
                <span>{metrics.streakCount} {metrics.streakType === "WIN" ? "Streak" : "Losses"}</span>
              </div>
            )}

            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-black ${
              isNetPositive
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                : "bg-rose-950/60 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]"
            }`}>
              {isNetPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{isNetPositive ? "+" : ""}{metrics.currentTotalPnL.toFixed(2)}</span>
            </div>
          </div>

          {/* Timeframe Scope Selector */}
          <div className="flex items-center bg-[#1C0A0F] p-0.5 rounded-lg border border-[#481E26] text-[9.5px] font-mono">
            {(["ALL", "LAST20", "LAST10"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewFilter(mode)}
                className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                  viewFilter === mode
                    ? "bg-emerald-500 text-slate-950 shadow-sm font-black"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode === "ALL" ? "All" : mode === "LAST20" ? "20R" : "10R"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Responsive SVG Performance Spline Canvas */}
      <div 
        className="relative w-full bg-[#16070B] rounded-xl border border-[#52252e]/70 p-1.5 sm:p-2 overflow-hidden shadow-inner"
        id="performance_spline_container"
        style={{ transform: "translateZ(0)", willChange: "contents" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-40 sm:h-48 md:h-52 select-none overflow-visible cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
          shapeRendering="geometricPrecision"
        >
          <defs>
            {/* Smooth Volumetric Shaded Fill Gradient */}
            <linearGradient id="performanceSmoothArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="35%" stopColor="#06b6d4" stopOpacity="0.18" />
              <stop offset="75%" stopColor="#047857" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
            </linearGradient>

            {/* High-Tech Dynamic Line Gradient (Emerald to Electric Cyan) */}
            <linearGradient id="performanceLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="45%" stopColor="#34d399" />
              <stop offset="80%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>

            {/* Lightweight Glow Layer */}
            <linearGradient id="glowStrokeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
            </linearGradient>

            {/* Futuristic Micro-Grid Pattern */}
            <pattern id="chartTechGrid" width="42" height="24" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 24" fill="none" stroke="rgba(52, 211, 153, 0.04)" strokeWidth="0.8" />
              <circle cx="0" cy="0" r="0.8" fill="rgba(52, 211, 153, 0.12)" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect width={svgWidth} height={svgHeight} fill="url(#chartTechGrid)" />

          {/* Zero PnL Baseline without Currency Symbol */}
          <line
            x1={paddingX - 15}
            y1={zeroLineY}
            x2={svgWidth - paddingX + 15}
            y2={zeroLineY}
            stroke="rgba(148, 163, 184, 0.22)"
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />
          <text
            x={paddingX - 14}
            y={zeroLineY + 3.5}
            fill="rgba(148, 163, 184, 0.65)"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="end"
          >
            0
          </text>

          {/* Area Fill Under the Spline */}
          <path d={areaPath} fill="url(#performanceSmoothArea)" />

          {/* Volumetric Underglow Stroke (Native stroke opacity without heavy SVG filter overhead for 60fps smoothness) */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#glowStrokeGrad)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Sharp High-Precision Core Vector Stroke */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#performanceLineGrad)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Hover Crosshair Guideline */}
          {hoveredPoint && (
            <g>
              <line
                x1={(hoveredPoint as any).svgX}
                y1={paddingY - 8}
                x2={(hoveredPoint as any).svgX}
                y2={svgHeight - paddingY + 8}
                stroke="rgba(56, 189, 248, 0.5)"
                strokeDasharray="2 2"
                strokeWidth="1.2"
              />
              <line
                x1={paddingX}
                y1={(hoveredPoint as any).svgY}
                x2={svgWidth - paddingX}
                y2={(hoveredPoint as any).svgY}
                stroke="rgba(56, 189, 248, 0.3)"
                strokeDasharray="2 2"
                strokeWidth="0.8"
              />
            </g>
          )}

          {/* Data Point Nodes along the Spline */}
          {chartPoints.map((pt, idx) => {
            const isHovered = hoveredPoint?.roundId === pt.roundId;
            const isWin = pt.outcome === "WIN";
            const isFirst = idx === 0;
            const isLatest = idx === chartPoints.length - 1 && chartPoints.length > 1;

            return (
              <g
                key={pt.roundId ? `${pt.roundId}_${idx}` : `pt_${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(pt)}
                onClick={() => setHoveredPoint(isHovered ? null : pt)}
              >
                {/* Active Hover Halo or Latest Node Pulse Radar */}
                {isHovered ? (
                  <circle
                    cx={pt.svgX}
                    cy={pt.svgY}
                    r={10}
                    fill={isWin ? "#10b981" : "#f43f5e"}
                    opacity="0.35"
                  />
                ) : isLatest ? (
                  <circle
                    cx={pt.svgX}
                    cy={pt.svgY}
                    r={8}
                    fill="#38bdf8"
                    opacity="0.35"
                  />
                ) : null}

                {/* Node Center Core */}
                <circle
                  cx={pt.svgX}
                  cy={pt.svgY}
                  r={isHovered ? 5.5 : isLatest ? 4.8 : isFirst ? 3.5 : 3.8}
                  fill={
                    isFirst
                      ? "#94a3b8"
                      : isLatest
                      ? "#38bdf8"
                      : isWin
                      ? "#34d399"
                      : "#f43f5e"
                  }
                  stroke="#070b18"
                  strokeWidth="1.8"
                />

                {/* Terminal Active Label at the Latest Point (No currency symbol) */}
                {isLatest && !hoveredPoint && (
                  <g transform={`translate(${pt.svgX}, ${pt.svgY - 14})`}>
                    <rect
                      x="-24"
                      y="-10"
                      width="48"
                      height="15"
                      rx="7.5"
                      fill="#0b1329"
                      stroke={pt.cumulativePnL >= 0 ? "#10b981" : "#f43f5e"}
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      y="1.5"
                      fill={pt.cumulativePnL >= 0 ? "#34d399" : "#fb7185"}
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {pt.cumulativePnL >= 0 ? "+" : ""}
                      {pt.cumulativePnL.toFixed(1)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* High-End Glassmorphism Hover Popover HUD (No currency symbols) */}
        {hoveredPoint && (
          <div
            className="absolute z-20 bg-slate-950/95 border border-cyan-500/40 rounded-xl p-2.5 shadow-2xl text-xs font-mono backdrop-blur-xl pointer-events-none flex flex-col gap-1.5 min-w-[145px]"
            style={{
              left: `${Math.min(
                78,
                Math.max(
                  22,
                  ((hoveredPoint as any).svgX / svgWidth) * 100
                )
              )}%`,
              top: "10px",
              transform: "translateX(-50%) translateZ(0)",
              willChange: "transform",
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
              <span className="font-bold text-slate-200 flex items-center gap-1">
                <Activity size={12} className="text-cyan-400" />
                Round #{hoveredPoint.roundIndex}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded font-black text-[9.5px] tracking-wide ${
                  hoveredPoint.outcome === "WIN"
                    ? "bg-emerald-950/90 text-emerald-400 border border-emerald-500/40"
                    : "bg-rose-950/90 text-rose-400 border border-rose-500/40"
                }`}
              >
                {hoveredPoint.outcome}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10.5px] text-slate-400">
              <span>Bet:</span>
              <span className="text-slate-200 font-bold text-right">
                {hoveredPoint.betAmount.toLocaleString()}
              </span>

              {hoveredPoint.multiplier && (
                <>
                  <span>Multiplier:</span>
                  <span className="text-amber-300 font-black text-right">
                    {hoveredPoint.multiplier.toFixed(2)}x
                  </span>
                </>
              )}

              <span>Round Net:</span>
              <span
                className={`font-black text-right ${
                  hoveredPoint.roundNet >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {hoveredPoint.roundNet >= 0 ? "+" : ""}
                {hoveredPoint.roundNet.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-300 border-t border-slate-800/90 pt-1 mt-0.5 bg-slate-900/50 -mx-1 px-1 rounded">
              <span className="font-semibold text-slate-400">Total PnL:</span>
              <span
                className={`font-black ${
                  hoveredPoint.cumulativePnL >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {hoveredPoint.cumulativePnL >= 0 ? "+" : ""}
                {hoveredPoint.cumulativePnL.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
