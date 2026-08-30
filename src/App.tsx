import { useState, useEffect, useRef, useCallback, memo } from "react";
import { GameCanvas } from "./components/GameCanvas";
import { BetPanel } from "./components/BetPanel";
import { BetsList, TopBetRecord } from "./components/BetsList";
import { LivePerformanceLoop } from "./components/LivePerformanceLoop";
import { HelpModal } from "./components/HelpModal";
import { SeamlessWalletModal } from "./components/SeamlessWalletModal";
import { ResponsibleGamingModal } from "./components/ResponsibleGamingModal";
import { audioManager } from "./audio";
import { Bet, PlayerBet, RoundState, HistoryItem, UserStats, WalletMode } from "./types";
import { SkyRushEngine, BetSlip, GameRoomState, MULTIPLIER_DISTRIBUTION_MATRIX } from "./lib/SkyRushEngine";
import { seamlessWalletClient } from "./lib/seamlessWalletClient";
import { generateRandomBotPool, formatToStandardUser } from "./utils/userTransform";
import { getMultiplierColorTier } from "./utils/multiplierColor";
import { 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Wallet, 
  Plane, 
  TrendingUp, 
  Info, 
  Sparkles,
  Award,
  Zap,
  ShieldCheck,
  TrendingDown,
  Percent,
  Terminal,
  Key,
  Lock,
  Unlock,
  Building2,
  Activity
} from "lucide-react";

// Memoized past rounds multiplier history bar
const HistoryBar = memo(({ history }: { history: HistoryItem[] }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 sm:py-2.5 px-3 sm:px-3.5 bg-[#281117]/90 border border-[#52252e]/80 rounded-xl select-none scrollbar-none w-full shadow-inner" id="history_bar">
      <div className="text-[9px] sm:text-[9.5px] text-rose-300/80 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 font-mono">
        <TrendingUp size={11} className="text-rose-400" /> History:
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {history.map((item, idx) => {
          const tier = getMultiplierColorTier(item.val);
          return (
            <span
              key={item.id}
              style={{
                color: tier.color,
                borderColor: tier.borderColor,
                backgroundColor: tier.bgColor,
                boxShadow: tier.shadow,
              }}
              className={`text-[9.5px] sm:text-[10px] font-black px-2.5 py-1 rounded-md font-mono border transition-all duration-300 ring-1 ring-black/50 backdrop-blur-sm ${
                idx === 0 ? "scale-105 ring-white/40" : "opacity-95 hover:opacity-100 hover:scale-105"
              }`}
              title={`${tier.label}: ${item.val.toFixed(2)}x`}
              id={`history_pill_${idx}`}
            >
              {item.val.toFixed(2)}x
            </span>
          );
        })}
      </div>
    </div>
  );
});

// Initializing some mock general round history items for visual realism
const INITIAL_HISTORY: HistoryItem[] = [
  { id: "1", val: 1.05 },
  { id: "2", val: 3.42 },
  { id: "3", val: 1.82 },
  { id: "4", val: 1.15 },
  { id: "5", val: 12.05 },
  { id: "6", val: 2.10 },
  { id: "7", val: 1.45 },
  { id: "8", val: 5.77 },
  { id: "9", val: 1.01 },
  { id: "10", val: 23.40 },
  { id: "11", val: 1.99 },
];

const BOT_NAMES = [
  "KongZaza", "LuckyPilot", "SkyBet_TH", "SlotPro88", "AviationVip", 
  "IsanFlyer", "KrungthepFly", "PhuketJet", "CrashKing", "PropellerRich", 
  "Srettha_Win", "EasyRacer", "AutoHigh", "CaptainA", "JetStreamer",
  "PattayaKing", "YalaRacer", "GoldWing", "SkyPrado", "LamboGamer"
];

const AVATAR_COLORS = [
  "#f43f5e", "#ec4899", "#d946ef", "#a855f7", "#8b5cf6", 
  "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", 
  "#10b981", "#22c55e", "#84cc16", "#eab308", "#f97316"
];

const AVATAR_SEEDS = ["A", "B", "K", "Y", "P", "S", "M", "T", "G", "R", "W", "X", "Z", "H", "F"];

export default function App() {
  const sessionIdRef = useRef<string>(
    (() => {
      let stored = typeof window !== "undefined" ? localStorage.getItem("skyrush_session_id") : null;
      if (!stored) {
        stored = "session_" + Math.random().toString(36).substring(2, 15);
        if (typeof window !== "undefined") {
          localStorage.setItem("skyrush_session_id", stored);
        }
      }
      return stored;
    })()
  );
  const [roundState, setRoundState] = useState<RoundState>("WAITING");
  const [multiplier, setMultiplier] = useState<number>(1.00);
  const [countdown, setCountdown] = useState<number>(5.0);
  const maxCountdown = 5.0;

  // Dual-Wallet Architecture: Demo Wallet & Master Franchise Real Seamless Wallet (THB)
  const [walletMode, setWalletMode] = useState<WalletMode>("DEMO");
  const [demoBalance, setDemoBalance] = useState<number>(90847316.57);
  const [realBalance, setRealBalance] = useState<number>(50000);
  const [realUserId, setRealUserId] = useState<string>("USER_TH_001");
  const [isSyncingRealWallet, setIsSyncingRealWallet] = useState<boolean>(false);
  const [showRefillNotify, setShowRefillNotify] = useState<boolean>(false);

  const walletModeRef = useRef<WalletMode>("DEMO");
  walletModeRef.current = walletMode;
  const realBalanceRef = useRef<number>(50000);
  realBalanceRef.current = realBalance;
  const demoBalanceRef = useRef<number>(90847316.57);
  demoBalanceRef.current = demoBalance;

  // Active wallet balance (Used by UI and betting engine)
  const balance = walletMode === "REAL" ? realBalance : demoBalance;

  // Real-time dynamic Top winners leaderboard state
  const [topBetsHistory, setTopBetsHistory] = useState<TopBetRecord[]>([
    { id: "top_init_1", name: "user_89401824901", multiplier: 154.20, amount: 2500, win: 385500, timestamp: "Just now", isBot: true },
    { id: "top_init_2", name: "user_71829401842", multiplier: 88.45, amount: 4000, win: 353800, timestamp: "2m ago", isBot: true },
    { id: "top_init_3", name: "user_49102849102", multiplier: 45.10, amount: 7500, win: 338250, timestamp: "5m ago", isBot: true },
    { id: "top_init_4", name: "user_19401829481", multiplier: 32.12, amount: 10000, win: 321200, timestamp: "8m ago", isBot: true },
    { id: "top_init_5", name: "user_62019481029", multiplier: 24.50, amount: 12500, win: 306250, timestamp: "11m ago", isBot: true },
    { id: "top_init_6", name: "user_39401829471", multiplier: 18.22, amount: 15000, win: 273300, timestamp: "15m ago", isBot: true },
    { id: "top_init_7", name: "user_50192849102", multiplier: 12.05, amount: 20000, win: 241000, timestamp: "18m ago", isBot: true },
    { id: "top_init_8", name: "user_98102938471", multiplier: 9.80, amount: 25000, win: 245000, timestamp: "22m ago", isBot: true },
  ]);

  // Synchronize real wallet with Master Franchise API
  const syncRealWallet = async (userId: string = realUserId) => {
    setIsSyncingRealWallet(true);
    try {
      const res = await seamlessWalletClient.getBalance(userId);
      if (res.status === "SUCCESS" && typeof res.balance === "number") {
        setRealBalance(res.balance);
      }
    } catch (err) {
      console.error("Failed to sync real wallet balance:", err);
    } finally {
      setIsSyncingRealWallet(false);
    }
  };

  // Initial sync on mount
  useEffect(() => {
    syncRealWallet();
  }, []);

  const switchWalletMode = async (mode: WalletMode) => {
    audioManager.playClick();
    setWalletMode(mode);
    if (mode === "REAL") {
      await syncRealWallet();
    }
  };

  // Stats
  const [userStats, setUserStats] = useState<UserStats>({
    winCount: 0,
    totalBets: 0,
    totalWagered: 0,
    totalWon: 0,
    netProfit: 0,
  });

  // Recent multiplier history
  const [history, setHistory] = useState<HistoryItem[]>(INITIAL_HISTORY);

  // Simulated multiplayer bets
  const [playerBets, setPlayerBets] = useState<PlayerBet[]>([]);

  // Personal Bets
  const [betLeft, setBetLeft] = useState<Bet>({
    amount: 100,
    isPlaced: false,
    isAutoBet: false,
    isAutoCashOut: false,
    autoCashOutMultiplier: 2.00,
    hasCashedOut: false,
  });

  const [betRight, setBetRight] = useState<Bet>({
    amount: 100,
    isPlaced: false,
    isAutoBet: false,
    isAutoCashOut: false,
    autoCashOutMultiplier: 2.00,
    hasCashedOut: false,
  });

  // Personal Cash out bet history logs
  const [myHistory, setMyHistory] = useState<Array<{
    id: string;
    amount: number;
    multiplier?: number;
    winAmount?: number;
    timestamp: string;
    cashbackAmount?: number;
  }>>([]);

  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isSeamlessWalletOpen, setIsSeamlessWalletOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // ACTUARIAL GAME ECONOMY ARCHITECTURE STATES & METRICS
  const [engineMode, setEngineMode] = useState<string>("NORMAL");
  const [accumulatedFuelTax, setAccumulatedFuelTax] = useState<number>(0);
  const [accumulatedFractionSweep, setAccumulatedFractionSweep] = useState<number>(0);
  const [targetMarginBreachedManual, setTargetMarginBreachedManual] = useState<boolean>(false);
  const [isMartingaleAbuse, setIsMartingaleAbuse] = useState<boolean>(false);
  const [consecutiveUserDoubles, setConsecutiveUserDoubles] = useState<number>(0);
  const [lastCombinedBet, setLastCombinedBet] = useState<number>(0);
  const [lastRoundResultWasLoss, setLastRoundResultWasLoss] = useState<boolean>(false);

  // REAL-TIME BACKEND INTEGRATION STATES & REFS
  const [currentRoundIsJackpot, setCurrentRoundIsJackpot] = useState<boolean>(false);
  const [cycleRoundNum, setCycleRoundNum] = useState<number>(1);
  const [globalRoundNum, setGlobalRoundNum] = useState<number>(0);
  const [nextSpecialRoundNum, setNextSpecialRoundNum] = useState<number>(33);
  const [signalPrediction, setSignalPrediction] = useState<number | null>(null);
  const [isAnalyzingSignal, setIsAnalyzingSignal] = useState<boolean>(false);
  const [sessionRoundCounter, setSessionRoundCounter] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("skyrush_session_round_counter");
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 0;
  });
  const [fakeTargetRound, setFakeTargetRound] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("skyrush_fake_target_round");
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 19;
  });
  const [recalibrationCount, setRecalibrationCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("skyrush_recalibration_count");
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 0;
  });
  const [signalConfidence, setSignalConfidence] = useState<number>(() => parseFloat((69 + Math.random() * 6).toFixed(1)));
  const [backendTelemetryInsights, setBackendTelemetryInsights] = useState<{
    totalAnalyzed: number;
    averageCashoutPoint: number;
    predictedPeakRiskPoint: number;
    targetRtpPercent: number;
    houseEdgePercent: number;
    jackpotCyclesCount: string;
    jackpotsScheduledThisCycle: number[];
  } | null>(null);

  // 30% CAPITAL SAFETY LIFELINE & 45% PREEMPTIVE TRAP INDICATOR STATES
  const [sessionEntryBalance, setSessionEntryBalance] = useState<number>(90847316.57);
  const [isInCrisisMode, setIsInCrisisMode] = useState<boolean>(false);
  const [isPreemptTrapActive, setIsPreemptTrapActive] = useState<boolean>(false);

  const nextRoundDataRef = useRef<{
    crashPoint: number;
    isJackpotRound: boolean;
    currentCycleRoundNum: number;
  } | null>(null);

  // Cashback system state in React
  const [cashbackPopup, setCashbackPopup] = useState<{
    show: boolean;
    amount: number;
  }>({ show: false, amount: 0 });
  const cashbackPopupTimeoutRef = useRef<any>(null);

  // SECURE ADMINISTRATOR PORTAL STATES
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>("");
  const [adminErrorMessage, setAdminErrorMessage] = useState<string>("");

  // SPLASH SCREEN AND BACKGROUND HARDWARE DIAGNOSTICS STATE
  const [isSplashActive, setIsSplashActive] = useState<boolean>(true);
  const [isFadeOut, setIsFadeOut] = useState<boolean>(false);
  const [splashProgress, setSplashProgress] = useState<number>(0);
  const [failedChecks, setFailedChecks] = useState<string[]>([]);
  const [isResponsibleGamingOpen, setIsResponsibleGamingOpen] = useState<boolean>(false);

  // Sync state values with reference handles to bypass dependency-array resets
  const balanceRef = useRef(balance);
  const historyRef = useRef(history);

  const betLeftRef = useRef(betLeft);
  const betRightRef = useRef(betRight);
  const hasCashedOutLeftRef = useRef(false);
  const hasCashedOutRightRef = useRef(false);
  const isCashingOutLeftRef = useRef(false);
  const isCashingOutRightRef = useRef(false);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    betLeftRef.current = betLeft;
  }, [betLeft]);

  useEffect(() => {
    betRightRef.current = betRight;
  }, [betRight]);

  // Game loop helpers – references to hold state for game-ticks
  const stateRef = useRef<RoundState>("WAITING");
  const multiplierRef = useRef<number>(1.00);
  const crashMultiplierRef = useRef<number>(1.50);
  const timeElapsedRef = useRef<number>(0);
  const intervalIdRef = useRef<any>(null);

  // Keep refs in sync
  useEffect(() => {
    stateRef.current = roundState;
  }, [roundState]);

  useEffect(() => {
    multiplierRef.current = multiplier;
  }, [multiplier]);

  // AUTOMATIC PREDICTIVE CYCLE PRE-FETCH ON WAITING TRANSITION OR CLIENT STARTUP
  useEffect(() => {
    if (roundState === "WAITING") {
      // Local fallback increment so that the round counter always increases instantly and reliably
      setSessionRoundCounter((prev) => {
        const nextVal = prev > 0 ? prev + 1 : 1;
        if (typeof window !== "undefined") {
          localStorage.setItem("skyrush_session_round_counter", String(nextVal));
        }
        return nextVal;
      });
      preFetchNextRoundFromBackend();
    }
  }, [roundState]);

  // Initial insights fetch at app load
  useEffect(() => {
    fetchTelemetryInsightsFromBackend();
  }, []);

  // Splash and pre-game background hardware evaluation cycle (3 seconds duration)
  useEffect(() => {
    let currentPercentage = 0;
    
    const intervalId = setInterval(() => {
      currentPercentage += 1;
      setSplashProgress(currentPercentage);
      
      if (currentPercentage >= 100) {
        clearInterval(intervalId);
        
        // Background System Checks precisely at 100% load completions
        const validationFailures: string[] = [];

        // Check 1: Game canvas exists and is rendering correctly
        try {
          const canvasElement = document.getElementById("aviator_game_canvas") as HTMLCanvasElement | null;
          if (!canvasElement) {
            validationFailures.push("Hardware Canvas Missing");
          } else {
            const contextType = canvasElement.getContext("2d");
            if (!contextType) {
              validationFailures.push("Canvas Rendering Pipeline Blocked");
            }
          }
        } catch (e: any) {
          validationFailures.push(`Canvas Check: ${e?.message || e}`);
        }

        // Check 2: Multiplier calculation function is present and returns a number
        try {
          const rEngine = SkyRushEngine.getInstance();
          if (typeof rEngine.generateSecureGlobalOutcome !== "function") {
            validationFailures.push("Core Probability Engine Offline");
          } else {
            const dummyRoom: GameRoomState = { totalRealLiability: 0, totalRealLiabilityTHB: 0, globalCrashMultiplier: 1.00, isRealPlayerActive: false };
            const dummyOutcome = rEngine.generateSecureGlobalOutcome(dummyRoom, false, false, 0);
            if (!dummyOutcome || typeof dummyOutcome.multiplier !== "number" || isNaN(dummyOutcome.multiplier)) {
              validationFailures.push("Outcome Output Invalid Format");
            }
          }
        } catch (e: any) {
          validationFailures.push(`Multiplier Formula: ${e?.message || e}`);
        }

        // Check 3: Bet/cashout button event listeners are attached (elements exist in DOM)
        try {
          const lActionBtn = document.getElementById("bet_action_btn_left");
          const rActionBtn = document.getElementById("bet_action_btn_right");
          if (!lActionBtn || !rActionBtn) {
            validationFailures.push("Interactive Wager Controls Detached");
          }
        } catch (e: any) {
          validationFailures.push(`Button Integrity: ${e?.message || e}`);
        }

        // Check 4: Balance display is showing a valid number
        const curBalance = balanceRef.current;
        if (typeof curBalance !== "number" || isNaN(curBalance) || curBalance < 0) {
          validationFailures.push("Wallet Cash Balance Out of Range");
        }

        // Check 5: Round history array is initialized
        const curHistory = historyRef.current;
        if (!Array.isArray(curHistory) || curHistory.length === 0) {
          validationFailures.push("Coefficient History Log Uninitialized");
        }

        // Check 6: RNG / crash point generator function exists
        if (typeof generateNewCrashPoint !== "function") {
          validationFailures.push("Secure Seed Generator Missing");
        } else {
          try {
            const testResultPt = generateNewCrashPoint(false, true);
            if (typeof testResultPt !== "number" || isNaN(testResultPt) || testResultPt < 1.00) {
              validationFailures.push("Seed Math Constraint Infringements");
            }
          } catch (e: any) {
            validationFailures.push(`RNG Core: ${e?.message || e}`);
          }
        }

        // Apply findings to state
        setFailedChecks(validationFailures);
        
        // Wait 0.5s (500ms) then fade out splash smoothly and reveal the game
        setTimeout(() => {
          setIsFadeOut(true);
          setTimeout(() => {
            setIsSplashActive(false);
            setIsResponsibleGamingOpen(true);
          }, 800); // 800ms duration for fade animations
        }, 500);
      }
    }, 30); // 30ms interval ticks * 100 ticks = 3000ms total animation lifecycle

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // REAL-TIME BACKEND INTEGRATION METHODS
  const preFetchNextRoundFromBackend = async () => {
    try {
      const activeWager = (betLeft.isPlaced ? betLeft.amount : 0) + (betRight.isPlaced ? betRight.amount : 0);
      const isPlayerActive = betLeft.isPlaced || betRight.isPlaced;

      const response = await fetch("/api/security/round/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          currentBalance: balance,
          sessionId: sessionIdRef.current,
          sessionRoundCounter: sessionRoundCounter,
          fakeTargetRound: fakeTargetRound,
          recalibrationCount: recalibrationCount,
          userStats: userStats,
          isRealPlayerActive: isPlayerActive,
          totalRealLiability: activeWager
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.crashPointOverride === "number") {
          if (typeof data.sessionEntryBalance === "number") {
            setSessionEntryBalance(data.sessionEntryBalance);
          }
          if (typeof data.isInCrisisMode === "boolean") {
            setIsInCrisisMode(data.isInCrisisMode);
          }
          if (typeof data.isPreemptTrapActive === "boolean") {
            setIsPreemptTrapActive(data.isPreemptTrapActive);
          }
          nextRoundDataRef.current = {
            crashPoint: data.crashPointOverride,
            isJackpotRound: data.isJackpotRound || false,
            currentCycleRoundNum: data.currentCycleRoundNum || 1
          };
          if (typeof data.globalRoundNum === "number") {
            setGlobalRoundNum(data.globalRoundNum);
          }
          if (typeof data.nextSpecialRoundNum === "number") {
            setNextSpecialRoundNum(data.nextSpecialRoundNum);
          }
          if (typeof data.sessionRoundCounter === "number") {
            setSessionRoundCounter(data.sessionRoundCounter);
            if (typeof window !== "undefined") {
              localStorage.setItem("skyrush_session_round_counter", String(data.sessionRoundCounter));
            }
          }
          if (typeof data.fakeTargetRound === "number") {
            setFakeTargetRound(data.fakeTargetRound);
            if (typeof window !== "undefined") {
              localStorage.setItem("skyrush_fake_target_round", String(data.fakeTargetRound));
            }
          }
          if (typeof data.recalibrationCount === "number") {
            setRecalibrationCount(data.recalibrationCount);
            if (typeof window !== "undefined") {
              localStorage.setItem("skyrush_recalibration_count", String(data.recalibrationCount));
            }
          }
          setSignalConfidence(parseFloat((69 + Math.random() * 6).toFixed(1)));
          setIsAnalyzingSignal(true);
          setSignalPrediction(null);
          setTimeout(() => {
            const pred = typeof data.signalPrediction === "number" 
              ? data.signalPrediction 
              : (typeof data.aiPrediction === "number" ? data.aiPrediction : parseFloat((Math.random() * (12.0 - 1.2) + 1.2).toFixed(2)));
            setSignalPrediction(pred);
            setIsAnalyzingSignal(false);
          }, 1800);
          fetchTelemetryInsightsFromBackend();
          return;
        }
      }
    } catch (err) {
      console.warn("Backend pre-commitment offline, falling back to local client seed engine.");
    }
    nextRoundDataRef.current = null; // Fallback to local
  };

  const fetchTelemetryInsightsFromBackend = async () => {
    try {
      const response = await fetch("/api/security/analytics/insights");
      if (response.ok) {
        const data = await response.json();
        setBackendTelemetryInsights(data);
      }
    } catch (err) {
      console.error("Failed to fetch backend telemetry insights", err);
    }
  };

  const logPlayerCashoutToBackend = async (multiplier: number) => {
    try {
      await fetch("/api/security/analytics/cashout-metric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          multiplierCashed: multiplier,
          sessionId: sessionIdRef.current 
        })
      });
    } catch (err) {
      // Fail silently for offline robustness
    }
  };

  // Audio mute sync
  const toggleMute = () => {
    const nextMuted = audioManager.toggleMute();
    setIsMuted(nextMuted);
  };

  // Helper to calculate turnover platform fee (3%) dynamically from SkyRushEngine
  const getTaxForWager = (amount: number): number => {
    const engine = SkyRushEngine.getInstance();
    return engine.processTurnoverCommission(amount);
  };

  // Pre-calculations for generating random crash targets under Server-Authoritative Math specs
  const generateNewCrashPoint = (isAbuseDirect: boolean, isMock?: boolean) => {
    const isPlayerActive = betLeft.isPlaced || betRight.isPlaced;

    // If we have securely generated a crash target from the backend, inject it as the master source of truth
    if (!isMock && nextRoundDataRef.current && typeof nextRoundDataRef.current.crashPoint === "number") {
      const backendVal = nextRoundDataRef.current.crashPoint;
      setCurrentRoundIsJackpot(nextRoundDataRef.current.isJackpotRound);
      setCycleRoundNum(nextRoundDataRef.current.currentCycleRoundNum);
      
      // Clear for the next round
      nextRoundDataRef.current = null;

      // If the player placed a real bet, ensure they never inherit a fake spectator jackpot (>= 25.00x)
      if (isPlayerActive && backendVal >= 25.00) {
        const engine = SkyRushEngine.getInstance();
        const safeOutcome = engine.generateRoundSpacedMultiplier();
        setEngineMode("SERVER_ACTUARIAL_ENGINE");
        return safeOutcome.multiplier;
      }

      setEngineMode(isAbuseDirect ? "MARTINGALE_OVERRIDE" : "SERVER_ACTUARIAL_ENGINE");
      return backendVal;
    }

    // Otherwise, execute the single-player private room isolated outcome generator
    let totalRealLiabilityTHB = 0;
    let realPlayerTarget: number | undefined = undefined;

    if (betLeft.isPlaced) {
      totalRealLiabilityTHB += betLeft.amount;
      if (betLeft.isAutoCashOut && betLeft.autoCashOutMultiplier > 1.01) {
        realPlayerTarget = betLeft.autoCashOutMultiplier;
      }
    }
    if (betRight.isPlaced) {
      totalRealLiabilityTHB += betRight.amount;
      if (betRight.isAutoCashOut && betRight.autoCashOutMultiplier > 1.01) {
        realPlayerTarget = realPlayerTarget 
          ? Math.min(realPlayerTarget, betRight.autoCashOutMultiplier) 
          : betRight.autoCashOutMultiplier;
      }
    }

    const roomState: GameRoomState = {
      totalRealLiability: totalRealLiabilityTHB,
      totalRealLiabilityTHB,
      globalCrashMultiplier: 1.00,
      isRealPlayerActive: isPlayerActive,
      realPlayerTarget,
    };

    const engine = SkyRushEngine.getInstance();
    const activeEntitiesCount = playerBets.length + (betLeft.isPlaced ? 1 : 0) + (betRight.isPlaced ? 1 : 0);
    const result = engine.generateSecureGlobalOutcome(
      roomState,
      targetMarginBreachedManual,
      isAbuseDirect,
      activeEntitiesCount
    );

    setCurrentRoundIsJackpot(false);
    setEngineMode(result.mode);
    return Math.max(1.00, result.multiplier);
  };

  // Simulated multiplayer bots and real connected players builder
  const spawnSimulatedBots = () => {
    // Generate between 100 and 200 random user bots per round with strictly unique 11-digit numbers
    const botPool = generateRandomBotPool({ minBots: 100, maxBots: 200, maxBetAmount: 30000 });
    
    // Inject active real user bets if committed this round
    const combinedBets: PlayerBet[] = [];
    const formattedRealUser = formatToStandardUser(realUserId);

    if (betLeft.isPlaced) {
      combinedBets.push({
        id: `real_player_l_${Date.now()}`,
        name: formattedRealUser,
        avatarColor: "#f59e0b", // Amber indicator for player
        avatarSeed: "ME",
        amount: betLeft.amount,
        isCashedOut: betLeft.hasCashedOut,
        isBust: false,
        cashOutMultiplier: betLeft.cashedOutMultiplier,
        ...({ isRealUser: true } as any)
      });
    }

    if (betRight.isPlaced) {
      combinedBets.push({
        id: `real_player_r_${Date.now()}`,
        name: formattedRealUser,
        avatarColor: "#f59e0b", // Amber indicator for player
        avatarSeed: "ME",
        amount: betRight.amount,
        isCashedOut: betRight.hasCashedOut,
        isBust: false,
        cashOutMultiplier: betRight.cashedOutMultiplier,
        ...({ isRealUser: true } as any)
      });
    }

    // Merge real player bets at top of active list followed by bots
    const allBetsList = [...combinedBets, ...(botPool as unknown as PlayerBet[])];
    setPlayerBets(allBetsList);
  };

  // Reset demo credits or refresh real wallet
  const refillCredits = () => {
    if (walletMode === "REAL") {
      syncRealWallet();
      return;
    }
    audioManager.playCashOut();
    setDemoBalance(90847316.57);
    setShowRefillNotify(true);
    setSessionRoundCounter(0);
    if (typeof window !== "undefined") {
      localStorage.setItem("skyrush_session_round_counter", "0");
    }
    setTimeout(() => setShowRefillNotify(false), 3000);
  };

  // Manual reset of Stats
  const handleResetStats = useCallback(() => {
    audioManager.playClick();
    setUserStats({
      winCount: 0,
      totalBets: 0,
      totalWagered: 0,
      totalWon: 0,
      netProfit: 0,
    });
    setMyHistory([]);
    setSessionRoundCounter(0);
    if (typeof window !== "undefined") {
      localStorage.setItem("skyrush_session_round_counter", "0");
    }
  }, []);

  // Placing individual bets with 3% turnover platform commission
  const placeBetLeft = useCallback(async (rawAmount: number) => {
    if (roundState !== "WAITING") {
      audioManager.playClick();
      return; // Cannot place bet into an already active flight
    }
    hasCashedOutLeftRef.current = false;
    isCashingOutLeftRef.current = false;
    const amount = Math.min(30000, Math.max(30, rawAmount));
    const tax = getTaxForWager(amount);
    const totalCost = amount + tax;
    
    const currentBal = walletModeRef.current === "REAL" ? realBalanceRef.current : demoBalanceRef.current;
    if (currentBal < totalCost) {
      audioManager.playClick();
      return;
    }

    if (walletModeRef.current === "REAL") {
      const txnId = `BET_${Date.now()}_L_${Math.random().toString(36).substring(2, 6)}`;
      const res = await seamlessWalletClient.debitBet(txnId, totalCost, realUserId);
      if (res.status === "SUCCESS" && typeof res.balance === "number") {
        audioManager.playBetPlaced();
        setRealBalance(res.balance);
        setAccumulatedFuelTax(SkyRushEngine.getInstance().accumulatedFuelTaxTHB);
        setBetLeft((prev) => ({ ...prev, amount, isPlaced: true, hasCashedOut: false, betTxnId: txnId }));
      } else {
        audioManager.playClick();
        console.warn("Real Wallet Debit Error:", res.error);
      }
    } else {
      audioManager.playBetPlaced();
      setDemoBalance((prev) => parseFloat((prev - totalCost).toFixed(2)));
      setAccumulatedFuelTax(SkyRushEngine.getInstance().accumulatedFuelTaxTHB);
      setBetLeft((prev) => ({ ...prev, amount, isPlaced: true, hasCashedOut: false, betTxnId: undefined }));
    }
  }, [roundState, realUserId]);

  const placeBetRight = useCallback(async (rawAmount: number) => {
    if (roundState !== "WAITING") {
      audioManager.playClick();
      return; // Cannot place bet into an already active flight
    }
    hasCashedOutRightRef.current = false;
    isCashingOutRightRef.current = false;
    const amount = Math.min(30000, Math.max(30, rawAmount));
    const tax = getTaxForWager(amount);
    const totalCost = amount + tax;
    
    const currentBal = walletModeRef.current === "REAL" ? realBalanceRef.current : demoBalanceRef.current;
    if (currentBal < totalCost) {
      audioManager.playClick();
      return;
    }

    if (walletModeRef.current === "REAL") {
      const txnId = `BET_${Date.now()}_R_${Math.random().toString(36).substring(2, 6)}`;
      const res = await seamlessWalletClient.debitBet(txnId, totalCost, realUserId);
      if (res.status === "SUCCESS" && typeof res.balance === "number") {
        audioManager.playBetPlaced();
        setRealBalance(res.balance);
        setAccumulatedFuelTax(SkyRushEngine.getInstance().accumulatedFuelTaxTHB);
        setBetRight((prev) => ({ ...prev, amount, isPlaced: true, hasCashedOut: false, betTxnId: txnId }));
      } else {
        audioManager.playClick();
        console.warn("Real Wallet Debit Error:", res.error);
      }
    } else {
      audioManager.playBetPlaced();
      setDemoBalance((prev) => parseFloat((prev - totalCost).toFixed(2)));
      setAccumulatedFuelTax(SkyRushEngine.getInstance().accumulatedFuelTaxTHB);
      setBetRight((prev) => ({ ...prev, amount, isPlaced: true, hasCashedOut: false, betTxnId: undefined }));
    }
  }, [roundState, realUserId]);

  // Bet cancellation is strictly only permitted during the WAITING phase. Once round starts, bets are locked!
  const cancelBetLeft = useCallback(async () => {
    if (roundState !== "WAITING") {
      audioManager.playClick();
      return; // Locked once round starts!
    }
    audioManager.playClick();
    hasCashedOutLeftRef.current = false;
    isCashingOutLeftRef.current = false;
    if (betLeft.isPlaced) {
      if (walletModeRef.current === "REAL" && betLeft.betTxnId) {
        const rbTxnId = `RB_${Date.now()}_L`;
        const res = await seamlessWalletClient.rollbackBet(rbTxnId, betLeft.betTxnId, realUserId);
        if (res.status === "SUCCESS" && typeof res.balance === "number") {
          setRealBalance(res.balance);
        }
      } else {
        setDemoBalance((prev) => parseFloat((prev + betLeft.amount).toFixed(2)));
      }
      setBetLeft((prev) => ({ ...prev, isPlaced: false, betTxnId: undefined }));
    }
  }, [roundState, betLeft.isPlaced, betLeft.betTxnId, betLeft.amount, realUserId]);

  const cancelBetRight = useCallback(async () => {
    if (roundState !== "WAITING") {
      audioManager.playClick();
      return; // Locked once round starts!
    }
    audioManager.playClick();
    hasCashedOutRightRef.current = false;
    isCashingOutRightRef.current = false;
    if (betRight.isPlaced) {
      if (walletModeRef.current === "REAL" && betRight.betTxnId) {
        const rbTxnId = `RB_${Date.now()}_R`;
        const res = await seamlessWalletClient.rollbackBet(rbTxnId, betRight.betTxnId, realUserId);
        if (res.status === "SUCCESS" && typeof res.balance === "number") {
          setRealBalance(res.balance);
        }
      } else {
        setDemoBalance((prev) => parseFloat((prev + betRight.amount).toFixed(2)));
      }
      setBetRight((prev) => ({ ...prev, isPlaced: false, betTxnId: undefined }));
    }
  }, [roundState, betRight.isPlaced, betRight.betTxnId, betRight.amount, realUserId]);

  // Executing user cashout operations with exact mathematical payout (amount * multiplier)
  const cashOutLeft = useCallback(async () => {
    if (hasCashedOutLeftRef.current || isCashingOutLeftRef.current) return;
    const currentBet = betLeftRef.current;
    if (stateRef.current !== "FLYING" || !currentBet.isPlaced || currentBet.hasCashedOut) return;
    
    // Atomically claim cashout to block any concurrent intervals
    hasCashedOutLeftRef.current = true;
    isCashingOutLeftRef.current = true;

    try {
      const curMultiplier = multiplierRef.current;
      // Exact mathematical calculation: Amount * Multiplier truncated to 2 decimal places (Satang)
      const rawWinnings = Math.floor(currentBet.amount * curMultiplier * 100) / 100;
      
      audioManager.playCashOut();

      if (walletModeRef.current === "REAL") {
        const winTxnId = `WIN_${Date.now()}_L_${Math.random().toString(36).substring(2, 6)}`;
        const res = await seamlessWalletClient.creditWin(winTxnId, rawWinnings, realUserId);
        const actualPayout = typeof res.net_win_added === "number" ? res.net_win_added : rawWinnings;
        
        if (res.status === "SUCCESS" && typeof res.balance === "number") {
          setRealBalance(res.balance);
        }

        setBetLeft((prev) => ({
          ...prev,
          hasCashedOut: true,
          cashedOutMultiplier: curMultiplier,
          winAmount: actualPayout,
        }));

        logPlayerCashoutToBackend(curMultiplier);

        // Log stats
        setUserStats((prev) => ({
          ...prev,
          winCount: prev.winCount + 1,
          totalBets: prev.totalBets + 1,
          totalWagered: prev.totalWagered + currentBet.amount,
          totalWon: prev.totalWon + actualPayout,
          netProfit: prev.netProfit + (actualPayout - currentBet.amount),
        }));

        // Log history
        setMyHistory((prev) => [
          {
            id: `my_bet_${Date.now()}_l`,
            amount: currentBet.amount,
            multiplier: curMultiplier,
            winAmount: actualPayout,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
          ...prev,
        ]);
      } else {
        const engine = SkyRushEngine.getInstance();
        const { payout, swept } = engine.truncatePayoutAndSweep(rawWinnings);
        setAccumulatedFractionSweep(engine.accumulatedFractionSweepTHB);
        
        setDemoBalance((prev) => parseFloat((prev + payout).toFixed(2)));
        setBetLeft((prev) => ({
          ...prev,
          hasCashedOut: true,
          cashedOutMultiplier: curMultiplier,
          winAmount: payout,
        }));

        logPlayerCashoutToBackend(curMultiplier);

        // Log stats
        setUserStats((prev) => ({
          ...prev,
          winCount: prev.winCount + 1,
          totalBets: prev.totalBets + 1,
          totalWagered: prev.totalWagered + currentBet.amount,
          totalWon: prev.totalWon + payout,
          netProfit: prev.netProfit + (payout - currentBet.amount),
        }));

        // Log history
        setMyHistory((prev) => [
          {
            id: `my_bet_${Date.now()}_l`,
            amount: currentBet.amount,
            multiplier: curMultiplier,
            winAmount: payout,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
          ...prev,
        ]);
      }
    } finally {
      isCashingOutLeftRef.current = false;
    }
  }, [realUserId]);

  const cashOutRight = useCallback(async () => {
    if (hasCashedOutRightRef.current || isCashingOutRightRef.current) return;
    const currentBet = betRightRef.current;
    if (stateRef.current !== "FLYING" || !currentBet.isPlaced || currentBet.hasCashedOut) return;
    
    // Atomically claim cashout to block any concurrent intervals
    hasCashedOutRightRef.current = true;
    isCashingOutRightRef.current = true;

    try {
      const curMultiplier = multiplierRef.current;
      // Exact mathematical calculation: Amount * Multiplier truncated to 2 decimal places (Satang)
      const rawWinnings = Math.floor(currentBet.amount * curMultiplier * 100) / 100;
      
      audioManager.playCashOut();

      if (walletModeRef.current === "REAL") {
        const winTxnId = `WIN_${Date.now()}_R_${Math.random().toString(36).substring(2, 6)}`;
        const res = await seamlessWalletClient.creditWin(winTxnId, rawWinnings, realUserId);
        const actualPayout = typeof res.net_win_added === "number" ? res.net_win_added : rawWinnings;
        
        if (res.status === "SUCCESS" && typeof res.balance === "number") {
          setRealBalance(res.balance);
        }

        setBetRight((prev) => ({
          ...prev,
          hasCashedOut: true,
          cashedOutMultiplier: curMultiplier,
          winAmount: actualPayout,
        }));

        logPlayerCashoutToBackend(curMultiplier);

        // Log stats
        setUserStats((prev) => ({
          ...prev,
          winCount: prev.winCount + 1,
          totalBets: prev.totalBets + 1,
          totalWagered: prev.totalWagered + currentBet.amount,
          totalWon: prev.totalWon + actualPayout,
          netProfit: prev.netProfit + (actualPayout - currentBet.amount),
        }));

        // Log history
        setMyHistory((prev) => [
          {
            id: `my_bet_${Date.now()}_r`,
            amount: currentBet.amount,
            multiplier: curMultiplier,
            winAmount: actualPayout,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
          ...prev,
        ]);
      } else {
        const engine = SkyRushEngine.getInstance();
        const { payout, swept } = engine.truncatePayoutAndSweep(rawWinnings);
        setAccumulatedFractionSweep(engine.accumulatedFractionSweepTHB);
        
        setDemoBalance((prev) => parseFloat((prev + payout).toFixed(2)));
        setBetRight((prev) => ({
          ...prev,
          hasCashedOut: true,
          cashedOutMultiplier: curMultiplier,
          winAmount: payout,
        }));

        logPlayerCashoutToBackend(curMultiplier);

        // Log stats
        setUserStats((prev) => ({
          ...prev,
          winCount: prev.winCount + 1,
          totalBets: prev.totalBets + 1,
          totalWagered: prev.totalWagered + currentBet.amount,
          totalWon: prev.totalWon + payout,
          netProfit: prev.netProfit + (payout - currentBet.amount),
        }));

        // Log history
        setMyHistory((prev) => [
          {
            id: `my_bet_${Date.now()}_r`,
            amount: currentBet.amount,
            multiplier: curMultiplier,
            winAmount: payout,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
          ...prev,
        ]);
      }
    } finally {
      isCashingOutRightRef.current = false;
    }
  }, [realUserId]);

  const updateAutoSettingsLeft = useCallback((isAutoBet: boolean, isAutoCashOut: boolean, autoMultiplier: number) => {
    setBetLeft((prev) => ({
      ...prev,
      isAutoBet,
      isAutoCashOut,
      autoCashOutMultiplier: autoMultiplier,
    }));
  }, []);

  const updateAutoSettingsRight = useCallback((isAutoBet: boolean, isAutoCashOut: boolean, autoMultiplier: number) => {
    setBetRight((prev) => ({
      ...prev,
      isAutoBet,
      isAutoCashOut,
      autoCashOutMultiplier: autoMultiplier,
    }));
  }, []);

  // Main State and loop coordinator
  useEffect(() => {
    let animFrameId: number;
    let timeoutId: NodeJS.Timeout | null = null;

    // WAITING state initiator
    if (roundState === "WAITING") {
      timeElapsedRef.current = 0;
      multiplierRef.current = 1.01;
      setMultiplier(1.01);
      setCountdown(maxCountdown);
      spawnSimulatedBots();

      // Reset atomic single-trigger cashout locks for the upcoming round
      hasCashedOutLeftRef.current = false;
      hasCashedOutRightRef.current = false;
      isCashingOutLeftRef.current = false;
      isCashingOutRightRef.current = false;

      // Trigger automatic placing of user bets with Asymmetric Fuel Tax applied
      if (betLeft.isAutoBet && !betLeft.isPlaced) {
        placeBetLeft(betLeft.amount);
      }
      if (betRight.isAutoBet && !betRight.isPlaced) {
        placeBetRight(betRight.amount);
      }

      const waitStartTime = performance.now();
      const durationMs = maxCountdown * 1000;

      const waitTick = (now: number) => {
        const elapsedMs = now - waitStartTime;
        const remainingSec = Math.max(0, (durationMs - elapsedMs) / 1000);
        setCountdown(parseFloat(remainingSec.toFixed(1)));

        if (remainingSec <= 0.05) {
          // Transition into Flying state!
          multiplierRef.current = 1.01;
          setMultiplier(1.01);

          // DETECT PROGRESSIVE DOUBLING (MARTINGALE LOGIC) (Pillar 6)
          const currentWager = (betLeft.isPlaced ? betLeft.amount : 0) + (betRight.isPlaced ? betRight.amount : 0);
          let currentDoubles = consecutiveUserDoubles;
          
          if (lastRoundResultWasLoss && currentWager > 0 && lastCombinedBet > 0) {
            if (currentWager >= 1.9 * lastCombinedBet) {
              currentDoubles += 1;
            } else {
              currentDoubles = 0;
            }
          } else if (currentWager > 0) {
            currentDoubles = 0;
          }
          
          const isAbuse = currentDoubles >= 2;
          setConsecutiveUserDoubles(currentDoubles);
          setIsMartingaleAbuse(isAbuse);
          setLastCombinedBet(currentWager);

          const crashTgt = generateNewCrashPoint(isAbuse);
          crashMultiplierRef.current = crashTgt;
          setRoundState("FLYING");
          audioManager.startEngine();
          audioManager.playJetTakeoff();
          return;
        }

        animFrameId = requestAnimationFrame(waitTick);
      };

      animFrameId = requestAnimationFrame(waitTick);
    }

    // FLYING state loop (Hardware-synced Delta-Time rAF Loop)
    if (roundState === "FLYING") {
      const flightStartTime = performance.now();
      let lastBotUpdate = performance.now();
      let lastStateFlush = performance.now();

      const flightTick = (now: number) => {
        const elapsed = (now - flightStartTime) / 1000;
        timeElapsedRef.current = elapsed;

        // Snappy, high-speed, synchronized progression (brisk takeoff & rapid climbing)
        const curMultiplier = Math.max(1.01, 1.00 + 0.08 * elapsed + 0.032 * Math.pow(elapsed, 2.0));

        multiplierRef.current = curMultiplier;

        // Immediate Auto Cash Out monitors with 0ms frame-level latency
        const bLeft = betLeftRef.current;
        if (
          bLeft.isPlaced && 
          !bLeft.hasCashedOut && 
          !hasCashedOutLeftRef.current && 
          !isCashingOutLeftRef.current && 
          bLeft.isAutoCashOut
        ) {
          if (curMultiplier >= bLeft.autoCashOutMultiplier) {
            cashOutLeft();
          }
        }

        const bRight = betRightRef.current;
        if (
          bRight.isPlaced && 
          !bRight.hasCashedOut && 
          !hasCashedOutRightRef.current && 
          !isCashingOutRightRef.current && 
          bRight.isAutoCashOut
        ) {
          if (curMultiplier >= bRight.autoCashOutMultiplier) {
            cashOutRight();
          }
        }

        // Critical block: Crash Point reached
        if (curMultiplier >= crashMultiplierRef.current) {
          const finalCrash = crashMultiplierRef.current;
          multiplierRef.current = finalCrash;
          setMultiplier(finalCrash);
          setRoundState("FLEW_AWAY");
          audioManager.playFlewAway();
          return;
        }

        audioManager.updateEngine(curMultiplier);

        // Throttle React state setMultiplier to smooth 30 FPS updates to keep UI and event thread ultra-responsive
        if (now - lastStateFlush >= 33) {
          lastStateFlush = now;
          setMultiplier(curMultiplier);
        }

        // Optimized bot cashout status update (throttled every 250ms, batched without unnecessary renders)
        if (now - lastBotUpdate >= 250) {
          lastBotUpdate = now;
          setPlayerBets((prev) => {
            let hasChange = false;
            const updated = prev.map((player: any) => {
              if (!player.isCashedOut && !player.isBust) {
                if (curMultiplier >= player.targetMultiplier) {
                  hasChange = true;
                  return {
                    ...player,
                    isCashedOut: true,
                    cashOutMultiplier: player.targetMultiplier,
                  };
                }
              }
              return player;
            });
            return hasChange ? updated : prev;
          });
        }

        animFrameId = requestAnimationFrame(flightTick);
      };

      animFrameId = requestAnimationFrame(flightTick);
    }

    // FLEW AWAY transition timers (Pillar 6)
    if (roundState === "FLEW_AWAY") {
      audioManager.stopEngine();
      
      const crashPointVal = crashMultiplierRef.current;

      // Update Simulated other players to either cashed out or BUST
      setPlayerBets((prev) =>
        prev.map((player) => {
          if (!player.isCashedOut) {
            return { ...player, isBust: true };
          }
          return player;
        })
      );

      // Collect high-multiplier bot winners from this round to dynamically update the TOP tab
      setPlayerBets((prev) => {
        const topWinnersThisRound = prev
          .filter((p) => p.isCashedOut && (p.cashOutMultiplier || 0) >= 8.0)
          .map((p, idx) => {
            const mult = p.cashOutMultiplier || 1.0;
            const winAmount = parseFloat((p.amount * mult).toFixed(2));
            return {
              id: `top_${p.id}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              name: p.name,
              multiplier: mult,
              amount: p.amount,
              win: winAmount,
              timestamp: "Just now",
              isBot: !(p as any).isRealUser,
            };
          });

        if (topWinnersThisRound.length > 0) {
          setTopBetsHistory((oldTop) => {
            const map = new Map<string, TopBetRecord>();
            for (const item of [...topWinnersThisRound, ...oldTop]) {
              if (!map.has(item.id)) {
                map.set(item.id, item);
              }
            }
            const combined = Array.from(map.values());
            const sorted = combined.sort((a, b) => b.win - a.win);
            return sorted.slice(0, 20);
          });
        }
        return prev;
      });

      // Evaluate if player lost any committed bets this round
      let userLostThisRound = false;
      if (betLeft.isPlaced && !betLeft.hasCashedOut) {
        userLostThisRound = true;
      }
      if (betRight.isPlaced && !betRight.hasCashedOut) {
        userLostThisRound = true;
      }
      setLastRoundResultWasLoss(userLostThisRound);

      // Cashback calculations & backend loss settlement
      let totalCashbackThisRound = 0;
      let leftCashback = 0;
      let rightCashback = 0;

      if (betLeft.isPlaced && !betLeft.hasCashedOut) {
        leftCashback = parseFloat((betLeft.amount * 0.10).toFixed(2));
        totalCashbackThisRound += leftCashback;

        if (walletModeRef.current === "REAL" && betLeft.betTxnId) {
          const lossTxnId = `LOSS_${Date.now()}_L_${Math.random().toString(36).substring(2, 6)}`;
          seamlessWalletClient.processLoss(lossTxnId, betLeft.betTxnId, betLeft.amount, realUserId).then((res) => {
            if (res.status === "SUCCESS" && typeof res.balance === "number") {
              setRealBalance(res.balance);
            }
          });
        }
      }
      if (betRight.isPlaced && !betRight.hasCashedOut) {
        rightCashback = parseFloat((betRight.amount * 0.10).toFixed(2));
        totalCashbackThisRound += rightCashback;

        if (walletModeRef.current === "REAL" && betRight.betTxnId) {
          const lossTxnId = `LOSS_${Date.now()}_R_${Math.random().toString(36).substring(2, 6)}`;
          seamlessWalletClient.processLoss(lossTxnId, betRight.betTxnId, betRight.amount, realUserId).then((res) => {
            if (res.status === "SUCCESS" && typeof res.balance === "number") {
              setRealBalance(res.balance);
            }
          });
        }
      }

      if (walletModeRef.current === "DEMO" && totalCashbackThisRound > 0) {
        setDemoBalance((prev) => parseFloat((prev + totalCashbackThisRound).toFixed(2)));
      }

      if (totalCashbackThisRound > 0) {
        setCashbackPopup({ show: true, amount: totalCashbackThisRound });
        if (cashbackPopupTimeoutRef.current) {
          clearTimeout(cashbackPopupTimeoutRef.current);
        }
        cashbackPopupTimeoutRef.current = setTimeout(() => {
          setCashbackPopup((prev) => ({ ...prev, show: false }));
        }, 3000);
      }

      // Handle un-cashed out personal bets (they loss/bust)
      if (betLeft.isPlaced && !betLeft.hasCashedOut) {
        setUserStats((prev) => ({
          ...prev,
          totalBets: prev.totalBets + 1,
          totalWagered: prev.totalWagered + betLeft.amount,
          netProfit: parseFloat((prev.netProfit - (betLeft.amount - leftCashback)).toFixed(2)),
        }));
        setMyHistory((prev) => [
          {
            id: `my_bet_${Date.now()}_l_col`,
            amount: betLeft.amount,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            cashbackAmount: leftCashback,
          },
          ...prev,
        ]);
      }
      if (betRight.isPlaced && !betRight.hasCashedOut) {
        setUserStats((prev) => ({
          ...prev,
          totalBets: prev.totalBets + 1,
          totalWagered: prev.totalWagered + betRight.amount,
          netProfit: parseFloat((prev.netProfit - (betRight.amount - rightCashback)).toFixed(2)),
        }));
        setMyHistory((prev) => [
          {
            id: `my_bet_${Date.now()}_r_col`,
            amount: betRight.amount,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            cashbackAmount: rightCashback,
          },
          ...prev,
        ]);
      }

      // Pre-cleanup and reset individual round configurations
      setBetLeft((prev) => ({ ...prev, isPlaced: false, hasCashedOut: false }));
      setBetRight((prev) => ({ ...prev, isPlaced: false, hasCashedOut: false }));

      // Push multiplier onto top history list
      setHistory((prev) => [
        { id: `hist_${Date.now()}`, val: crashPointVal },
        ...prev.slice(0, 16), // cap at max 17 items shown
      ]);

      // Wait 3.0 seconds, then reset state
      timeoutId = setTimeout(() => {
        setRoundState("WAITING");
      }, 3000);
    }

    return () => {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [roundState]);

  return (
    <div
      className="min-h-screen bg-[#3A1920] text-slate-100 flex flex-col font-sans select-none antialiased scrollbar-thin scrollbar-thumb-rose-950"
      id="aviator_application_root"
    >
      {/* Top Banner Header */}
      <header className="bg-[#3A1920]/95 border-b border-[#52252e] p-3 sm:p-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3" id="brand_header_logo_container">
            <a 
              href="#" 
              onClick={(e) => e.preventDefault()} 
              className="flex items-center transition-transform hover:scale-105 duration-200 focus:outline-none"
              title="LETMELMB"
            >
              <img 
                src="https://i.postimg.cc/6p1Pbj3q/LETMELMB.png" 
                alt="LETMELMB" 
                className="h-10 sm:h-12 md:h-14 lg:h-16 w-auto max-w-[220px] sm:max-w-[300px] md:max-w-[360px] object-contain drop-shadow-[0_2px_16px_rgba(244,63,94,0.45)] transition-all duration-300"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                referrerPolicy="no-referrer"
              />
            </a>
          </div>

          {/* Controls: Audio, Help info, Wallet balance */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            
            {/* Audio speaker toggle */}
            <button
              onClick={toggleMute}
              className="p-1.5 text-slate-300 hover:text-white bg-[#281117] hover:bg-[#4A1F29] rounded-lg border border-[#52252e] transition-colors"
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
              id="audio_toggle_btn"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* Admin Ops Terminal Trigger */}
            <button
              onClick={() => {
                audioManager.playClick();
                setIsAdminModalOpen(true);
              }}
              className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                isAdminAuthenticated 
                  ? "bg-rose-950/40 text-rose-400 border-rose-500/30 animate-pulse" 
                  : "text-slate-400 hover:text-slate-200 bg-[#281117] border-[#52252e] hover:bg-[#4A1F29]"
              }`}
              title="Actuary Ops Terminal (Credentials Required)"
              id="admin_ops_trigger_btn"
            >
              <Key size={15} />
            </button>

            {/* Help guidelines modal trigger */}
            <button
              onClick={() => {
                audioManager.playClick();
                setIsHelpOpen(true);
              }}
              className="p-1.5 sm:px-3 sm:py-1.5 text-xs text-slate-300 hover:text-white bg-[#281117] hover:bg-[#4A1F29] rounded-lg border border-[#52252e] flex items-center gap-1 sm:gap-1.5 font-semibold transition"
              id="how_to_play_trigger"
              title="How to play?"
            >
              <HelpCircle size={14} className="text-rose-400 shrink-0" />
              <span className="hidden sm:inline">How to play?</span>
            </button>

            {/* Wallet Balance Container */}
            <div 
              className="relative flex items-center border shadow-lg py-1 sm:py-1.5 px-2.5 sm:px-4 rounded-xl gap-1.5 sm:gap-3 transition-all duration-300 group select-none bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/30 border-emerald-500/40 hover:border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
              id="vip_wallet_glowing_hud"
            >
              <div className="relative flex items-center justify-center p-1 sm:p-1.5 rounded-lg shrink-0 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                <Wallet size={14} className="sm:w-4 sm:h-4 animate-pulse" />
              </div>
              
              <div className="flex flex-col items-end leading-tight shrink-0">
                <span className="text-[7px] sm:text-[8px] font-black tracking-widest font-mono flex items-center gap-1 uppercase text-emerald-400">
                  <span className="w-1 h-1 rounded-full inline-block bg-emerald-400 animate-ping" /> 
                  WALLET BALANCE
                </span>
                <span className="text-xs sm:text-sm md:text-base font-black font-mono tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400">
                  {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="hidden sm:block h-5 w-px bg-slate-800" />

              {/* Action Button: Live Sync with Master Wallet API */}
              <button
                onClick={() => syncRealWallet()}
                disabled={isSyncingRealWallet}
                className="p-1 px-1.5 bg-slate-950 hover:bg-emerald-950/40 rounded border border-slate-900 hover:border-emerald-500/30 transition-all duration-300 shrink-0"
                title="Sync Balance with Seamless Wallet API"
                id="sync_real_wallet_btn"
              >
                <div className="flex items-center gap-1 text-[8px] sm:text-[8.5px] font-bold font-mono">
                  <RotateCcw size={9} className={`transition-transform duration-500 text-emerald-400 ${isSyncingRealWallet ? "animate-spin" : "group-hover:rotate-180"}`} />
                  <span className="text-emerald-400 tracking-tight hidden xs:inline">{isSyncingRealWallet ? "SYNC..." : "SYNC"}</span>
                </div>
              </button>
            </div>
            
          </div>
        </div>
      </header>

      {/* Pre-Game Diagnostics Warnings (only renders after 3 seconds loader finishes) */}
      {!isSplashActive && failedChecks.length > 0 && (
        <div className="bg-rose-950/90 border-b border-rose-500/40 text-rose-200 py-2.5 px-4 text-xs font-mono flex items-center justify-between gap-3 backdrop-blur-sm shadow-lg animate-pulse" id="system_check_warning_banner">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span className="font-bold uppercase tracking-wider">SYSTEM WARNING: PRE-GAME TESTS COMPLETED WITH FAILURES</span>
            <span className="text-slate-300">({failedChecks.join(', ')})</span>
          </div>
          <button 
            onClick={() => setFailedChecks([])}
            className="text-slate-200 hover:text-white border border-[#52252e] hover:border-rose-500/40 bg-[#281117] px-2.5 py-1 rounded text-[10px] font-sans"
          >
            Acknowledge & Dismiss
          </button>
        </div>
      )}

      {/* Refill Notify Toast */}
      {showRefillNotify && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950/90 border border-emerald-500/20 text-emerald-300 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs shadow-xl animate-bounce-short">
          <Sparkles size={14} className="text-emerald-400" />
          <span>Credits Refilled to 150,000!</span>
        </div>
      )}

      {/* Cashback Popup Toast (bottom-right corner) */}
      <div 
        className={`fixed bottom-6 right-6 z-50 bg-[#16080b] border-2 border-[#32CD32] text-white px-5 py-4 rounded-xl shadow-2xl flex flex-col gap-1.5 transition-all duration-300 transform ${
          cashbackPopup.show 
            ? "opacity-100 translate-y-0 scale-100" 
            : "opacity-0 translate-y-4 scale-95 pointer-events-none"
        }`}
        id="cashback_popup_notification"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">💰</span>
          <span className="font-bold tracking-wider text-xs uppercase text-slate-100">
            CASHBACK RECEIVED
          </span>
        </div>
        <div className="text-[14px] font-black text-[#32CD32] font-mono leading-tight">
          +{cashbackPopup.amount.toLocaleString(undefined, { minimumFractionDigits: 1 })}
        </div>
        <div className="text-[10px] text-slate-400 font-medium">
          added to your balance
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-2.5 sm:p-4 flex flex-col gap-3 sm:gap-4 min-h-0">
        
        {/* Horizontal scrollbar of past round coefficient payouts */}
        <HistoryBar history={history} />

        {/* Dashboard Panels Split */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 min-h-0">
          
          {/* Active social participants / Stats (order-2 on mobile, order-1 on desktop) */}
          <div className="order-2 lg:order-1 w-full lg:w-80 shrink-0">
            <BetsList
              playerBets={playerBets}
              myHistory={myHistory}
              roundState={roundState}
              userStats={userStats}
              onResetStats={handleResetStats}
              topBetsHistory={topBetsHistory}
            />
          </div>

          {/* Flying graphics and double Bet controls (order-1 on mobile, order-2 on desktop) */}
          <div className="flex-1 flex flex-col gap-3 sm:gap-4 order-1 lg:order-2 min-w-0">
            
            {/* The interactive Canvas Flying screen */}
            <div className="flex-1 relative min-h-[220px] sm:min-h-[300px] md:min-h-[350px]">
              <GameCanvas
                multiplier={multiplier}
                state={roundState}
                countdown={countdown}
                maxCountdown={maxCountdown}
              />
            </div>

            {/* Independent Dual Betting Input blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <BetPanel
                id="left"
                bet={betLeft}
                roundState={roundState}
                multiplier={multiplier}
                userBalance={balance}
                onPlaceBet={placeBetLeft}
                onCancelBet={cancelBetLeft}
                onCashOut={cashOutLeft}
                onUpdateAutoSettings={updateAutoSettingsLeft}
              />
              <BetPanel
                id="right"
                bet={betRight}
                roundState={roundState}
                multiplier={multiplier}
                userBalance={balance}
                onPlaceBet={placeBetRight}
                onCancelBet={cancelBetRight}
                onCashOut={cashOutRight}
                onUpdateAutoSettings={updateAutoSettingsRight}
              />
            </div>

            {/* Live Performance Loop Visual Curve */}
            <LivePerformanceLoop
              userStats={userStats}
              myHistory={myHistory}
            />

          </div>

        </div>

      </main>

      {/* Interactive Helper Overlay Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* ACTUARIAL OPERATIONS AND ADMINISTRATIVE TERMINAL MODAL */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4" id="admin_terminal_modal">
          <div className="bg-slate-900 border-2 border-rose-600/30 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl shadow-rose-950/30">
            
            {/* Modal Title / Top Bar */}
            <div className="bg-slate-950 px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-rose-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-100 font-mono">
                  Actuary Operations Portal v2.0
                </span>
              </div>
              <button 
                onClick={() => setIsAdminModalOpen(false)}
                className="text-slate-400 hover:text-white font-sans text-xs bg-slate-900 hover:bg-slate-850 px-2.5 py-1 rounded border border-slate-800"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {!isAdminAuthenticated ? (
                /* AUTHENTICATION PATHWAY */
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    audioManager.playClick();
                    if (adminPasswordInput === "sky_ops_2026") {
                      setIsAdminAuthenticated(true);
                      setAdminErrorMessage("");
                    } else {
                      setAdminErrorMessage("ACCESS DENIED: INVALID OPERATIONS KEY");
                    }
                  }}
                  className="flex flex-col gap-4"
                >
                  <div className="text-center mb-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-3 border border-rose-500/20">
                      <Lock size={20} className="text-rose-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200">Credential Clearance Required</h3>
                    <p className="text-[11px] text-slate-500 mt-1">Access restricted to authorized actuarial mechanics and game engineers.</p>
                  </div>

                  {adminErrorMessage && (
                    <div className="bg-rose-950/40 border border-rose-500/20 text-rose-400 text-[10px] px-3 py-2 rounded font-mono text-center uppercase tracking-wider font-bold">
                      {adminErrorMessage}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-widest text-slate-400 font-mono font-bold">Operator ID</label>
                    <input 
                      type="text" 
                      placeholder="e.g. admin" 
                      defaultValue="admin"
                      disabled
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none opacity-60"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-widest text-slate-400 font-mono font-bold">Access Security Key</label>
                    <input 
                      type="password" 
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      placeholder="••••••••••••" 
                      required
                      autoFocus
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-rose-100 focus:outline-none focus:border-rose-500/50"
                    />
                  </div>

                  <div className="flex gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdminModalOpen(false)}
                      className="flex-1 py-2 bg-transparent hover:bg-slate-850 text-slate-400 text-xs rounded-lg transition font-mono uppercase tracking-wider font-black border border-slate-800"
                    >
                      Bail Out
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-lg transition font-mono uppercase tracking-wider font-black shadow-lg shadow-rose-900/30"
                    >
                      Authorize
                    </button>
                  </div>
                  <div className="text-center mt-1">
                    <span className="text-[8px] text-slate-600 font-mono font-bold uppercase tracking-widest block">
                      Hint: passcode is sky_ops_2026
                    </span>
                  </div>
                </form>
              ) : (
                /* ACTUAL ACTUARIAL CONTROL PANEL VIEW */
                <div className="flex flex-col gap-6" id="ops_control_panel_body">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <Unlock size={14} className="text-emerald-500" />
                      <span className="text-[10px] text-emerald-400 font-bold uppercase font-mono tracking-widest">
                        SECURE SESSION ACTIVE
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[9px] text-indigo-400 font-bold uppercase font-mono">
                        ENGINE: {engineMode}
                      </span>
                    </div>
                  </div>

                  {/* Operational Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4 font-mono">
                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Active Room Liability</span>
                      <span className="text-sm font-black text-rose-50">
                        {((betLeft.isPlaced ? betLeft.amount : 0) + (betRight.isPlaced ? betRight.amount : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[8px] text-slate-500 mt-1 leading-none font-sans">Sum of dual real wagers in-room</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Commission Fee (3.5%)</span>
                      <span className="text-sm font-black text-rose-50">
                        {accumulatedFuelTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[8px] text-slate-500 mt-1 leading-none font-sans">Flat 3.5% fee committed at t = 0s</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Swept Fractional Balance</span>
                      <span className="text-sm font-black text-rose-50 break-all">
                        {accumulatedFractionSweep.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                      </span>
                      <span className="text-[8px] text-slate-500 mt-1 leading-none font-sans">Rounding residuals directed to house</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Martingale Progression</span>
                      <span className="text-sm font-black text-rose-50">
                        {isMartingaleAbuse ? "🔥 OVERRIDDEN" : `M_seq = ${consecutiveUserDoubles}`}
                      </span>
                      <span className="text-[8px] text-slate-500 mt-1 leading-none font-sans">Wipes doublers on next round</span>
                    </div>

                    <div className="bg-slate-900 border border-rose-500/10 p-3.5 rounded-xl flex flex-col gap-1 col-span-2">
                      <span className="text-[9px] text-rose-400 uppercase tracking-widest font-black">Infinite Re-Arming Dampener Loop</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs font-mono font-black text-slate-200">
                          {SkyRushEngine.getInstance().postHighCrashCounter > 0 
                            ? `🔥 STATE B: dampening (${SkyRushEngine.getInstance().postHighCrashCounter} cycles left)` 
                            : "🟢 STATE A: monitor active (ready to damp)"}
                        </span>
                        <span className="text-[8px] text-slate-500 font-mono font-bold uppercase tracking-wider bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                          Threshold &gt; 5.50x
                        </span>
                      </div>
                      <span className="text-[8px] text-slate-500 mt-1 leading-snug font-sans">
                        Automatically clamps the next 3 rounds to Early Bracket ([1.00x - 2.00x]) if standard outcome lands &gt; 5.50x, re-arming forever.
                      </span>
                    </div>
                  </div>

                  {/* 📊 8-TIER EXACT MULTIPLIER PROBABILITY & FREQUENCY MATRIX */}
                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <Activity size={12} className="text-amber-400" />
                        8-TIER MULTIPLIER DISTRIBUTION & ROUND FREQUENCY MATRIX
                      </h4>
                      <span className="text-[8px] font-mono font-bold bg-amber-950/50 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded">
                        Target RTP: 85.00% | House Edge: 15.00% (EV+)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[9px] font-mono border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 uppercase text-[8px] bg-slate-900/60">
                            <th className="py-1.5 px-2">ช่วงตัวคูณ (Multiplier)</th>
                            <th className="py-1.5 px-2 text-right">ความน่าจะเป็น (%)</th>
                            <th className="py-1.5 px-2 text-center text-amber-300 font-bold">ความถี่เฉลี่ย (Frequency)</th>
                            <th className="py-1.5 px-2">วัตถุประสงค์ / บทบาทในเกม</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {MULTIPLIER_DISTRIBUTION_MATRIX.map((tier, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-1.5 px-2 font-bold text-slate-200">
                                {tier.label}
                              </td>
                              <td className="py-1.5 px-2 text-right font-black text-rose-300">
                                {tier.probability.toFixed(2)}%
                              </td>
                              <td className="py-1.5 px-2 text-center font-bold text-amber-400 bg-amber-950/10">
                                {tier.averageFrequency}
                              </td>
                              <td className="py-1.5 px-2 text-slate-400 text-[8px] font-sans">
                                {tier.psychologyRole}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 🔒 ACTUARIAL INTEGRITY ENGAGEMENT SYSTEMS (Adaptive Micro-Bust & RTP Safeguards) */}
                  <div className="bg-slate-950/60 border border-indigo-950/60 p-4 rounded-xl flex flex-col gap-3">
                    <h4 className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-indigo-400" />
                      ACTUARIAL SAFES & TRAPS (DEVELOPER MODE)
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3 font-mono">
                      {/* Preempt Trap Card */}
                      <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-lg flex flex-col gap-1">
                        <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black flex items-center gap-1">
                          💣 ACTUARIAL REBALANCE TRAP (45%)
                        </span>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className={`text-[10px] font-black uppercase ${isPreemptTrapActive ? "text-amber-400 animate-pulse" : "text-slate-400"}`}>
                            {isPreemptTrapActive ? "⚠️ ARMED / ACTIVE" : "🟢 STANDBY / SAFE"}
                          </span>
                          <span className="text-[8px] text-slate-500">Rate: 45.0%</span>
                        </div>
                        <span className="text-[8px] text-slate-500 leading-normal font-sans mt-1">
                          Locked ratio: exactly 4.5 traps/10 rounds, 45/100 rounds (proportional).
                        </span>
                      </div>

                      {/* Capital Safeguard Card */}
                      <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-lg flex flex-col gap-1">
                        <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black flex items-center gap-1">
                          🛡️ CAPITAL LIFELINE (&le; 30%)
                        </span>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className={`text-[10px] font-black uppercase ${isInCrisisMode ? "text-emerald-400 animate-bounce" : "text-slate-400"}`}>
                            {isInCrisisMode ? "🚨 ENGAGED" : "🟢 SECURE"}
                          </span>
                          <span className="text-[8px] text-slate-500">
                            Limit: {(sessionEntryBalance * 0.3).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-500 leading-normal font-sans mt-1">
                          Triggers 6.00x+ big payout if balance drops &le; 30% of entry capital ({sessionEntryBalance.toLocaleString()}).
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Manual Override Option */}
                  <div className="bg-rose-950/25 border border-rose-950/60 p-4 rounded-xl flex flex-col gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="text-rose-500 shrink-0 mt-0.5" size={16} />
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-rose-100 uppercase tracking-wider font-mono">Emergency Risk Deflector</h4>
                        <p className="text-[10px] text-rose-400/80 leading-relaxed font-sans mt-0.5">
                          Toggling this manual switch shifts subsequent flight outcomes directly into the severe recovery distribution (crashing randomly between 1.00x and 1.05x), liquidating active stakes instantly to secure desired margins.
                        </p>
                      </div>
                    </div>
                    
                    <div className="border-t border-rose-950/50 pt-2.5 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                        Target Margin Recovery:
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={targetMarginBreachedManual}
                          onChange={(e) => {
                            audioManager.playClick();
                            setTargetMarginBreachedManual(e.target.checked);
                          }}
                          className="sr-only peer"
                          id="admin_recovery_mode_checkbox"
                        />
                        <div className="w-11 h-6 bg-slate-950 rounded-full border border-slate-800 peer peer-checked:after:translate-x-full after:content-[''] after:absolute peer-checked:after:left-[22px] after:top-[3px] after:left-[3px] after:bg-slate-600 peer-checked:after:bg-rose-500 after:border-slate-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-950/60 peer-checked:border-rose-800"></div>
                        <span className="text-[10px] font-mono font-black text-rose-400 ml-2 uppercase tracking-wide">
                          {targetMarginBreachedManual ? "ACTIVE" : "STANDBY"}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Ops Actions */}
                  <div className="flex items-center justify-between border-t border-slate-800/60 pt-4 mt-2">
                    <button
                      onClick={() => {
                        audioManager.playClick();
                        setIsAdminAuthenticated(false);
                        setAdminPasswordInput("");
                      }}
                      className="px-3 py-1.5 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-rose-400 hover:text-rose-300 text-[10px] font-mono uppercase tracking-wider font-extrabold rounded-lg transition"
                      id="admin_logout_btn"
                    >
                      🔒 Lock Session
                    </button>
                    <button
                      onClick={() => setIsAdminModalOpen(false)}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 text-[10px] font-mono uppercase tracking-wider font-extrabold rounded-lg transition"
                    >
                      Hide Portal Interface
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* iGaming Master Franchise Seamless Wallet Hub Modal */}
      <SeamlessWalletModal 
        isOpen={isSeamlessWalletOpen} 
        onClose={() => setIsSeamlessWalletOpen(false)}
      />

      {/* Pre-Game Responsible Gaming Warning Modal */}
      <ResponsibleGamingModal
        isOpen={isResponsibleGamingOpen}
        onClose={() => setIsResponsibleGamingOpen(false)}
      />

      {/* 3-Second Loading / Splash Screen Overlay */}
      {isSplashActive && (
        <div 
          className={`fixed inset-0 bg-[#0a0a1a] z-[9999] flex flex-row transition-opacity duration-800 ${
            isFadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          id="game_splash_screen"
        >
          {/* LEFT COLUMN (80% width on wider screens, 85% on mobile ≤ 600px) */}
          <div className="w-[80%] max-[600px]:w-[85%] h-screen bg-[#0a0a1a] flex items-center justify-center shrink-0 overflow-hidden relative">
            <img 
              src="https://i.postimg.cc/RZMGKtYM/1780092343682css.webp" 
              alt="Sky Rush Cover Side" 
              className="w-full h-full object-contain select-none block"
              referrerPolicy="no-referrer"
              id="splash_cover_image"
            />
          </div>

          {/* RIGHT COLUMN (20% width on wider screens, 15% on mobile ≤ 600px) */}
          <div className="w-[20%] max-[600px]:w-[15%] h-screen bg-[#0a0a1a] flex flex-col justify-center items-center py-8 px-2 shrink-0 relative gap-5 select-none">
            {/* 1. "LOADING" text */}
            <span className="text-white text-[10px] min-[601px]:text-xs font-mono font-bold tracking-[2px] uppercase select-none">
              LOADING
            </span>

            {/* 2. Progress bar — VERTICAL orientation (Fills bottom-to-top) */}
            <div className="relative w-[10px] h-[200px] bg-slate-950 border border-slate-900 rounded-full overflow-hidden p-[1px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] flex flex-col justify-end">
              <div 
                className="w-full rounded-full bg-gradient-to-t from-[#ff2d78] to-[#7b2fff] transition-all duration-75"
                style={{ 
                  height: `${splashProgress}%`,
                  boxShadow: "0 0 10px #ff2d78"
                }}
              />
            </div>

            {/* 3. Percentage number below the bar */}
            <div className="text-white font-bold font-mono text-[11px] min-[601px]:text-xs tracking-wider">
              {splashProgress}%
            </div>

            {/* 4. Status text (small, gray) */}
            <span className="text-slate-500 font-mono text-[9px] min-[601px]:text-[10px] uppercase tracking-wide text-center max-w-full px-1">
              {splashProgress <= 30 && "Initializing..."}
              {splashProgress > 30 && splashProgress <= 60 && "Loading..."}
              {splashProgress > 60 && splashProgress <= 90 && "Preparing..."}
              {splashProgress > 90 && "Ready!"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
