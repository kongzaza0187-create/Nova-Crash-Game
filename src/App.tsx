import { useState, useEffect, useRef } from "react";
import { GameCanvas } from "./components/GameCanvas";
import { BetPanel } from "./components/BetPanel";
import { BetsList } from "./components/BetsList";
import { HelpModal } from "./components/HelpModal";
import { audioManager } from "./audio";
import { Bet, PlayerBet, RoundState, HistoryItem, UserStats } from "./types";
import { SkyRushEngine, BetSlip, GameRoomState } from "./lib/SkyRushEngine";
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
  Unlock
} from "lucide-react";

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
  const [roundState, setRoundState] = useState<RoundState>("WAITING");
  const [multiplier, setMultiplier] = useState<number>(1.00);
  const [countdown, setCountdown] = useState<number>(5.0);
  const maxCountdown = 5.0;

  // Wallet
  const [balance, setBalance] = useState<number>(9999999);
  const [showRefillNotify, setShowRefillNotify] = useState<boolean>(false);

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
  const [backendAiInsights, setBackendAiInsights] = useState<{
    totalAnalyzed: number;
    averageCashoutPoint: number;
    predictedPeakRiskPoint: number;
    targetRtpPercent: number;
    houseEdgePercent: number;
    jackpotCyclesCount: string;
    jackpotsScheduledThisCycle: number[];
  } | null>(null);

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

  // Sync state values with reference handles to bypass dependency-array resets
  const balanceRef = useRef(balance);
  const historyRef = useRef(history);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

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
      preFetchNextRoundFromBackend();
    }
  }, [roundState]);

  // Initial insights fetch at app load
  useEffect(() => {
    fetchAiInsightsFromBackend();
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
            const dummyRoom = { totalRealLiabilityTHB: 0, globalCrashMultiplier: 1.00 };
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
            const testResultPt = generateNewCrashPoint(false);
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
      const response = await fetch("/api/security/round/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.crashPointOverride === "number") {
          nextRoundDataRef.current = {
            crashPoint: data.crashPointOverride,
            isJackpotRound: data.isJackpotRound || false,
            currentCycleRoundNum: data.currentCycleRoundNum || 1
          };
          fetchAiInsightsFromBackend();
          return;
        }
      }
    } catch (err) {
      console.warn("Backend pre commitment offline, falling back to local client seed engine.");
    }
    nextRoundDataRef.current = null; // Fallback to local
  };

  const fetchAiInsightsFromBackend = async () => {
    try {
      const response = await fetch("/api/security/ai/insights");
      if (response.ok) {
        const data = await response.json();
        setBackendAiInsights(data);
      }
    } catch (err) {
      console.error("Failed to fetch backend AI insights", err);
    }
  };

  const logPlayerCashoutToBackend = async (multiplier: number) => {
    try {
      await fetch("/api/security/ai/cashout-metric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplierCashed: multiplier })
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

  // Helper to retrieve fuel tax rate/amount dynamically from SkyRushEngine
  const getTaxForWager = (amount: number): number => {
    const engine = SkyRushEngine.getInstance();
    return engine.processAsymmetricTax({ userId: "USER_1", betAmountTHB: amount });
  };

  // Pre-calculations for generating random crash targets under Server-Authoritative Math specs
  const generateNewCrashPoint = (isAbuseDirect: boolean) => {
    // If we have securely generated a crash target from the backend, inject it as the master source of truth
    if (nextRoundDataRef.current && typeof nextRoundDataRef.current.crashPoint === "number") {
      const backendVal = nextRoundDataRef.current.crashPoint;
      setCurrentRoundIsJackpot(nextRoundDataRef.current.isJackpotRound);
      setCycleRoundNum(nextRoundDataRef.current.currentCycleRoundNum);
      
      // Clear for the next round
      nextRoundDataRef.current = null;
      setEngineMode(isAbuseDirect ? "MARTINGALE_OVERRIDE" : "SERVER_ORACLE_AI");
      return backendVal;
    }

    // Otherwise, execute the classic local state system fallback
    let totalRealLiabilityTHB = 0;
    if (betLeft.isPlaced) totalRealLiabilityTHB += betLeft.amount;
    if (betRight.isPlaced) totalRealLiabilityTHB += betRight.amount;

    const roomState: GameRoomState = {
      totalRealLiabilityTHB,
      globalCrashMultiplier: 1.00
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
    return result.multiplier;
  };

  // Simulated multiplayer bots builder
  const spawnSimulatedBots = () => {
    const count = 10 + Math.floor(Math.random() * 10);
    const bots: PlayerBet[] = [];
    const shuffledNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const name = shuffledNames[i] || `User_${Math.floor(Math.random() * 9000)}`;
      const amount = [50, 100, 200, 300, 500, 1000, 2000, 5000][Math.floor(Math.random() * 8)];
      
      // Predict a target multiplier for this bot
      // Some are highly conservative, some optimistic, some exceed current crash multiplier (leading to bust)
      const targetPref = Math.random() < 0.35 ? 1.2 + Math.random() * 0.5 : 1.7 + Math.random() * 4;
      const targetMultiplier = parseFloat(targetPref.toFixed(2));

      bots.push({
        id: `bot_${Date.now()}_${i}`,
        name,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!,
        avatarSeed: AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)]!,
        amount,
        isCashedOut: false,
        isBust: false,
        // Hidden meta parameter
        ...( { targetMultiplier } as any )
      });
    }
    setPlayerBets(bots);
  };

  // Reset demo credits
  const refillCredits = () => {
    audioManager.playCashOut();
    setBalance(9999999);
    setShowRefillNotify(true);
    setTimeout(() => setShowRefillNotify(false), 3000);
  };

  // Manual reset of Stats
  const handleResetStats = () => {
    audioManager.playClick();
    setUserStats({
      winCount: 0,
      totalBets: 0,
      totalWagered: 0,
      totalWon: 0,
      netProfit: 0,
    });
    setMyHistory([]);
  };

  // Placing individual bets with Asymmetric 3-Tiered non-refundable fuel tax fee
  const placeBetLeft = (amount: number) => {
    const tax = getTaxForWager(amount);
    const totalCost = amount + tax;
    if (balance >= totalCost) {
      audioManager.playBetPlaced();
      setBalance((prev) => parseFloat((prev - totalCost).toFixed(2)));
      setAccumulatedFuelTax(SkyRushEngine.getInstance().accumulatedFuelTaxTHB);
      setBetLeft((prev) => ({ ...prev, amount, isPlaced: true, hasCashedOut: false }));
    } else {
      audioManager.playClick();
    }
  };

  const placeBetRight = (amount: number) => {
    const tax = getTaxForWager(amount);
    const totalCost = amount + tax;
    if (balance >= totalCost) {
      audioManager.playBetPlaced();
      setBalance((prev) => parseFloat((prev - totalCost).toFixed(2)));
      setAccumulatedFuelTax(SkyRushEngine.getInstance().accumulatedFuelTaxTHB);
      setBetRight((prev) => ({ ...prev, amount, isPlaced: true, hasCashedOut: false }));
    } else {
      audioManager.playClick();
    }
  };

  // Fuel tax is completely non-refundable once committed. Refunds only revert the base wager amount.
  const cancelBetLeft = () => {
    audioManager.playClick();
    if (betLeft.isPlaced) {
      setBalance((prev) => parseFloat((prev + betLeft.amount).toFixed(2)));
      setBetLeft((prev) => ({ ...prev, isPlaced: false }));
    }
  };

  const cancelBetRight = () => {
    audioManager.playClick();
    if (betRight.isPlaced) {
      setBalance((prev) => parseFloat((prev + betRight.amount).toFixed(2)));
      setBetRight((prev) => ({ ...prev, isPlaced: false }));
    }
  };

  // Executing user cashout operations with decimal truncation & faction sweep (Pillar 5)
  const cashOutLeft = () => {
    if (roundState !== "FLYING" || !betLeft.isPlaced || betLeft.hasCashedOut) return;
    
    const curMultiplier = multiplierRef.current;
    const rawWinnings = betLeft.amount * curMultiplier;
    
    const engine = SkyRushEngine.getInstance();
    const { payout, swept } = engine.truncatePayoutAndSweep(rawWinnings);
    setAccumulatedFractionSweep(engine.accumulatedFractionSweepTHB);
    
    audioManager.playCashOut();
    
    setBalance((prev) => parseFloat((prev + payout).toFixed(2)));
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
      totalWagered: prev.totalWagered + betLeft.amount,
      totalWon: prev.totalWon + payout,
      netProfit: prev.netProfit + (payout - betLeft.amount),
    }));

    // Log history
    setMyHistory((prev) => [
      {
        id: `my_bet_${Date.now()}_l`,
        amount: betLeft.amount,
        multiplier: curMultiplier,
        winAmount: payout,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
      ...prev,
    ]);
  };

  const cashOutRight = () => {
    if (roundState !== "FLYING" || !betRight.isPlaced || betRight.hasCashedOut) return;
    
    const curMultiplier = multiplierRef.current;
    const rawWinnings = betRight.amount * curMultiplier;
    
    const engine = SkyRushEngine.getInstance();
    const { payout, swept } = engine.truncatePayoutAndSweep(rawWinnings);
    setAccumulatedFractionSweep(engine.accumulatedFractionSweepTHB);
    
    audioManager.playCashOut();
    
    setBalance((prev) => parseFloat((prev + payout).toFixed(2)));
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
      totalWagered: prev.totalWagered + betRight.amount,
      totalWon: prev.totalWon + payout,
      netProfit: prev.netProfit + (payout - betRight.amount),
    }));

    // Log history
    setMyHistory((prev) => [
      {
        id: `my_bet_${Date.now()}_r`,
        amount: betRight.amount,
        multiplier: curMultiplier,
        winAmount: payout,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
      ...prev,
    ]);
  };

  const updateAutoSettingsLeft = (isAutoBet: boolean, isAutoCashOut: boolean, autoMultiplier: number) => {
    setBetLeft((prev) => ({
      ...prev,
      isAutoBet,
      isAutoCashOut,
      autoCashOutMultiplier: autoMultiplier,
    }));
  };

  const updateAutoSettingsRight = (isAutoBet: boolean, isAutoCashOut: boolean, autoMultiplier: number) => {
    setBetRight((prev) => ({
      ...prev,
      isAutoBet,
      isAutoCashOut,
      autoCashOutMultiplier: autoMultiplier,
    }));
  };

  // Main State and loop coordinator
  useEffect(() => {
    // WAITING state initiator
    if (roundState === "WAITING") {
      timeElapsedRef.current = 0;
      setMultiplier(1.00);
      setCountdown(maxCountdown);
      spawnSimulatedBots();

      // Trigger automatic placing of user bets with Asymmetric Fuel Tax applied
      if (betLeft.isAutoBet && !betLeft.isPlaced) {
        const tax = getTaxForWager(betLeft.amount);
        const totalCost = betLeft.amount + tax;
        if (balance >= totalCost) {
          audioManager.playBetPlaced();
          setBalance((prev) => parseFloat((prev - totalCost).toFixed(2)));
          setAccumulatedFuelTax(SkyRushEngine.getInstance().accumulatedFuelTaxTHB);
          setBetLeft((prev) => ({ ...prev, isPlaced: true, hasCashedOut: false }));
        }
      }
      if (betRight.isAutoBet && !betRight.isPlaced) {
        const tax = getTaxForWager(betRight.amount);
        const totalCost = betRight.amount + tax;
        if (balance >= totalCost) {
          audioManager.playBetPlaced();
          setBalance((prev) => parseFloat((prev - totalCost).toFixed(2)));
          setAccumulatedFuelTax(SkyRushEngine.getInstance().accumulatedFuelTaxTHB);
          setBetRight((prev) => ({ ...prev, isPlaced: true, hasCashedOut: false }));
        }
      }

      // Interval countdown ticks
      intervalIdRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 0.1) {
            clearInterval(intervalIdRef.current);
            // Transition into Flying state!
            setMultiplier(1.00);

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
            return 0;
          }
          return parseFloat((prev - 0.1).toFixed(1));
        });
      }, 100);
    }

    // FLYING state loop
    if (roundState === "FLYING") {
      let startTime = Date.now();
      
      intervalIdRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        timeElapsedRef.current = elapsed;

        // Smooth growth curve: starts flat and speeds up
        const curMultiplier = 1.00 + 0.05 * Math.pow(elapsed, 1.45);
        
        // Critical block: Crash Point reached
        if (curMultiplier >= crashMultiplierRef.current) {
          clearInterval(intervalIdRef.current);
          setMultiplier(crashMultiplierRef.current);
          setRoundState("FLEW_AWAY");
          audioManager.playFlewAway();
          return;
        }

        setMultiplier(curMultiplier);
        audioManager.updateEngine(curMultiplier);

        // Simulated other players cashouts in real-time
        setPlayerBets((prev) =>
          prev.map((player: any) => {
            if (!player.isCashedOut && !player.isBust) {
              if (curMultiplier >= player.targetMultiplier) {
                return {
                  ...player,
                  isCashedOut: true,
                  cashOutMultiplier: player.targetMultiplier,
                };
              }
            }
            return player;
          })
        );

        // Auto Cash Out monitors with dec truncation & faction sweep (Pillar 5)
        if (betLeft.isPlaced && !betLeft.hasCashedOut && betLeft.isAutoCashOut) {
          if (curMultiplier >= betLeft.autoCashOutMultiplier) {
            // Self cash out left
            const rawWinnings = betLeft.amount * betLeft.autoCashOutMultiplier;
            const engine = SkyRushEngine.getInstance();
            const { payout, swept } = engine.truncatePayoutAndSweep(rawWinnings);
            setAccumulatedFractionSweep(engine.accumulatedFractionSweepTHB);

            setBalance((prev) => parseFloat((prev + payout).toFixed(2)));
            setBetLeft((prev) => ({
              ...prev,
              hasCashedOut: true,
              cashedOutMultiplier: betLeft.autoCashOutMultiplier,
              winAmount: payout,
            }));

            logPlayerCashoutToBackend(betLeft.autoCashOutMultiplier);

            // Stats
            setUserStats((prev) => ({
              ...prev,
              winCount: prev.winCount + 1,
              totalBets: prev.totalBets + 1,
              totalWagered: prev.totalWagered + betLeft.amount,
              totalWon: prev.totalWon + payout,
              netProfit: prev.netProfit + (payout - betLeft.amount),
            }));

            // History
            setMyHistory((prev) => [
              {
                id: `my_bet_${Date.now()}_l_auto`,
                amount: betLeft.amount,
                multiplier: betLeft.autoCashOutMultiplier,
                winAmount: payout,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              },
              ...prev,
            ]);
            audioManager.playCashOut();
          }
        }

        if (betRight.isPlaced && !betRight.hasCashedOut && betRight.isAutoCashOut) {
          if (curMultiplier >= betRight.autoCashOutMultiplier) {
            // Self cash out right
            const rawWinnings = betRight.amount * betRight.autoCashOutMultiplier;
            const engine = SkyRushEngine.getInstance();
            const { payout, swept } = engine.truncatePayoutAndSweep(rawWinnings);
            setAccumulatedFractionSweep(engine.accumulatedFractionSweepTHB);

            setBalance((prev) => parseFloat((prev + payout).toFixed(2)));
            setBetRight((prev) => ({
              ...prev,
              hasCashedOut: true,
              cashedOutMultiplier: betRight.autoCashOutMultiplier,
              winAmount: payout,
            }));

            logPlayerCashoutToBackend(betRight.autoCashOutMultiplier);

            // Stats
            setUserStats((prev) => ({
              ...prev,
              winCount: prev.winCount + 1,
              totalBets: prev.totalBets + 1,
              totalWagered: prev.totalWagered + betRight.amount,
              totalWon: prev.totalWon + payout,
              netProfit: prev.netProfit + (payout - betRight.amount),
            }));

            // History
            setMyHistory((prev) => [
              {
                id: `my_bet_${Date.now()}_r_auto`,
                amount: betRight.amount,
                multiplier: betRight.autoCashOutMultiplier,
                winAmount: payout,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              },
              ...prev,
            ]);
            audioManager.playCashOut();
          }
        }

      }, 40); // 25 frames per second updates
    }

    // FLEW AWAY transition timers (Pillar 6)
    if (roundState === "FLEW_AWAY") {
      audioManager.stopEngine();
      
      const crashPointVal = crashMultiplierRef.current;

      // Update Simulated other players to either cased out or BUST
      setPlayerBets((prev) =>
        prev.map((player) => {
          if (!player.isCashedOut) {
            return { ...player, isBust: true };
          }
          return player;
        })
      );

      // Evaluate if player lost any committed bets this round
      let userLostThisRound = false;
      if (betLeft.isPlaced && !betLeft.hasCashedOut) {
        userLostThisRound = true;
      }
      if (betRight.isPlaced && !betRight.hasCashedOut) {
        userLostThisRound = true;
      }
      setLastRoundResultWasLoss(userLostThisRound);

      // Cashback calculations
      let totalCashbackThisRound = 0;
      let leftCashback = 0;
      let rightCashback = 0;

      if (betLeft.isPlaced && !betLeft.hasCashedOut) {
        leftCashback = parseFloat((betLeft.amount * 0.10).toFixed(2));
        totalCashbackThisRound += leftCashback;
      }
      if (betRight.isPlaced && !betRight.hasCashedOut) {
        rightCashback = parseFloat((betRight.amount * 0.10).toFixed(2));
        totalCashbackThisRound += rightCashback;
      }

      if (totalCashbackThisRound > 0) {
        setBalance((prev) => parseFloat((prev + totalCashbackThisRound).toFixed(2)));
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
          netProfit: prev.netProfit - betLeft.amount,
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
          netProfit: prev.netProfit - betRight.amount,
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
      intervalIdRef.current = setTimeout(() => {
        setRoundState("WAITING");
      }, 3000);
    }

    return () => {
      if (intervalIdRef.current) {
        if (roundState === "WAITING" || roundState === "FLYING") {
          clearInterval(intervalIdRef.current);
        } else {
          clearTimeout(intervalIdRef.current);
        }
      }
    };
  }, [roundState]);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased scrollbar-thin scrollbar-thumb-slate-800"
      id="aviator_application_root"
    >
      {/* Top Banner Header */}
      <header className="bg-slate-950/80 border-b border-slate-900/60 p-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo Name & Icon */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/30">
              <Plane size={22} className="rotate-0 transition-transform active:rotate-12 duration-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-tight font-display">
                <span className="text-xl font-black italic uppercase tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-rose-100 to-rose-400">
                  SKY RUSH
                </span>
                <span className="text-[10px] bg-rose-600/20 text-rose-400 font-extrabold px-1.5 py-0.5 rounded-full border border-rose-500/10">
                  CRASH
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide">BollyGaming Pilot Hub</p>
            </div>
          </div>

          {/* Controls: Audio, Help info, Wallet balance */}
          <div className="flex items-center gap-4">
            
            {/* Audio speaker toggle */}
            <button
              onClick={toggleMute}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg border border-slate-900 transition-colors"
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
              id="audio_toggle_btn"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
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
                  : "text-slate-500 hover:text-slate-300 bg-transparent border-slate-900 hover:bg-slate-900"
              }`}
              title="Actuary Ops Terminal (Credentials Required)"
              id="admin_ops_trigger_btn"
            >
              <Key size={16} />
            </button>

            {/* Help guidelines modal trigger */}
            <button
              onClick={() => {
                audioManager.playClick();
                setIsHelpOpen(true);
              }}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg border border-slate-900 flex items-center gap-1.5 font-semibold transition"
              id="how_to_play_trigger"
            >
              <HelpCircle size={14} className="text-rose-500" /> How to play?
            </button>

            {/* Demo wallet credit container */}
            <div className="flex items-center bg-slate-900 border border-slate-850 py-1 px-3 rounded-xl gap-2.5">
              <div className="text-rose-400 p-0.5">
                <Wallet size={16} />
              </div>
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Balance</span>
                <span className="text-xs font-black text-rose-50 font-mono tracking-tight">
                  {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10.5px] text-slate-400">THB</span>
                </span>
              </div>
              
              {/* Quick refill action button */}
              <button
                onClick={refillCredits}
                className="p-1 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-rose-400 transition"
                title="Refill Credits / เติมเครดิต"
                id="refill_credits_btn"
              >
                <RotateCcw size={13} />
              </button>
            </div>
            
          </div>
        </div>
      </header>

      {/* Pre-Game Diagnostics Warnings (only renders after 3 seconds loader finishes) */}
      {!isSplashActive && failedChecks.length > 0 && (
        <div className="bg-rose-950/80 border-b border-rose-500/30 text-rose-300 py-3 px-4 text-xs font-mono flex items-center justify-between gap-3 backdrop-blur-sm shadow-lg animate-pulse" id="system_check_warning_banner">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span className="font-bold uppercase tracking-wider">SYSTEM WARNING: PRE-GAME TESTS COMPLETED WITH FAILURES</span>
            <span className="text-slate-400">({failedChecks.join(', ')})</span>
          </div>
          <button 
            onClick={() => setFailedChecks([])}
            className="text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900 px-2.5 py-1 rounded text-[10px] font-sans"
          >
            Acknowledge & Dismiss
          </button>
        </div>
      )}

      {/* Refill Notify Toast */}
      {showRefillNotify && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950/90 border border-emerald-500/20 text-emerald-300 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs shadow-xl animate-bounce-short">
          <Sparkles size={14} className="text-emerald-400" />
          <span>Credits Refilled to 9,999,999 THB!</span>
        </div>
      )}

      {/* Cashback Popup Toast (bottom-right corner) */}
      <div 
        className={`fixed bottom-6 right-6 z-50 bg-[#0e0e1a] border-2 border-[#32CD32] text-white px-5 py-4 rounded-xl shadow-2xl flex flex-col gap-1.5 transition-all duration-300 transform ${
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
          +{cashbackPopup.amount.toLocaleString(undefined, { minimumFractionDigits: 1 })} THB
        </div>
        <div className="text-[10px] text-slate-400 font-medium">
          added to your balance
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col gap-4 min-h-0">
        
        {/* Horizontal scrollbar of past round coefficient payouts */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 select-none scrollbar-none" id="history_bar">
          <div className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 font-mono">
            <TrendingUp size={11} className="text-slate-500" /> History:
          </div>
          <div className="flex items-center gap-1.5">
            {history.map((item, idx) => (
              <span
                key={item.id}
                className={`text-[10px] font-black px-2 py-0.5 rounded font-mono border ${
                  item.val >= 10.0
                    ? "bg-fuchsia-950/50 text-fuchsia-400 border-fuchsia-500/20"
                    : item.val >= 2.0
                    ? "bg-violet-950/50 text-violet-400 border-violet-500/20"
                    : "bg-slate-900 text-blue-400 border-blue-500/10"
                } ${idx === 0 ? "scale-105 border-rose-500/20 shadow-rose-950/20 shadow animate-pinRight" : "opacity-80"}`}
                id={`history_pill_${idx}`}
              >
                {item.val.toFixed(2)}x
              </span>
            ))}
          </div>
        </div>



        {/* Dashboard Panels Split */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          
          {/* Left panel: Active social participants / Stats */}
          <BetsList
            playerBets={playerBets}
            myHistory={myHistory}
            roundState={roundState}
            multiplier={multiplier}
            userStats={userStats}
            onResetStats={handleResetStats}
          />

          {/* Right panel: Flying graphics and double Bet controls */}
          <div className="flex-1 flex flex-col gap-4">
            
            {/* The interactive SVG/Canvas Flying screen */}
            <div className="flex-1 relative min-h-[350px]">
              <GameCanvas
                multiplier={multiplier}
                state={roundState}
                countdown={countdown}
                maxCountdown={maxCountdown}
              />
            </div>

            {/* Independent Dual Betting Input blocks */}
            <div className="flex flex-col md:flex-row gap-4">
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

            {/* Custom Promo/Banner Image Container */}
            <div 
              className="w-full bg-[#0a0a1a] rounded-[12px] border border-[rgba(255,255,255,0.1)] p-[10px] mt-[10px] overflow-hidden"
              id="bet_panel_promo_image_container"
            >
              <img 
                src="https://i.postimg.cc/hGhfZN15/file-00000000bba47208bb451deb352ca2f2.webp" 
                alt="Sky Rush Promotion Banner" 
                className="w-full h-auto object-contain rounded-[8px] block"
                referrerPolicy="no-referrer"
                id="bet_panel_promo_image"
              />
            </div>

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
                        {((betLeft.isPlaced ? betLeft.amount : 0) + (betRight.isPlaced ? betRight.amount : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-400">THB</span>
                      </span>
                      <span className="text-[8px] text-slate-500 mt-1 leading-none font-sans">Sum of dual real wagers in-room</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Cumulative Fuel Tax</span>
                      <span className="text-sm font-black text-rose-50">
                        {accumulatedFuelTax.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-400">THB</span>
                      </span>
                      <span className="text-[8px] text-slate-500 mt-1 leading-none font-sans">Tiered fees committed at t = 0s</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Swept Fractional Satangs</span>
                      <span className="text-sm font-black text-rose-50 break-all">
                        {accumulatedFractionSweep.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })} <span className="text-[10px] text-slate-400">THB</span>
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
