import { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Square, 
  Pause, 
  Camera, 
  FileText, 
  Settings, 
  Clock, 
  Volume2, 
  Bell, 
  VolumeX, 
  Activity,
  Globe,
  Loader2,
  Table,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Cpu,
  Eye,
  Target,
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  Database,
  Save,
  History,
  User as UserIcon,
  ShieldAlert,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, getDoc, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, Timestamp, serverTimestamp } from "firebase/firestore";

import { LogEntry, FocusMode, WebhookConfig } from "./types";
import { PerformanceCharts } from "./components/PerformanceCharts";
import { DrawingCanvas } from "./components/DrawingCanvas";
import { AudioPanel } from "./components/AudioPanel";
import { TeamPanel } from "./components/TeamPanel";
import { AIPanel } from "./components/AIPanel";
import { GmailPanel } from "./components/GmailPanel";
import { PremiumStrategiesPanel } from "./components/PremiumStrategiesPanel";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { CloudHistoryDrawer } from "./components/CloudHistoryDrawer";
import { MultiTimeframeEngine, TimeframeAnalysis, ConfluenceResult } from "./components/MultiTimeframeEngine";
import { VerifyPaymentModal } from "./components/VerifyPaymentModal";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevPixelsRef = useRef<Uint8ClampedArray | null>(null);

  // Connection & Capture Status
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [rawFps, setRawFps] = useState<number>(0);
  const [pixelDelta, setPixelDelta] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(0);
  const [detectionsCount, setDetectionsCount] = useState<number>(0);
  const [alertsCount, setAlertsCount] = useState<number>(0);

  // Scrolling logs
  const [logs, setLogs] = useState<LogEntry[]>([
    { ts: "00:00:00", msg: "Dashboard initialized in full-stack mode.", type: "info" }
  ]);

  // Rolling Histories for Sparklines
  const [fpsHistory, setFpsHistory] = useState<number[]>(new Array(60).fill(0));
  const [deltaHistory, setDeltaHistory] = useState<number[]>(new Array(60).fill(0));
  const [ocrConfHistory, setOcrConfHistory] = useState<number[]>(new Array(60).fill(0));
  const [priceHistory, setPriceHistory] = useState<number[]>(new Array(60).fill(0));

  // Settings configurations states
  const [keywords, setKeywords] = useState<string[]>([
    "breakout", 
    "buy", 
    "sell", 
    "level", 
    "support", 
    "resistance",
    "hammer",
    "pin bar",
    "engulfing",
    "doji"
  ]);
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState<boolean>(true);
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean>(false);
  const [feedVoiceToAI, setFeedSpeechToAI] = useState<boolean>(false);
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [latestOcrText, setLatestOcrText] = useState<string>("");
  const [currentConf, setCurrentConf] = useState<number>(0);
  const [priceTrend, setPriceTrend] = useState<string>("");

  // Region of Interest (ROI) Boundaries
  const [roiEnabled, setRoiEnabled] = useState<boolean>(false);
  const [roiX, setRoiX] = useState<number>(0);
  const [roiY, setRoiY] = useState<number>(0);
  const [roiW, setRoiW] = useState<number>(800);
  const [roiH, setRoiH] = useState<number>(450);

  // Settings and Webhooks Lists
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [ocrIntervalMethod, setOcrIntervalMethod] = useState<string>("adaptive");
  const [minOcrConf, setMinOcrConf] = useState<number>(40);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [customFocusModes, setCustomFocusModes] = useState<FocusMode[]>([
    { id: "custom_crypto", name: "Crypto Options Flow", prompt: "Summarize major volume spikes and options bid spreads visible on screen." }
  ]);

  // P2P/AI synchronized fields
  const [p2pSharedImage, setP2pSharedImage] = useState<string | null>(null);
  const [p2pSharedAI, setP2pSharedAI] = useState<string | null>(null);
  const [latestAIResponse, setLatestAIResponse] = useState<string>("");

  // Candlestick Bible Simulator & levels states
  const [simMarketStructure, setSimMarketStructure] = useState<"trending-up" | "trending-down" | "range-bound">("trending-up");
  const [simFocusPattern, setSimFocusPattern] = useState<"pinbar" | "engulfing" | "insidebar" | "doji" | "none">("pinbar");
  const [resistancePriceY, setResistancePriceY] = useState<number>(180);
  const [supportPriceY, setSupportPriceY] = useState<number>(480);
  const [caAlertPlay, setCaAlertPlay] = useState<boolean>(true);

  // Interactive simulated trading terminal and accuracy states
  const [traderBalance, setTraderBalance] = useState<number>(10000);
  const [riskPercentage, setRiskPercentage] = useState<number>(2); // Default to 2% risk-per-trade
  const [activeTrade, setActiveTrade] = useState<{
    id: string;
    type: "BUY" | "SELL";
    entryPrice: number;
    size: number;
    tp: number;
    sl: number;
    pattern: string;
    openedAt: string;
  } | null>(null);
  const [closedTrades, setClosedTrades] = useState<{
    id: string;
    type: "BUY" | "SELL";
    entryPrice: number;
    closedPrice: number;
    size: number;
    tp: number;
    sl: number;
    pattern: string;
    openedAt: string;
    closedAt: string;
    pnl: number;
    result: "won" | "lost";
  }[]>([]);
  const [currentSimPrice, setCurrentSimPrice] = useState<number>(67420.50);

  // Synchronized refs to prevent stale enclosure inside requestAnimationFrame capture loops
  const activeTradeRef = useRef<any | null>(null);
  const traderBalanceRef = useRef<number>(10000);

  // Timers and frequencies refs
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const isOCRBusy = useRef<boolean>(false);
  const lastAlertMsRef = useRef<number>(0);
  const ocrWorkerRef = useRef<any>(null);

  // Start elapsed timer state
  const [sessionTime, setSessionTime] = useState<string>("00:00:00");
  const sessionStartRef = useRef<number | null>(null);

  // Create audit log utility
  const addLog = (msg: string, type: LogEntry["type"] = "info") => {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [{ ts: timestamp, msg, type }, ...prev.slice(0, 199)]);
  };

  // Automated Trading Terminal & Accuracy Engine helpers
  const checkActiveTradeTriggers = (price: number) => {
    const trade = activeTradeRef.current;
    if (!trade) return;

    let triggered = false;
    let result: "won" | "lost" = "won";
    let exitPrice = price;

    if (trade.type === "BUY") {
      if (price >= trade.tp) {
        triggered = true;
        result = "won";
        exitPrice = trade.tp;
      } else if (price <= trade.sl) {
        triggered = true;
        result = "lost";
        exitPrice = trade.sl;
      }
    } else { // SELL
      if (price <= trade.tp) {
        triggered = true;
        result = "won";
        exitPrice = trade.tp;
      } else if (price >= trade.sl) {
        triggered = true;
        result = "lost";
        exitPrice = trade.sl;
      }
    }

    if (triggered) {
      const pnl = trade.type === "BUY"
        ? (exitPrice - trade.entryPrice) * trade.size
        : (trade.entryPrice - exitPrice) * trade.size;

      const newBalance = traderBalanceRef.current + pnl;
      traderBalanceRef.current = newBalance;
      setTraderBalance(newBalance);

      const closed = {
        ...trade,
        closedPrice: exitPrice,
        closedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        pnl,
        result
      };

      setClosedTrades((prev) => [closed, ...prev]);
      activeTradeRef.current = null;
      setActiveTrade(null);

      if (result === "won") {
        addLog(`🎯 HIT TAKE PROFIT! ${trade.type} trade won: +$${pnl.toFixed(2)} USD (Setup was ${trade.pattern})`, "success");
      } else {
        addLog(`🛑 HIT STOP LOSS. ${trade.type} trade stopped out: $${pnl.toFixed(2)} USD (Setup was ${trade.pattern})`, "error");
      }
    }
  };

  const handleCloseActiveTrade = () => {
    const trade = activeTradeRef.current;
    if (!trade) return;

    const exitPrice = currentSimPrice;
    const pnl = trade.type === "BUY"
      ? (exitPrice - trade.entryPrice) * trade.size
      : (trade.entryPrice - exitPrice) * trade.size;

    const newBalance = traderBalanceRef.current + pnl;
    traderBalanceRef.current = newBalance;
    setTraderBalance(newBalance);

    const closed = {
      ...trade,
      closedPrice: exitPrice,
      closedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      pnl,
      result: pnl >= 0 ? ("won" as const) : ("lost" as const)
    };

    setClosedTrades((prev) => [closed, ...prev]);
    activeTradeRef.current = null;
    setActiveTrade(null);

    addLog(`Manually closed ${trade.type} position at $${exitPrice.toFixed(2)} USD. PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`, pnl >= 0 ? "success" : "error");
  };

  const handleOpenSimTrade = (type: "BUY" | "SELL") => {
    if (!isSimulating) {
      addLog("To place simulated trades, first turn on the 'Candlestick Bible Studio' Simulation.", "error");
      return;
    }
    if (activeTradeRef.current) {
      addLog("An active position is already open. Only 1 simultaneous position is allowed.", "error");
      return;
    }

    const currentPrice = currentSimPrice;
    
    const pixelToPrice = (y: number) => {
      return 67420.50 + (360 - y) * 8.33;
    };

    // Calculate Stop Loss & Take Profit automatically based on Key levels
    let tp = currentPrice + 400;
    let sl = currentPrice - 300;

    if (type === "BUY") {
      tp = pixelToPrice(resistancePriceY);
      sl = pixelToPrice(supportPriceY) - 150;
    } else {
      tp = pixelToPrice(supportPriceY);
      sl = pixelToPrice(resistancePriceY) + 150;
    }

    // Calculate dynamic risk size based on Stop Loss distance
    const riskAmountUsd = traderBalance * (riskPercentage / 100);
    const slDistance = Math.abs(currentPrice - sl);
    const recommendedSize = slDistance > 0 ? (riskAmountUsd / slDistance) : 0.15;
    const size = parseFloat(Math.max(0.001, Math.min(10.0, recommendedSize)).toFixed(4));

    const newTrade = {
      id: `trade_${Date.now()}`,
      type,
      entryPrice: currentPrice,
      size,
      tp,
      sl,
      pattern: simFocusPattern === "pinbar" ? "Pin Bar / Hammer" :
               simFocusPattern === "engulfing" ? "Engulfing Candle" :
               simFocusPattern === "insidebar" ? "Inside Bar Harami" :
               simFocusPattern === "doji" ? "Gravestone Doji Reversal" : "Undecided Trend Wick",
      openedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };

    activeTradeRef.current = newTrade;
    setActiveTrade(newTrade);

    addLog(`🚀 Simulated ${type} order filled! Entry: $${currentPrice.toFixed(2)}. Target TP: $${tp.toFixed(2)}, SL: $${sl.toFixed(2)}`, "trading");
  };

  // Sound generator
  const triggerAudioBeep = () => {
    if (!audioAlertsEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.value = 880; // High tone alerting signal

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (_) {}
  };

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) return;
    const res = await Notification.requestPermission();
    setNotificationsAllowed(res === "granted");
    addLog(`System notification service: ${res === "granted" ? "GRANTED" : "DENIED"}`);
  };

  const triggerSystemNotification = (keyword: string) => {
    if (!notificationsAllowed || Notification.permission !== "granted") return;
    try {
      new Notification("ScreenSight Watchword Alert", {
        body: `Watchword: "${keyword}" was successfully extracted on visual scan.`,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='24' font-size='24'>🔍</text></svg>",
      });
    } catch (_) {}
  };

  // Trigger webhooks
  const fireWebhooks = async (trigger: WebhookConfig["trigger"], payload: any) => {
    const targets = webhooks.filter((w) => w.trigger === "all" || w.trigger === trigger);
    if (targets.length === 0) return;

    const dataPayload = {
      app: "ScreenSight Pro v4",
      trigger,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    targets.forEach(async (w) => {
      try {
        const res = await fetch(w.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataPayload),
        });
        w.lastStatus = res.ok ? "ok" : "error";
        addLog(`Webhook dispatch: ${res.ok ? "SUCCESS" : "ERROR"} [${w.url.slice(0, 30)}...]`, res.ok ? "success" : "error");
      } catch (err) {
        w.lastStatus = "error";
        addLog(`Webhook Dispatch Failure: ${w.url.slice(0, 30)}...`, "error");
      }
    });

    setWebhooks([...webhooks]);
  };

  const handleTestWebhooks = () => {
    addLog("Sending system test payload to all registered webhook endpoints...", "info");
    fireWebhooks("all", { test: true, message: "ScreenSight Pro P2P diagnostics check" });
  };

  // Screen analysis frame retrieval
  const getScreenshotBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !isCapturing) return null;
    try {
      // Downscale frame slightly for high-efficiency data packet transmission
      const offscreen = document.createElement("canvas");
      const maxDim = 960;
      let w = canvas.width;
      let h = canvas.height;
      if (Math.max(w, h) > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w *= scale;
        h *= scale;
      }
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext("2d");
      ctx?.drawImage(canvas, 0, 0, w, h);
      return offscreen.toDataURL("image/jpeg", 0.8).split(",")[1];
    } catch (_) {
      return null;
    }
  };

  // Draw simulated live stock/crypto mock chart frame
  const drawMockChartFrame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, frameIndex: number) => {
    // Canvas dimensions setup if not configured
    if (canvas.width !== 1280 || canvas.height !== 720) {
      canvas.width = 1280;
      canvas.height = 720;
    }

    // Background slate wash
    ctx.fillStyle = "#060c17";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid metrics lines
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1;
    for (let x = 80; x < canvas.width; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 60; y < canvas.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // DRAW CANDLESTICK BIBLE "ZONES OF VALUE" (KEY S/R LEVELS)
    const resistanceY = resistancePriceY;
    const supportY = supportPriceY;

    // Resistance Zone
    ctx.strokeStyle = "rgba(240, 48, 96, 0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(50, resistanceY);
    ctx.lineTo(canvas.width - 50, resistanceY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    ctx.fillStyle = "rgba(240, 48, 96, 0.1)";
    ctx.fillRect(50, resistanceY - 12, canvas.width - 100, 24);

    ctx.fillStyle = "#f03060";
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillText(`RESISTANCE ZONE OF VALUE (${resistancePriceY}px)`, 80, resistanceY - 18);

    // Support Zone
    ctx.strokeStyle = "rgba(0, 223, 110, 0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(50, supportY);
    ctx.lineTo(canvas.width - 50, supportY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    ctx.fillStyle = "rgba(0, 223, 110, 0.1)";
    ctx.fillRect(50, supportY - 12, canvas.width - 100, 24);

    ctx.fillStyle = "#00df6e";
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillText(`SUPPORT ZONE OF VALUE (${supportPriceY}px)`, 80, supportY + 23);

    // Dynamic slope based on trends
    const getTrendOffset = (index: number) => {
      if (simMarketStructure === "trending-up") {
        return -index * 4 + 70;
      }
      if (simMarketStructure === "trending-down") {
        return index * 4 - 70;
      }
      return 0; // range-bound
    };

    // Dynamic wave metrics guiding path background
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 200, 240, 0.15)";
    ctx.lineWidth = 2;
    const baseVal = 330;

    ctx.moveTo(50, baseVal);
    for (let i = 1; i < 40; i++) {
      const px = 50 + i * 28;
      const py = baseVal + Math.sin(i * 0.3 + frameIndex * 0.04) * 110 + Math.cos(i * 0.7) * 30 + getTrendOffset(i);
      ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Render realistic Japanese Candlesticks with Candlestick Bible focus setups
    for (let i = 1; i < 35; i += 1) {
      const px = 80 + i * 32;
      let py = baseVal + Math.sin(i * 0.3 + frameIndex * 0.04) * 110 + Math.cos(i * 0.7) * 30 + getTrendOffset(i);

      let openPrice = py + 12;
      let closePrice = py - 12;
      let highPrice = py - 25;
      let lowPrice = py + 25;
      let isPinBar = false;
      let isEngulfing = false;
      let customLabel = "";

      // FORCE HIGH-PROBABILITY SPECIFIC "CANDLESTICK BIBLE" EXECUTION INJECTIONS AT ZONES
      if (simFocusPattern === "pinbar") {
        if (i === 12) {
          // Bullish Pin Bar / Hammer exactly Rejecting the Support Key Zone!
          py = supportY;
          openPrice = supportY - 5;
          closePrice = supportY - 20; // Bullish green body
          highPrice = supportY - 25;  // Tiny upper wick
          lowPrice = supportY + 95;   // Huge lower tail rejecting support!
          isPinBar = true;
          customLabel = "BULLISH HAMMER PIN BAR";
        } else if (i === 22) {
          // Bearish Shooting Star exactly Rejecting the Resistance Key Zone!
          py = resistanceY;
          openPrice = resistanceY + 18;
          closePrice = resistanceY + 5; // Bearish red body
          highPrice = resistanceY - 95;  // Huge upper tail rejecting resistance
          lowPrice = resistanceY + 22;   // Tiny lower wick
          isPinBar = true;
          customLabel = "BEARISH SHOOTING STAR PIN BAR";
        }
      } else if (simFocusPattern === "engulfing") {
        if (i === 12) {
          // Bullish Engulfing engulfing previous white candle precisely at Support Zone!
          py = supportY;
          openPrice = supportY + 12; // Lower open
          closePrice = supportY - 32; // Higher close
          highPrice = supportY - 36;
          lowPrice = supportY + 18;
          isEngulfing = true;
          customLabel = "BULLISH ENGULFING BAR";
        } else if (i === 11) {
          // Small red candle prior to Bullish Engulfing
          py = supportY + 5;
          openPrice = supportY - 12;
          closePrice = supportY + 8;
          highPrice = supportY - 15;
          lowPrice = supportY + 12;
        } else if (i === 22) {
          // Bearish Engulfing engulfing previous white candle precisely at Resistance Zone!
          py = resistanceY;
          openPrice = resistanceY - 30; // High open
          closePrice = resistanceY + 15; // Low bearish close engulfing prior body
          highPrice = resistanceY - 40;
          lowPrice = resistanceY + 25;
          isEngulfing = true;
          customLabel = "BEARISH ENGULFING BAR";
        } else if (i === 21) {
          // Setup tiny candle before engulfing
          py = resistanceY;
          openPrice = resistanceY - 10;
          closePrice = resistanceY - 22; // Small white bullish candle
          highPrice = resistanceY - 26;
          lowPrice = resistanceY - 5;
        }
      } else if (simFocusPattern === "insidebar") {
        if (i === 12) {
          // Inside Bar contained within Mother candidate
          py = supportY;
          openPrice = supportY - 8;
          closePrice = supportY - 18;
          highPrice = supportY - 20;
          lowPrice = supportY - 2;
          customLabel = "INSIDE BAR HARAMI SETUP";
        } else if (i === 11) {
          // Giant bullish mother bar
          py = supportY;
          openPrice = supportY + 15;
          closePrice = supportY - 35;
          highPrice = supportY - 42;
          lowPrice = supportY + 20;
        }
      } else if (simFocusPattern === "doji") {
        if (i === 12) {
          py = supportY;
          openPrice = supportY - 2;
          closePrice = supportY - 2;
          highPrice = supportY - 55;
          lowPrice = supportY + 55;
          customLabel = "GRAVESTONE DOJI PIN BAR";
        }
      }

      const isBullish = closePrice < openPrice;
      ctx.strokeStyle = isBullish ? "#00df6e" : "#f03060";
      ctx.fillStyle = isBullish ? "#00df6e" : "#f03060";
      ctx.lineWidth = (isPinBar || isEngulfing || customLabel) ? 2.5 : 1.5;

      // Candle wicks
      ctx.beginPath();
      ctx.moveTo(px, highPrice);
      ctx.lineTo(px, lowPrice);
      ctx.stroke();

      // Candle body
      if (isPinBar) {
        ctx.fillStyle = isBullish ? "#00df6e" : "#f03060";
        ctx.strokeStyle = isBullish ? "#00df6e" : "#f03060";
      } else if (isEngulfing) {
        ctx.fillStyle = isBullish ? "#00df6e" : "#f03060";
        ctx.strokeStyle = isBullish ? "#00df6e" : "#f03060";
      }
      ctx.fillRect(px - 7, Math.min(openPrice, closePrice), 14, Math.max(2, Math.abs(openPrice - closePrice)));
      ctx.strokeRect(px - 7, Math.min(openPrice, closePrice), 14, Math.max(2, Math.abs(openPrice - closePrice)));

      // Render Visual Callouts pointing to patterns
      if (customLabel) {
        ctx.fillStyle = "rgba(9, 15, 30, 0.9)";
        ctx.strokeStyle = isBullish ? "#00df6e" : "#f03060";
        ctx.lineWidth = 1;
        
        const labelY = isBullish ? lowPrice + 15 : highPrice - 40;
        ctx.fillRect(px - 90, labelY, 180, 26);
        ctx.strokeRect(px - 90, labelY, 180, 26);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(customLabel, px, labelY + 11);
        ctx.fillStyle = isBullish ? "#00df6e" : "#f03060";
        ctx.font = "bold 8px 'Inter', sans-serif";
        ctx.fillText("VALID ZONE OF VALUE ACTION", px, labelY + 21);
        ctx.textAlign = "left"; // reset alignment
      }
    }

    // Interactive Ticker Pricing indicator block
    const currentPrice = 67420.50 + Math.sin(frameIndex * 0.05) * 500;
    ctx.fillStyle = "#090f1e";
    ctx.strokeStyle = "#00c8f0";
    ctx.lineWidth = 1.5;
    ctx.fillRect(canvas.width - 240, 40, 210, 110);
    ctx.strokeRect(canvas.width - 240, 40, 210, 110);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px 'Inter', sans-serif";
    ctx.fillText("BTC / USD Ticker", canvas.width - 220, 70);

    ctx.fillStyle = "#00c8f0";
    ctx.font = "bold 22px 'JetBrains Mono', monospace";
    ctx.fillText(`$${currentPrice.toFixed(2)}`, canvas.width - 220, 115);

    ctx.fillStyle = "#4a6580";
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.fillText("LIVE CANDLESTICK BIBLE ACTIVE", canvas.width - 220, 137);

    // Render big OCR Watchword triggers dynamically based on active Candlestick Bible focus setups
    let alarmWord = "SUPPORT LEVEL";
    if (simFocusPattern === "pinbar") {
      const cycle = Math.floor(frameIndex / 50) % 2;
      alarmWord = cycle === 0 ? "PIN BAR" : "HAMMER";
    } else if (simFocusPattern === "engulfing") {
      alarmWord = "ENGULFING";
    } else if (simFocusPattern === "insidebar") {
      alarmWord = "INSIDE BAR";
    } else if (simFocusPattern === "doji") {
      alarmWord = "DOJI";
    } else {
      const cycle = Math.floor(frameIndex / 80) % 4;
      if (cycle === 0) alarmWord = "BUY NOW";
      if (cycle === 1) alarmWord = "BREAKOUT";
      if (cycle === 2) alarmWord = "SELL LEVEL";
      if (cycle === 3) alarmWord = "RESISTANCE";
    }

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(157, 120, 248, 0.5)";
    ctx.lineWidth = 1;
    ctx.fillRect(80, 40, 230, 80);
    ctx.strokeRect(80, 40, 230, 80);

    ctx.fillStyle = "#9d78f8";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText("Real-time Watchword Trigger", 95, 65);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px 'JetBrains Mono', monospace";
    ctx.fillText(alarmWord, 95, 100);

    // Overlay active trade triggers, target ranges, and pulsed entry markers
    const priceToPixel = (price: number) => {
      return 360 - (price - 67420.50) / 8.33;
    };

    const trade = activeTradeRef.current;
    if (trade) {
      const entryY = priceToPixel(trade.entryPrice);
      const tpY = priceToPixel(trade.tp);
      const slY = priceToPixel(trade.sl);

      // Draw connecting path guide
      ctx.strokeStyle = "rgba(0, 200, 240, 0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(350, Math.min(tpY, slY));
      ctx.lineTo(350, Math.max(tpY, slY));
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Entry level line (Cyan)
      ctx.strokeStyle = "#00c8f0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(50, entryY);
      ctx.lineTo(canvas.width - 50, entryY);
      ctx.stroke();

      // Draw Take Profit level line (Green)
      ctx.strokeStyle = "#00df6e";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(50, tpY);
      ctx.lineTo(canvas.width - 50, tpY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Stop Loss level line (Red)
      ctx.strokeStyle = "#f03060";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(50, slY);
      ctx.lineTo(canvas.width - 50, slY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Level Annotations
      ctx.fillStyle = "#00c8f0";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.fillText(`SIMULATED ENTRY: $${trade.entryPrice.toFixed(2)}`, canvas.width - 320, entryY - 6);

      ctx.fillStyle = "#00df6e";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.fillText(`TAKE PROFIT (TP): $${trade.tp.toFixed(2)}`, canvas.width - 320, tpY - 6);

      ctx.fillStyle = "#f03060";
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.fillText(`STOP LOSS (SL): $${trade.sl.toFixed(2)}`, canvas.width - 320, slY - 6);

      // Find beautiful location where order matches Candlestick setup visually (index 12 is key Zone of Value)
      const markerX = 464; // near index 12

      // Radar pulse indicator
      const pulseRadius = 12 + Math.sin(frameIndex * 0.1) * 3;
      ctx.fillStyle = trade.type === "BUY" ? "rgba(0, 223, 110, 0.15)" : "rgba(240, 48, 96, 0.15)";
      ctx.beginPath();
      ctx.arc(markerX, entryY, pulseRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core point dot
      ctx.fillStyle = trade.type === "BUY" ? "#00df6e" : "#f03060";
      ctx.beginPath();
      ctx.arc(markerX, entryY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Visual order tag box
      const badgeY = trade.type === "BUY" ? entryY + 25 : entryY - 45;
      ctx.fillStyle = "rgba(9, 15, 30, 0.95)";
      ctx.strokeStyle = trade.type === "BUY" ? "#00df6e" : "#f03060";
      ctx.lineWidth = 1.5;
      ctx.fillRect(markerX - 60, badgeY, 120, 24);
      ctx.strokeRect(markerX - 60, badgeY, 120, 24);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`ACTIVE ${trade.type} ORDER`, markerX, badgeY + 11);
      ctx.fillStyle = trade.type === "BUY" ? "#00df6e" : "#f03060";
      ctx.font = "bold 8px 'Inter', sans-serif";
      ctx.fillText(`${trade.size} BTC @ $${trade.entryPrice.toFixed(0)}`, markerX, badgeY + 20);
      ctx.textAlign = "left"; // reset alignment
    }
  };

  // Coordinate frame calculations loops
  const runCaptureLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) {
      if (isCapturing) {
        requestAnimationFrame(runCaptureLoop);
      }
      return;
    }

    if (!isSimulating && (!video || video.paused || video.ended)) {
      if (isCapturing) {
        requestAnimationFrame(runCaptureLoop);
      }
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    if (isSimulating) {
      drawMockChartFrame(ctx, canvas, totalFrames);
      
      const simPrice = 67420.50 + Math.sin(totalFrames * 0.05) * 500;
      setCurrentSimPrice(simPrice);

      // Check active simulated trade targets (TP/SL)
      checkActiveTradeTriggers(simPrice);

      // Periodically feed the simulated price as a tick inside the visual history sparkline
      if (totalFrames % 8 === 0) {
        setPriceHistory((prev) => {
          const next = [...prev.slice(1), simPrice];
          if (next.length >= 2) {
            const startP = next[0] || simPrice;
            const percentShift = ((simPrice - startP) / startP) * 100;
            setPriceTrend(`${percentShift >= 0 ? "▲" : "▼"} ${Math.abs(percentShift).toFixed(2)}%`);
          }
          return next;
        });
      }
    } else if (video) {
      // Redraw screen bytes matching canvas dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    // Frame Rate FPS calculations
    const now = performance.now();
    frameCountRef.current++;
    setTotalFrames((prev) => prev + 1);

    if (now - lastTimeRef.current >= 1000) {
      const calcFps = (frameCountRef.current * 1000) / (now - lastTimeRef.current);
      setRawFps(calcFps);
      setFpsHistory((prev) => [...prev.slice(1), calcFps]);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    // Calculations of change in ROI pixels (Change Delta Δ)
    const scanX = roiEnabled ? roiX : 0;
    const scanY = roiEnabled ? roiY : 0;
    const scanW = roiEnabled ? roiW : canvas.width;
    const scanH = roiEnabled ? roiH : canvas.height;

    // Safe boundary adjustment
    const safeW = Math.min(scanW, canvas.width - scanX);
    const safeH = Math.min(scanH, canvas.height - scanY);

    if (safeW > 10 && safeH > 10) {
      try {
        const imgData = ctx.getImageData(scanX, scanY, safeW, safeH);
        const delta = calcPixelDelta(imgData.data);
        setPixelDelta(delta);
        setDeltaHistory((prev) => [...prev.slice(1), delta]);

        // Evaluate motion bounds
        if (delta > 20) {
          setDetectionsCount((prev) => prev + 1);
          if (Math.random() < 0.05) {
            // Log motion detections periodically so console does not flood
            addLog(`Delta Activity Detected: Δ ${delta.toFixed(1)}`, "high");
            fireWebhooks("high", { delta: delta.toFixed(1) });
          }
        }
      } catch (_) {}
    }

    // Interval localized OCR
    const intervalTriggerValue = parseInt(ocrIntervalMethod) || 15;
    const currentFrameCount = totalFrames;

    if (
      (!ocrIntervalMethod || ocrIntervalMethod === "adaptive" ? currentFrameCount % 12 === 0 : currentFrameCount % intervalTriggerValue === 0) &&
      !isOCRBusy.current &&
      ocrWorkerRef.current
    ) {
      triggerLocalOCR(ctx, scanX, scanY, safeW, safeH);
    }

    if (isCapturing && !paused) {
      requestAnimationFrame(runCaptureLoop);
    }
  };

  const calcPixelDelta = (currData: Uint8ClampedArray): number => {
    if (!prevPixelsRef.current || prevPixelsRef.current.length !== currData.length) {
      prevPixelsRef.current = new Uint8ClampedArray(currData);
      return 0;
    }

    let sum = 0;
    const samplingStep = 32;

    for (let i = 0; i < currData.length; i += samplingStep * 4) {
      const gCurr = 0.299 * currData[i] + 0.587 * currData[i + 1] + 0.114 * currData[i + 2];
      const gPrev = 0.299 * prevPixelsRef.current[i] + 0.587 * prevPixelsRef.current[i + 1] + 0.114 * prevPixelsRef.current[i + 2];
      sum += Math.abs(gCurr - gPrev);
    }

    prevPixelsRef.current.set(currData);
    const calculatedDelta = sum / (currData.length / (samplingStep * 4));
    return calculatedDelta;
  };

  // Offline Browser OCR
  const triggerLocalOCR = async (ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number) => {
    isOCRBusy.current = true;
    try {
      const canvas = document.createElement("canvas");
      // Double the size for high scale accuracy OCR
      canvas.width = sw * 2;
      canvas.height = sh * 2;
      const offCtx = canvas.getContext("2d");
      if (!offCtx) return;

      offCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw * 2, sh * 2);

      const workerVal = ocrWorkerRef.current;
      const result = await workerVal.recognize(canvas);

      const text = result.data.text || "";
      const conf = result.data.confidence || 0;

      if (conf >= minOcrConf && text.trim()) {
        setLatestOcrText(text);
        setCurrentConf(conf);
        setOcrConfHistory((prev) => [...prev.slice(1), conf]);

        // Evaluate alarm watchword alerts
        const lowerText = text.toLowerCase();
        for (const word of keywords) {
          const regex = new RegExp(`\\b${word}\\b`, "i");
          if (regex.test(lowerText)) {
            const timeNow = Date.now();
            if (timeNow - lastAlertMsRef.current > 4000) {
              lastAlertMsRef.current = timeNow;
              setAlertsCount((prev) => prev + 1);
              triggerAudioBeep();
              triggerSystemNotification(word);
              addLog(`Alert trigger: "${word.toUpperCase()}" extracted in tracking bounds!`, "high");
              fireWebhooks("keyword", { keyword: word, ocrExcerpt: text.slice(0, 150) });
            }
          }
        }

        // Try to parse asset valuation ticker prices
        const priceRegex = /\b\d{1,6}[.,]\d{2,4}\b/g;
        const pricesSpotted = text.match(priceRegex);
        if (pricesSpotted && pricesSpotted.length > 0) {
          const parsedPrice = parseFloat(pricesSpotted[0].replace(",", "."));
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            setPriceHistory((prev) => {
              const next = [...prev.slice(1), parsedPrice];
              // Assess pricing momentum trend direction
              if (next.length >= 2) {
                const startP = next[0] || parsedPrice;
                const percentShift = ((parsedPrice - startP) / startP) * 100;
                setPriceTrend(`${percentShift >= 0 ? "▲" : "▼"} ${Math.abs(percentShift).toFixed(2)}%`);
              }
              return next;
            });
          }
        }
      }
    } catch (err: any) {
      console.warn("Local browser Tesseract OCR issue:", err);
    } finally {
      isOCRBusy.current = false;
    }
  };

  const handleStartSimulation = async () => {
    try {
      addLog("Initializing real-time dynamic test simulation...", "info");
      setIsSimulating(true);
      setIsCapturing(true);
      setPaused(false);
      setTotalFrames(0);
      setDetectionsCount(0);
      setAlertsCount(0);
      sessionStartRef.current = Date.now();

      // Lazy load local Tesseract Offline OCR worker in window sandboxes
      if (!ocrWorkerRef.current) {
        addLog("Activating offline local Tesseract OCR engine...", "info");
        const TesseractClass = (window as any).Tesseract;
        if (TesseractClass) {
          const workerInstance = await TesseractClass.createWorker("eng", 1);
          await workerInstance.setParameters({
            tessedit_pageseg_mode: "11",
            preserve_interword_spaces: "1",
          });
          ocrWorkerRef.current = workerInstance;
          addLog("Offline Tesseract OCR ready (PSM 11 mode)", "success");
        } else {
          addLog("Tesseract fallback pending browser initialization.", "error");
        }
      }

      addLog("Simulated digital chart pipeline online.", "success");

      setTimeout(() => {
        lastTimeRef.current = performance.now();
        requestAnimationFrame(runCaptureLoop);
      }, 500);

    } catch (err: any) {
      console.error(err);
      addLog(`Simulation setup rejection: ${err.message}`, "error");
    }
  };

  const handleStartCapture = async () => {
    try {
      addLog("Querying browser media capture screen picker...", "info");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor", frameRate: { ideal: 30, max: 30 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsSimulating(false);
      setIsCapturing(true);
      setPaused(false);
      setTotalFrames(0);
      setDetectionsCount(0);
      setAlertsCount(0);
      sessionStartRef.current = Date.now();

      // Lazy load local Tesseract Offline OCR worker in window sandboxes
      if (!ocrWorkerRef.current) {
        addLog("Activating offline local Tesseract OCR engine...", "info");
        const TesseractClass = (window as any).Tesseract;
        if (TesseractClass) {
          const workerInstance = await TesseractClass.createWorker("eng", 1);
          await workerInstance.setParameters({
            tessedit_pageseg_mode: "11",
            preserve_interword_spaces: "1",
          });
          ocrWorkerRef.current = workerInstance;
          addLog("Offline Tesseract OCR ready (PSM 11 mode)", "success");
        } else {
          addLog("Tesseract fallback pending browser initialization.", "error");
        }
      }

      addLog("Real-time visual monitoring established.", "success");

      // Set up visibility callbacks to paused screen feeds if current workspace tab is hidden
      stream.getVideoTracks()[0].addEventListener("ended", handleStopCapture);

      setTimeout(() => {
        lastTimeRef.current = performance.now();
        requestAnimationFrame(runCaptureLoop);
      }, 500);

    } catch (err: any) {
      console.error(err);
      addLog(`Stream monitoring rejection: ${err.message}`, "error");
      const errMsg = String(err.message || "").toLowerCase();
      const errName = String(err.name || "");
      if (
        errName === "NotAllowedError" ||
        errName === "SecurityError" ||
        errMsg.includes("disallowed") ||
        errMsg.includes("permission") ||
        errMsg.includes("display-capture") ||
        errMsg.includes("media")
      ) {
        setCaptureError(err.message || String(err));
        setShowPermissionOverlay(true);
      }
    }
  };

  const handleStopCapture = () => {
    setIsCapturing(false);
    setIsSimulating(false);
    setPaused(false);
    setRawFps(0);
    setPixelDelta(0);
    prevPixelsRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    sessionStartRef.current = null;
    setSessionTime("00:00:00");
    addLog("Capture feed severed. Pipeline closed.", "info");
  };

  const handleTogglePause = () => {
    if (!isCapturing) return;
    const nextPaused = !paused;
    setPaused(nextPaused);
    if (!nextPaused) {
      lastTimeRef.current = performance.now();
      requestAnimationFrame(runCaptureLoop);
    }
    addLog(nextPaused ? "Screen analysis paused." : "Real-time stream evaluation resumed.", "info");
  };

  // Clock elapsed ticks
  useEffect(() => {
    let intv: NodeJS.Timeout | null = null;
    if (isCapturing && !paused) {
      intv = setInterval(() => {
        if (sessionStartRef.current) {
          const secsVal = Math.floor((Date.now() - sessionStartRef.current) / 1000);
          const h = String(Math.floor(secsVal / 3600)).padStart(2, "0");
          const m = String(Math.floor((secsVal % 3600) / 60)).padStart(2, "0");
          const s = String(secsVal % 60).padStart(2, "0");
          setSessionTime(`${h}:${m}:${s}`);
        }
      }, 1000);
    }
    return () => {
      if (intv) clearInterval(intv);
    };
  }, [isCapturing, paused]);

  // Session CSV download
  const handleExportCSV = () => {
    try {
      const headerStr = "timestamp,fps,pixel_delta,watchword_alerts,logs\n";
      const rowsStr = logs
        .map((l) => `"${l.ts}","${rawFps.toFixed(1)}","${pixelDelta.toFixed(1)}","${alertsCount}","${l.msg.replace(/"/g, '""')}"`)
        .join("\n");

      const blob = new Blob([headerStr + rowsStr], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `screensight_telemetry_${Date.now()}.csv`;
      link.click();
      addLog("Exported session CSV telemetry.", "success");
    } catch (_) {}
  };

  // PDF reports creation using window.jspdf CDN
  const handleExportPDF = () => {
    addLog("Composing session analytic summary PDF report...", "info");
    try {
      const jsPDF = (window as any).jspdf?.jsPDF || (window as any).jsPDF;
      if (!jsPDF) {
        addLog("jsPDF modular component is pending.", "error");
        return;
      }

      const doc = new jsPDF();
      doc.setFillColor(3, 7, 14);
      doc.rect(0, 0, 210, 22, "F");

      doc.setTextColor(0, 200, 240);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("ScreenSight Pro — Session Report", 14, 14);

      doc.setTextColor(122, 152, 180);
      doc.setFontSize(8);
      doc.text(new Date().toLocaleString(), 196, 14, { align: "right" });

      // Core parameters summary
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.text("System Performance Parameters", 14, 32);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Duration Toggled: ${sessionTime}`, 14, 40);
      doc.text(`Completed Frame Counts: ${totalFrames}`, 14, 46);
      doc.text(`Delta Detections: ${detectionsCount}`, 14, 52);
      doc.text(`Audio Alerts Fired: ${alertsCount}`, 14, 58);

      // Extract current screen capture for visual alignment inside the PDF summary report
      const screenshot = getScreenshotBase64();
      if (screenshot) {
        doc.text("Latest Captured Frame:", 14, 68);
        doc.addImage("data:image/jpeg;base64," + screenshot, "JPEG", 14, 72, 182, 102);
      }

      const logLines = logs.slice(0, 15).map((l) => `[${l.ts}] ${l.msg}`);
      doc.text("Audit logs excerpt:", 14, 184);
      doc.setFont("courier", "normal");
      doc.setFontSize(7.5);
      logLines.forEach((line, idx) => {
        doc.text(line.slice(0, 105), 14, 192 + idx * 4.5);
      });

      if (mtfConfluenceResult) {
        doc.addPage();
        
        // Draw dark background block for header
        doc.setFillColor(3, 7, 14);
        doc.rect(0, 0, 210, 25, "F");

        doc.setTextColor(0, 200, 240);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("ScreenSight Pro — Confluence Verdict", 14, 16);

        // Subtitle/metadata
        doc.setTextColor(157, 120, 248); // purple-ish
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`CONFLUENCE CONFIDENCE SCORE: ${mtfConfluenceResult.confluenceScore}%`, 14, 38);
        
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Overall Market Bias: ${mtfConfluenceResult.overallBias}`, 14, 46);

        // Draw section dividers
        doc.setDrawColor(21, 34, 54);
        doc.line(14, 52, 196, 52);

        // Dominant Narrative
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(11);
        doc.text("Dominant Top-Down Narrative", 14, 60);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(80, 80, 80);
        
        // Split text to fit page width
        const splitNarrative = doc.splitTextToSize(mtfConfluenceResult.dominantNarrative, 182);
        doc.text(splitNarrative, 14, 66);

        // Dynamic spacing based on narrative length
        const narrativeHeight = splitNarrative.length * 5;
        let currentY = 66 + narrativeHeight + 10;

        // Alignment Table / Details
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text("Timeframe Matrix Alignment", 14, currentY);
        currentY += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(`Aligned Timeframes: ${mtfConfluenceResult.alignedTimeframes.join(", ") || "None"}`, 14, currentY);
        currentY += 5;
        doc.text(`Conflicting Timeframes: ${mtfConfluenceResult.conflictingTimeframes.join(", ") || "None"}`, 14, currentY);
        currentY += 12;

        // Tactical Entry Plan
        if (mtfConfluenceResult.tacticalEntryPlan) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(40, 40, 40);
          doc.text("Tactical Trade Execution Plan", 14, currentY);
          currentY += 6;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(80, 80, 80);
          doc.text(`• Trigger Signal: ${mtfConfluenceResult.tacticalEntryPlan.entryTrigger}`, 14, currentY);
          currentY += 5;
          doc.text(`• Stop Loss invalidation zone: ${mtfConfluenceResult.tacticalEntryPlan.stopLoss}`, 14, currentY);
          currentY += 5;
          doc.text(`• Take Profit targets: ${mtfConfluenceResult.tacticalEntryPlan.takeProfit}`, 14, currentY);
          currentY += 5;
          doc.text(`• Risk to Reward ratio: ${mtfConfluenceResult.tacticalEntryPlan.riskRewardRatio}`, 14, currentY);
          currentY += 5;

          const splitExec = doc.splitTextToSize(`• Execution Strategy: ${mtfConfluenceResult.tacticalEntryPlan.executionStrategy}`, 182);
          doc.text(splitExec, 14, currentY);
        }
      }

      doc.save(`screensight_report_${Date.now()}.pdf`);
      addLog("Analytic summary PDF report download completed.", "success");
    } catch (err: any) {
      addLog(`Failed to write PDF: ${err.message}`, "error");
    }
  };

  // State modifiers
  const handleAddKeyword = (kw: string) => {
    setKeywords((prev) => [...prev, kw]);
  };
  const handleRemoveKeyword = (idx: number) => {
    setKeywords((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleAddWebhook = (url: string, trigger: WebhookConfig["trigger"]) => {
    setWebhooks((prev) => [...prev, { id: Math.random().toString(), url, trigger }]);
  };
  const handleRemoveWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };
  const handleAddFocusMode = (name: string, prompt: string) => {
    setCustomFocusModes((prev) => [...prev, { id: `custom_${Date.now()}`, name, prompt }]);
  };
  const handleRemoveFocusMode = (id: string) => {
    setCustomFocusModes((prev) => prev.filter((m) => m.id !== id));
  };

  const [diffOverlayActive, setDiffOverlayActive] = useState<boolean>(false);
  const [mtfAnalyses, setMtfAnalyses] = useState<Record<string, TimeframeAnalysis>>({});
  const [mtfConfluenceResult, setMtfConfluenceResult] = useState<ConfluenceResult | null>(null);

  // Firebase Auth & Database States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudConfluences, setCloudConfluences] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Global payment activation state
  const [purchases, setPurchases] = useState<any[]>([]);
  const [activePaymentCode, setActivePaymentCode] = useState<string>("");
  const [isVerifyPaymentOpen, setIsVerifyPaymentOpen] = useState<boolean>(false);

  // Trial tracking state (only 1-time tight trial allowed)
  const [trialUsed, setTrialUsed] = useState<boolean>(() => {
    return localStorage.getItem("trading_intelligence_trial_used") === "true";
  });

  const handleUseTrial = () => {
    setTrialUsed(true);
    localStorage.setItem("trading_intelligence_trial_used", "true");
    addLog("🔒 Free Trial used! Subscription via verified M-Pesa payment is now required to run further premium analyses.", "high");
  };

  const fetchGlobalPurchases = async (user: FirebaseUser) => {
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/premium/purchases", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.purchases || [];
        setPurchases(list);
        
        // Auto-select first verified activator transaction code if none chosen yet
        const verified = list.filter((p: any) => p.status === "verified");
        if (verified.length > 0) {
          setActivePaymentCode((prev) => prev || verified[0].transactionCode);
        }
      }
    } catch (err) {
      console.error("Error fetching purchases globally in App.tsx:", err);
    }
  };

  // Capture Permissions & Iframe Security error state
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [showPermissionOverlay, setShowPermissionOverlay] = useState<boolean>(false);

  // Handle Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        addLog(`User signed in: ${user.displayName || user.email}`, "success");
        try {
          const token = await user.getIdToken();
          const syncRes = await fetch("/api/users/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              displayName: user.displayName || "Anonymous Trader"
            })
          });
          if (syncRes.ok) {
            addLog("Database: Synced trader profile securely to Cloud SQL.", "success");
          }

          // Sync profile to Firebase Firestore (conforming exactly to the User blueprint entity)
          try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              await setDoc(userRef, {
                email: user.email || "",
                displayName: user.displayName || "Anonymous Trader",
                createdAt: serverTimestamp()
              });
              addLog("Firebase: Created user profile in Firestore.", "success");
            } else {
              const existingData = userSnap.data();
              if (existingData.displayName !== (user.displayName || "Anonymous Trader")) {
                await setDoc(userRef, {
                  email: existingData.email,
                  displayName: user.displayName || "Anonymous Trader",
                  createdAt: existingData.createdAt
                });
                addLog("Firebase: Synced display name to Firestore.", "success");
              }
            }
          } catch (fsErr: any) {
            handleFirestoreError(fsErr, OperationType.WRITE, `users/${user.uid}`);
          }

          // Fetch their past confluence reports from Cloud SQL
          fetchCloudHistory(user);
          // Fetch their premium strategy activator codes
          fetchGlobalPurchases(user);
        } catch (error: any) {
          addLog(`Database Profile sync failed: ${error.message}`, "error");
        }
      } else {
        setCloudConfluences([]);
        setPurchases([]);
        setActivePaymentCode("");
        setGmailAccessToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Cloud Saved Confluences History
  const fetchCloudHistory = async (user: FirebaseUser) => {
    setIsCloudSyncing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/confluences", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to fetch historical confluences.");
      }
      const data = await res.json();
      const list = data.confluences || [];
      setCloudConfluences(list);
      addLog(`Database: Synced ${list.length} historical top-down confluences from Cloud SQL.`, "info");
    } catch (error: any) {
      addLog(`Database query failed: ${error.message}`, "error");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Google Sign In
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      addLog(`Google Authentication failed: ${error.message}`, "error");
    }
  };

  // Gmail Scope Authentication Sign In
  const signInWithGmail = async () => {
    try {
      addLog("Google OAuth: Initiating workspace scope consent flow...", "info");
      googleProvider.addScope("https://mail.google.com/");
      googleProvider.addScope("https://www.googleapis.com/auth/gmail.send");
      googleProvider.addScope("https://www.googleapis.com/auth/gmail.compose");
      googleProvider.addScope("https://www.googleapis.com/auth/gmail.modify");
      googleProvider.addScope("https://www.googleapis.com/auth/gmail.readonly");
      
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGmailAccessToken(credential.accessToken);
        addLog("Google OAuth: Secured Gmail API access token in-memory.", "success");
      } else {
        addLog("Could not secure access token from OAuth flow.", "error");
      }
    } catch (error: any) {
      addLog(`Gmail Scope Consent failed: ${error.message}`, "error");
    }
  };

  // Inject Context Helper
  const handleInjectGmailContext = (text: string) => {
    setLatestOcrText((prev) => `${prev}\n\n[GMAIL INTEGRATION ALERT]: ${text}`.trim());
  };

  // Sign Out
  const signOutUser = async () => {
    try {
      await signOut(auth);
      setGmailAccessToken(null);
      addLog("Signed out from ScreenSight Pro cloud services.", "info");
    } catch (error: any) {
      addLog(`Sign out failed: ${error.message}`, "error");
    }
  };

  // Save current live confluence matrix & timeframe analyses to Cloud SQL
  const saveCurrentSessionToCloud = async () => {
    if (!currentUser) {
      addLog("Cannot sync. Please sign in with Google first.", "error");
      return;
    }
    if (!mtfConfluenceResult) {
      addLog("Run the Confluence Engine first to generate a synthesised report.", "error");
      return;
    }

    setIsCloudSyncing(true);
    addLog("Initiating Secure Cloud SQL Sync for current confluence report...", "info");

    try {
      const token = await currentUser.getIdToken();

      // 1. Prepare individual timeframe analyses
      const analysesList = [];
      for (const [tf, rawAnalysis] of Object.entries(mtfAnalyses)) {
        if (!rawAnalysis) continue;
        const analysis = rawAnalysis as TimeframeAnalysis;
        const analysisId = `analysis_${tf.toLowerCase()}_${Date.now()}`;
        analysesList.push({
          id: analysisId,
          timeframe: tf,
          bias: analysis.bias,
          trend: analysis.trend,
          candlestickPattern: analysis.candlestickPattern || "None",
          chartPattern: analysis.chartPattern || "None",
          smcSignals: analysis.smcSignals || "None",
          supportLevel: analysis.supportLevel || null,
          resistanceLevel: analysis.resistanceLevel || null,
          momentum: analysis.momentum || "",
          movingAverageAlignment: analysis.movingAverageAlignment || "",
          summary: analysis.summary || "",
        });
      }

      // 2. Prepare master confluence payload
      const confluenceId = `conf_${Date.now()}`;
      const confluencePayload = {
        id: confluenceId,
        overallBias: mtfConfluenceResult.overallBias,
        confluenceScore: mtfConfluenceResult.confluenceScore,
        dominantNarrative: mtfConfluenceResult.dominantNarrative,
        alignedTimeframes: mtfConfluenceResult.alignedTimeframes,
        conflictingTimeframes: mtfConfluenceResult.conflictingTimeframes,
        tacticalEntryPlan: mtfConfluenceResult.tacticalEntryPlan || null,
        timeframeSuite: Object.keys(mtfAnalyses),
      };

      const res = await fetch("/api/confluences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          confluence: confluencePayload,
          analyses: analysesList
        })
      });

      if (!res.ok) {
        throw new Error("Failed to save session to Cloud SQL.");
      }

      // 3. Save to Firebase Firestore to fulfill the master Firebase integration design
      try {
        // A. Save individual timeframe analyses to Firestore subcollection
        for (const analysis of analysesList) {
          const analysisRef = doc(db, "users", currentUser.uid, "analyses", analysis.id);
          await setDoc(analysisRef, {
            userId: currentUser.uid,
            timeframe: analysis.timeframe,
            bias: analysis.bias,
            trend: analysis.trend,
            candlestickPattern: analysis.candlestickPattern,
            chartPattern: analysis.chartPattern,
            smcSignals: analysis.smcSignals,
            supportLevel: analysis.supportLevel,
            resistanceLevel: analysis.resistanceLevel,
            momentum: analysis.momentum,
            movingAverageAlignment: analysis.movingAverageAlignment,
            summary: (analysis.summary || "").slice(0, 4000),
            createdAt: serverTimestamp()
          });
        }

        // B. Save master confluence record to Firestore subcollection
        const confluenceRef = doc(db, "users", currentUser.uid, "confluences", confluenceId);
        await setDoc(confluenceRef, {
          userId: currentUser.uid,
          overallBias: confluencePayload.overallBias,
          confluenceScore: confluencePayload.confluenceScore,
          dominantNarrative: (confluencePayload.dominantNarrative || "").slice(0, 8000),
          alignedTimeframes: confluencePayload.alignedTimeframes,
          conflictingTimeframes: confluencePayload.conflictingTimeframes,
          tacticalEntryPlan: confluencePayload.tacticalEntryPlan,
          timeframeSuite: confluencePayload.timeframeSuite,
          createdAt: serverTimestamp()
        });
        addLog("Firebase: Saved and synced session data to Firestore securely.", "success");
      } catch (fsErr: any) {
        handleFirestoreError(fsErr, OperationType.WRITE, `users/${currentUser.uid}/confluences/${confluenceId}`);
      }

      addLog(`Session securely saved. Report UID: ${confluenceId}`, "success");
      
      // Refresh Cloud SQL history list
      fetchCloudHistory(currentUser);
    } catch (error: any) {
      addLog(`Database sync failed: ${error.message}`, "error");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Delete a specific cloud confluence report
  const deleteCloudConfluence = async (confId: string) => {
    if (!currentUser) return;
    try {
      // 1. Delete from Firebase Firestore
      try {
        const confluenceRef = doc(db, "users", currentUser.uid, "confluences", confId);
        await deleteDoc(confluenceRef);
        addLog("Firebase: Deleted confluence record from Firestore.", "success");
      } catch (fsErr: any) {
        handleFirestoreError(fsErr, OperationType.DELETE, `users/${currentUser.uid}/confluences/${confId}`);
      }

      // 2. Delete from Cloud SQL
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/confluences/${confId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to delete record from Cloud SQL.");
      }
      addLog("Successfully deleted Cloud SQL confluence record.", "success");
      fetchCloudHistory(currentUser);
    } catch (error: any) {
      addLog(`Database deletion failed: ${error.message}`, "error");
    }
  };

  // Load a historical confluence report into the current active UI state
  const loadHistoricalConfluence = (item: any) => {
    setMtfConfluenceResult({
      overallBias: item.overallBias,
      confluenceScore: item.confluenceScore,
      dominantNarrative: item.dominantNarrative,
      alignedTimeframes: item.alignedTimeframes || [],
      conflictingTimeframes: item.conflictingTimeframes || [],
      tacticalEntryPlan: item.tacticalEntryPlan || {
        entryTrigger: "N/A",
        stopLoss: "N/A",
        takeProfit: "N/A",
        riskRewardRatio: "N/A",
        executionStrategy: ""
      }
    });
    
    const createdStr = item.createdAt
      ? (typeof item.createdAt === "string" ? new Date(item.createdAt).toLocaleString() : new Date(item.createdAt.seconds * 1000).toLocaleString())
      : "Unknown";
      
    addLog(`Loaded Cloud SQL report dated ${createdStr}`, "success");
    setIsHistoryOpen(false);
  };

  // Real-time Quant Scrutiny indicators derived from continuous rolling feeds
  const activePricesForIndicator = priceHistory.filter((p) => p > 0);
  
  // Calculate SMA helper
  const getSMA = (prices: number[], period: number) => {
    if (prices.length === 0) return 0;
    const slices = prices.slice(-period);
    const sum = slices.reduce((acc, p) => acc + p, 0);
    return sum / slices.length;
  };

  // Calculate EMA helper
  const getEMA = (prices: number[], period: number) => {
    if (prices.length === 0) return 0;
    let ema = prices[0];
    const k = 2 / (period + 1);
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  };

  // Calculate RSI-14
  const getRSI = (prices: number[], period: number = 14) => {
    if (prices.length <= period) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) {
        gains += diff;
      } else {
        losses -= diff;
      }
    }
    if (losses === 0) return gains > 0 ? 100 : 50;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  };

  // Calculate standard deviation over last 20 periods
  const getStandardDeviation = (prices: number[], period: number = 20) => {
    if (prices.length <= 1) return 0;
    const subset = prices.slice(-period);
    const mean = subset.reduce((acc, p) => acc + p, 0) / subset.length;
    const variance = subset.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / (subset.length - 1);
    return Math.sqrt(variance);
  };

  const calculatedSMA5 = getSMA(activePricesForIndicator, 5);
  const calculatedSMA15 = getSMA(activePricesForIndicator, 15);
  const calculatedRSI14 = getRSI(activePricesForIndicator, 14);
  const calculatedStdDev = getStandardDeviation(activePricesForIndicator, 20);

  // Profit Factor calculation
  const getProfitFactor = () => {
    let grossWins = 0;
    let grossLosses = 0;
    closedTrades.forEach(t => {
      if (t.pnl > 0) {
        grossWins += t.pnl;
      } else {
        grossLosses += Math.abs(t.pnl);
      }
    });
    if (grossLosses === 0) return grossWins > 0 ? "Infinite" : "0.0";
    return (grossWins / grossLosses).toFixed(2);
  };

  // Drawdown calculation
  const getMaxDrawdown = () => {
    let peak = 10000;
    let current = 10000;
    let maxDD = 0;
    closedTrades.slice().reverse().forEach(t => {
      current += t.pnl;
      if (current > peak) peak = current;
      const dd = ((peak - current) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    });
    return `${maxDD.toFixed(1)}%`;
  };

  return (
    <div className="flex flex-col h-screen text-[#b8d0e8] font-sans antialiased overflow-hidden select-none bg-[#03070e]">
      
      {/* Dynamic Header Toolbar Navigation */}
      <header className="h-[46px] border-b border-[#152236] px-4 flex items-center justify-between bg-[#060c17]/95 backdrop-blur-md z-30 select-none shadow-md shadow-black/35 shrink-0">
        
        {/* Brand identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-6.5 h-6.5 rounded-md bg-gradient-to-tr from-[#00c8f0] to-[#9d78f8] flex items-center justify-center text-[10px] font-black shadow-lg shadow-[#00c8f0]/10 text-white">
            SS
          </div>
          <div className="flex flex-col">
            <span className="font-syne font-extrabold leading-none text-white text-[13px] tracking-tight">
              ScreenSight <span className="text-[#00c8f0]">Pro</span>
            </span>
            <span className="text-[7.5px] font-mono tracking-widest text-[#4a6580] uppercase mt-0.5 leading-none">
              v4 · Cosmic Slate Console
            </span>
          </div>
        </div>

        {/* Toolbar parameters triggers */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isCapturing ? (
            <button
              onClick={handleStartCapture}
              className="px-3 py-1.5 bg-[#00c8f0] hover:brightness-110 active:scale-95 text-black font-extrabold text-[10.5px] rounded flex items-center gap-1 cursor-pointer transition shadow-md shadow-[#00c8f0]/15"
            >
              <Play className="w-3 h-3 fill-black text-black" />
              Start Capture
            </button>
          ) : (
            <button
              onClick={handleStopCapture}
              className="px-3 py-1.5 bg-[#f03060]/10 hover:bg-[#f03060]/20 border border-[#f03060]/30 text-[#f03060] font-extrabold text-[10.5px] rounded flex items-center gap-1 cursor-pointer transition"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop Capture
            </button>
          )}

          {isCapturing && (
            <button
              onClick={handleTogglePause}
              className="px-3 py-1.5 bg-[#0b1322] border border-[#1e3s50] hover:border-[#4a6580] text-[#7a98b4] hover:text-white text-[10.5px] rounded flex items-center gap-1 cursor-pointer transition shrink-0"
              title="Pause screen capture delta checks"
            >
              <Pause className="w-3.5 h-3.5" />
              {paused ? "Resume Check" : "Pause Check"}
            </button>
          )}

          <button
            onClick={() => isCapturing ? handleSaveScreenshot() : addLog("Monitor session is not active.", "error")}
            disabled={!isCapturing}
            className="p-2 bg-[#090f1e] hover:bg-[#0b1322] border border-[#152236] text-[#b8d0e8] hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
            title="Download PNG Frame"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleExportCSV}
            className="p-2 bg-[#090f1e] hover:bg-[#0b1322] border border-[#152236] text-[#b8d0e8] hover:text-white rounded transition cursor-pointer shrink-0"
            title="Download CSV Logs"
          >
            <Table className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3 py-1.5 bg-[#9d78f8]/10 hover:bg-[#9d78f8]/20 border border-[#9d78f8]/30 rounded text-[#9d78f8] text-[10px] font-bold tracking-wider tracking-tight uppercase flex items-center gap-1 cursor-pointer transition shrink-0"
            title="Download Landscape PDF Summary"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF REPORT
          </button>

          {/* Secure Cloud Sync Integrations */}
          <div className="flex items-center gap-1.5 border-l border-[#152236] pl-1.5">
            {authLoading ? (
              <div className="px-3 py-1.5 rounded bg-[#090f1e] text-[#7a98b4] text-[10px] font-mono flex items-center gap-1.5 shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00c8f0]" />
                AUTH LOAD...
              </div>
            ) : currentUser ? (
              <>
                {mtfConfluenceResult && (
                  <button
                    onClick={saveCurrentSessionToCloud}
                    disabled={isCloudSyncing}
                    className={`px-3 py-1.5 rounded text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 cursor-pointer transition border shrink-0 ${
                      isCloudSyncing
                        ? "bg-[#00df6e]/10 border-[#00df6e]/20 text-[#00df6e] animate-pulse"
                        : "bg-[#00df6e]/15 border-[#00df6e]/30 text-[#00df6e] hover:bg-[#00df6e]/25"
                    }`}
                    title="Sync active confluence report to secure cloud database"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    {isCloudSyncing ? "SYNCING..." : "SAVE CLOUD"}
                  </button>
                )}

                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="px-2.5 py-1.5 bg-[#090f1e] border border-[#152236] text-[#b8d0e8] hover:text-white rounded text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 cursor-pointer transition shrink-0"
                  title="View saved cloud confluence reports"
                >
                  <History className="w-3.5 h-3.5 text-[#9d78f8]" />
                  HISTORY ({cloudConfluences.length})
                </button>

                <div className="flex items-center gap-2 pl-1.5 border-l border-[#152236]">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || "User"}
                      className="w-5 h-5 rounded-full border border-[#00c8f0]/40 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-[#7a98b4] shrink-0" />
                  )}
                  <button
                    onClick={signOutUser}
                    className="p-2 bg-[#090f1e] border border-[#152236] text-[#f03060] hover:text-[#f03060]/80 rounded hover:border-[#f03060]/40 transition cursor-pointer shrink-0"
                    title="Sign Out of Cloud Console"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="px-3 py-1.5 bg-[#00c8f0]/10 hover:bg-[#00c8f0]/20 border border-[#00c8f0]/30 rounded text-[#00c8f0] text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 cursor-pointer transition shrink-0"
                title="Sign in with Google to enable Cloud Backups"
              >
                <LogIn className="w-3.5 h-3.5" />
                SIGN IN
              </button>
            )}
          </div>
        </div>

        {/* Global indicators states */}
        <div className="flex items-center gap-4 text-xs shrink-0 pl-3">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#090f1e] border border-[#152236] rounded-full font-mono text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isCapturing && !paused ? "bg-[#00df6e] glow-active" : "bg-[#4a6580]"}`} />
            <span className="text-[#a8c0d8]" title="Live session stopwatch">{sessionTime}</span>
            <span className="text-[#4a6580]">|</span>
            <span className="text-[#00c8f0]" title="Active tracking profile">{isCapturing ? "LIVE FEED" : "OFFLINE"}</span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 bg-[#090f1e] border border-[#152236] rounded hover:border-[#00c8f0]/40 transition text-[#7a98b4] hover:text-white cursor-pointer shrink-0"
            title="S/R limits triggers"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

      </header>

      {/* Main workspace panels */}
      <div className="flex-grow flex overflow-hidden">
        
        {/* Left Side primary visual console viewport */}
        <div className="flex-grow flex flex-col overflow-hidden relative">
          
          <DrawingCanvas
            canvasRef={canvasRef}
            videoRef={videoRef}
            isCapturing={isCapturing}
            paused={paused}
            onStartCapture={handleStartCapture}
            onStartSimulation={handleStartSimulation}
            roiEnabled={roiEnabled}
            roiX={roiX}
            roiY={roiY}
            roiW={roiW}
            roiH={roiH}
            setRoiCoords={(x, y, w, h) => {
              setRoiX(x); setRoiY(y); setRoiW(w); setRoiH(h);
            }}
            diffOverlayActive={diffOverlayActive}
            onToggleDiff={() => setDiffOverlayActive((prev) => !prev)}
            onSaveScreenshot={handleSaveScreenshot}
          />

          {showPermissionOverlay && (
            <div className="absolute inset-0 bg-[#03070e]/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="max-w-md w-full bg-[#090f1e] border border-[#f03060]/30 rounded-xl p-5 shadow-2xl shadow-[#f03060]/5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#f03060]/10 border border-[#f03060]/30 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-[#f03060]" />
                  </div>
                  <div>
                    <h3 className="font-syne font-black text-white text-[13px] uppercase tracking-wider">
                      Sandbox Screen Capture Disallowed
                    </h3>
                    <p className="text-[11px] text-[#4a6580] font-mono mt-0.5">
                      Permissions Policy Error detected
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-[#b8d0e8] leading-relaxed flex flex-col gap-2.5">
                  <p>
                    The browser has blocked screen capture (<code className="bg-black/40 text-[#f03060] px-1 py-0.5 rounded font-mono font-bold text-[10px]">getDisplayMedia</code>) because this application is running inside a secure development <code className="text-white">iframe</code>.
                  </p>
                  
                  <div className="bg-[#152236]/30 border border-[#2d3e54] p-3 rounded-lg flex flex-col gap-2">
                    <span className="font-extrabold uppercase text-[9px] tracking-wider text-[#00c8f0] font-mono block">
                      ⚡ Actionable Solutions
                    </span>
                    <ul className="list-disc list-inside pl-1 text-[10.5px] text-[#7a98b4] flex flex-col gap-1.5 leading-relaxed">
                      <li>
                        <strong className="text-white">Open in New Tab</strong>: Click the small icon button <strong className="text-[#00c8f0]">"Open App in New Tab"</strong> at the very top-right corner of your browser's preview pane to bypass the iframe sandbox.
                      </li>
                      <li>
                        <strong className="text-white">Activate Simulator Mode</strong>: Bypass screen capture entirely and use our full high-fidelity chart simulator.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => {
                      setShowPermissionOverlay(false);
                      handleStartSimulation();
                    }}
                    className="w-full py-2 bg-[#9d78f8] hover:bg-[#9d78f8]/90 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#9d78f8]/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-white text-white" />
                    Activate Simulator Mode
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        window.open(window.location.href, "_blank");
                      }}
                      className="flex-1 py-1.5 bg-[#00c8f0]/10 hover:bg-[#00c8f0]/20 border border-[#00c8f0]/30 text-[#00c8f0] font-extrabold text-[10.5px] uppercase tracking-wider rounded transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Try Open New Tab
                    </button>
                    <button
                      onClick={() => setShowPermissionOverlay(false)}
                      className="py-1.5 px-3 bg-transparent hover:bg-white/5 border border-[#152236] text-[#7a98b4] hover:text-white font-extrabold text-[10.5px] uppercase tracking-wider rounded transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Tracker Charts */}
          <PerformanceCharts
            fpsHistory={fpsHistory}
            deltaHistory={deltaHistory}
            ocrConfHistory={ocrConfHistory}
            priceHistory={priceHistory}
            currentFps={rawFps}
            currentDelta={pixelDelta}
            currentConf={currentConf}
            currentTrend={priceTrend}
          />

        </div>

        {/* Right operations sidebar configuration */}
        <div className="w-[342px] border-l border-[#152236] bg-[#060c17] overflow-y-auto flex flex-col shrink-0">
          
          {/* Section: Live stats widget grid */}
          <div className="border-b border-[#152236] p-3 text-xs">
            <span className="text-[10px] font-semibold tracking-wider text-[#4a6580] uppercase flex items-center gap-1.5 font-syne mb-2">
              <Activity className="w-3.5 h-3.5 text-[#00c8f0]" />
              Local Session Indicators
            </span>
            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="p-2 bg-[#090f1e] border border-[#152236] rounded">
                <div className="text-[8px] uppercase text-[#4a6580]">Motion Steps</div>
                <div className="text-[15px] font-bold font-numeric-tabular text-[#00c8f0]">{detectionsCount}</div>
              </div>
              <div className="p-2 bg-[#090f1e] border border-[#152236] rounded">
                <div className="text-[8px] uppercase text-[#4a6580]">Trigger Alarms</div>
                <div className="text-[15px] font-bold font-numeric-tabular text-[#00df6e]">{alertsCount}</div>
              </div>
            </div>
            
            {/* Live active OCR index */}
            <div className="mt-2.5 p-2 bg-[#090f1e] border border-[#152236] rounded">
              <div className="flex justify-between items-center text-[9px] font-mono text-[#4a6580] uppercase mb-1">
                <span>OCR Buffer Snippet</span>
                <span className="text-[#00c8f0]">{currentConf.toFixed(0)}% accuracy</span>
              </div>
              <p className="text-[10.5px] leading-relaxed text-[#7a98b4] max-h-12 overflow-y-auto truncate whitespace-pre-wrap">
                {latestOcrText ? latestOcrText.slice(0, 180).trim() : <em className="text-[#4a6580] italic">No active text scanned inside monitoring bounds.</em>}
              </p>
            </div>
          </div>

          {/* Section: Candlestick Bible Studio & Simulator Controls */}
          <div className="border-b border-[#152236] p-3 text-xs bg-[#090f1e]/40 select-none">
            <span className="text-[10px] font-semibold tracking-wider text-[#9d78f8] uppercase flex items-center justify-between font-syne mb-2.5">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#9d78f8]" />
                Candlestick Bible Studio
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] bg-[#9d78f8]/10 text-[#9d78f8] font-mono uppercase tracking-wide">
                Interactive
              </span>
            </span>

            {/* Quick Presets Selectors */}
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-[9px] font-mono text-[#4a6580] uppercase block mb-1">Market Trend Structure</span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => {
                      setSimMarketStructure("trending-up");
                      addLog("Trend profile updated: Trending Bullish Structure.", "trading");
                    }}
                    className={`p-1 rounded font-bold text-[9px] border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      simMarketStructure === "trending-up"
                        ? "bg-[#00c8f0]/10 border-[#00c8f0] text-[#00c8f0]"
                        : "bg-[#060c17] border-[#152236] text-[#7a98b4] hover:text-white"
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    BULLISH
                  </button>
                  <button
                    onClick={() => {
                      setSimMarketStructure("trending-down");
                      addLog("Trend profile updated: Trending Bearish Structure.", "trading");
                    }}
                    className={`p-1 rounded font-bold text-[9px] border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      simMarketStructure === "trending-down"
                        ? "bg-[#f03060]/10 border-[#f03060] text-[#f03060]"
                        : "bg-[#060c17] border-[#152236] text-[#7a98b4] hover:text-white"
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    BEARISH
                  </button>
                  <button
                    onClick={() => {
                      setSimMarketStructure("range-bound");
                      addLog("Trend profile updated: Range-bound Consolidating Structure.", "trading");
                    }}
                    className={`p-1 rounded font-bold text-[9px] border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      simMarketStructure === "range-bound"
                        ? "bg-[#9d78f8]/10 border-[#9d78f8] text-[#9d78f8]"
                        : "bg-[#060c17] border-[#152236] text-[#7a98b4] hover:text-white"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    CONSOLIDATE
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-mono text-[#4a6580] uppercase block mb-1">Bible setup to Force Inject</span>
                <select
                  value={simFocusPattern}
                  onChange={(e) => {
                    const pat = e.target.value as any;
                    setSimFocusPattern(pat);
                    addLog(`Forced inject pattern: ${pat.toUpperCase()} set at Key Zone.`, "trading");
                  }}
                  className="w-full bg-[#060c17] border border-[#152236] text-[#00c8f0] font-sans font-bold text-[10.5px] p-1.5 focus:outline-none rounded focus:border-[#9d78f8]"
                >
                  <option value="pinbar">Bullish Hammer / Bearish Shooting Star</option>
                  <option value="engulfing">Bullish / Bearish Engulfing Candlesticks</option>
                  <option value="insidebar">Inside Bar Harami setup</option>
                  <option value="doji">Gravestone Doji Indecision Bar</option>
                  <option value="none">Disabled (Natural random wicks)</option>
                </select>
              </div>

              {/* Sliders for S/R Key Levels */}
              <div className="p-2 border border-[#152236] bg-[#060c17] rounded flex flex-col gap-2 mt-1">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-mono">
                    <span className="text-[#f03060] font-bold">Resistance Zone Limit</span>
                    <span className="text-white bg-[#f03060]/10 border border-[#f03060]/20 px-1 rounded">{resistancePriceY}px</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="280"
                    step="5"
                    value={resistancePriceY}
                    onChange={(e) => setResistancePriceY(parseInt(e.target.value))}
                    className="w-full h-1 bg-[#152236] rounded-lg appearance-none cursor-ew-resize accent-[#f03060]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-mono">
                    <span className="text-[#00df6e] font-bold">Support Zone Limit</span>
                    <span className="text-white bg-[#00df6e]/10 border border-[#00df6e]/30 px-1 rounded">{supportPriceY}px</span>
                  </div>
                  <input
                    type="range"
                    min="320"
                    max="580"
                    step="5"
                    value={supportPriceY}
                    onChange={(e) => setSupportPriceY(parseInt(e.target.value))}
                    className="w-full h-1 bg-[#152236] rounded-lg appearance-none cursor-ew-resize accent-[#00df6e]"
                  />
                </div>
              </div>

              {/* Real-time Programmatic scanner console display */}
              <div className="mt-1 p-2 bg-[#090f1e]/85 border border-[#152236] rounded">
                <div className="flex justify-between items-center mb-1 text-[8.5px] font-mono text-[#4a6580] uppercase">
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-[#00c8f0]" /> Formula Expert Scanner</span>
                  <span className="text-[#00df6e] flex items-center gap-0.5">● RUNNING</span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#7a98b4]">Detected Setup:</span>
                    <span className="font-bold text-[#00df6e] font-mono">
                      {simFocusPattern === "pinbar" ? "Bullish Hammer / Bearish Shooting Star" :
                       simFocusPattern === "engulfing" ? "Bullish / Bearish Engulfing Candle" :
                       simFocusPattern === "insidebar" ? "Harami Inside Bar" :
                       simFocusPattern === "doji" ? "Gravestone Doji Cross" : "Undecided Range wicks"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#152236]/35 pt-1 text-[10px]">
                    <span className="text-[#7a98b4]">Zone of Value:</span>
                    <span className="font-bold text-[#9d78f8]">
                      {simFocusPattern === "none" ? "Undetermined" : "HIGH ALIGNMENT OK"}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-[#a8c0d8] border-t border-[#152236]/35 pt-1.5 leading-relaxed font-mono">
                    <strong>Advice:</strong>{" "}
                    {simFocusPattern === "pinbar" ? "Wait for third bull-candle close confirm. Ideal long position target at next liquidity pocket." :
                     simFocusPattern === "engulfing" ? "Aggressive engulfment. Set limit order at 50% fib level retracement." :
                     simFocusPattern === "insidebar" ? "Contained inside Mother Candle bar. Breakout of mother extremes will dictate momentum vector." :
                     simFocusPattern === "doji" ? "Severe trend exhausted. Indicates potential quick reversal at the key resistance level." : "Monitor support bounce triggers."}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Section: Trade execution terminal & Accuracy metric */}
          <div className="border-b border-[#152236] p-3 text-xs bg-[#090f1e]/20 select-none">
            <span className="text-[10px] font-semibold tracking-wider text-[#00c8f0] uppercase flex items-center justify-between font-syne mb-2.5">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#00c8f0]" />
                Simulated Trade Terminal
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] bg-[#00c8f0]/10 text-[#00c8f0] font-mono uppercase tracking-wide">
                Live Performance
              </span>
            </span>

            {/* Balances & Metrics widgets */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono mb-3">
              <div className="p-1.5 bg-[#060c17] border border-[#152236] rounded">
                <div className="text-[7.5px] uppercase text-[#4a6580]">Live Balance</div>
                <div className="text-[11px] font-bold font-numeric-tabular text-white">${traderBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              
              <div className="p-1.5 bg-[#060c17] border border-[#152236] rounded">
                <div className="text-[7.5px] uppercase text-[#4a6580]">Win Rate Accuracy</div>
                <div className={`text-[11px] font-bold font-numeric-tabular ${
                  closedTrades.length === 0 ? "text-[#7a98b4]" :
                  (closedTrades.filter(t => t.result === "won").length / closedTrades.length) >= 0.5 ? "text-[#00df6e]" : "text-[#f03060]"
                }`}>
                  {closedTrades.length === 0 ? "0.0%" : `${((closedTrades.filter(t => t.result === "won").length / closedTrades.length) * 100).toFixed(1)}%`}
                </div>
              </div>

              <div className="p-1.5 bg-[#060c17] border border-[#152236] rounded">
                <div className="text-[7.5px] uppercase text-[#4a6580]">Realized Gains</div>
                {(() => {
                  const gain = closedTrades.reduce((acc, t) => acc + t.pnl, 0);
                  return (
                    <div className={`text-[11px] font-bold font-numeric-tabular ${gain >= 0 ? "text-[#00df6e]" : "text-[#f03060]"}`}>
                      {gain >= 0 ? "+" : ""}${gain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Risk Management Input Panel & Calculator */}
            <div className="mb-3 p-2 border border-[#152236] bg-[#060c17]/80 rounded flex flex-col gap-2 font-sans text-xs">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[#a8c0d8]">Custom Capital Risk (%)</span>
                <span className="text-[#00c8f0] font-bold bg-[#00c8f0]/10 border border-[#00c8f0]/20 px-1.5 py-0.5 rounded">
                  {riskPercentage}% Risk
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={riskPercentage}
                  onChange={(e) => setRiskPercentage(parseFloat(e.target.value))}
                  className="flex-grow h-1 bg-[#152236] rounded-lg appearance-none cursor-ew-resize accent-[#00c8f0]"
                />
                <input
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={riskPercentage}
                  onChange={(e) => {
                    const num = parseFloat(e.target.value);
                    if (!isNaN(num)) {
                      setRiskPercentage(Math.max(0.1, Math.min(50, num)));
                    }
                  }}
                  className="w-12 bg-[#090f1e] text-white border border-[#152236] p-1 rounded font-bold font-mono text-[10px] text-center focus:outline-none focus:border-[#9d78f8]"
                />
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono text-[#7a98b4] border-t border-[#152236]/40 pt-1.5">
                <span>Max risk value (USD):</span>
                <span className="text-[#f03060] font-bold">${(traderBalance * (riskPercentage / 100)).toFixed(2)}</span>
              </div>
              
              {!activeTrade && (
                <div className="bg-[#090f1e]/60 p-1.5 border border-[#152236]/45 rounded text-[8.5px] leading-relaxed font-mono text-[#a8c0d8] flex flex-col gap-0.5">
                  <div className="flex justify-between">
                    <span>Rec. Buy Size:</span>
                    <span className="text-[#00df6e] font-bold">
                      {(() => {
                        const currentPrice = currentSimPrice;
                        const pixelToPrice = (y: number) => 67420.50 + (360 - y) * 8.33;
                        const calculatedSlBuy = pixelToPrice(supportPriceY) - 150;
                        const slDistBuy = Math.abs(currentPrice - calculatedSlBuy);
                        const sizeBuy = slDistBuy > 0 ? (traderBalance * (riskPercentage / 100) / slDistBuy) : 0.15;
                        return `${parseFloat(Math.max(0.001, Math.min(10.0, sizeBuy)).toFixed(4))} BTC`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rec. Sell Size:</span>
                    <span className="text-[#f03060] font-bold">
                      {(() => {
                        const currentPrice = currentSimPrice;
                        const pixelToPrice = (y: number) => 67420.50 + (360 - y) * 8.33;
                        const calculatedSlSell = pixelToPrice(resistancePriceY) + 150;
                        const slDistSell = Math.abs(currentPrice - calculatedSlSell);
                        const sizeSell = slDistSell > 0 ? (traderBalance * (riskPercentage / 100) / slDistSell) : 0.15;
                        return `${parseFloat(Math.max(0.001, Math.min(10.0, sizeSell)).toFixed(4))} BTC`;
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Order Entry Buttons */}
            {!activeTrade ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenSimTrade("BUY")}
                    className="flex-grow py-2 bg-[#00df6e]/10 hover:bg-[#00df6e]/20 border border-[#00df6e]/40 hover:border-[#00df6e] text-[#00df6e] font-extrabold text-[10.5px] rounded tracking-wider flex items-center justify-center gap-1 cursor-pointer transition shadow-sm font-sans"
                  >
                    PLACE BUY ORDER
                  </button>
                  <button
                    onClick={() => handleOpenSimTrade("SELL")}
                    className="flex-grow py-2 bg-[#f03060]/10 hover:bg-[#f03060]/20 border border-[#f03060]/40 hover:border-[#f03060] text-[#f03060] font-extrabold text-[10.5px] rounded tracking-wider flex items-center justify-center gap-1 cursor-pointer transition shadow-sm font-sans"
                  >
                    PLACE SELL ORDER
                  </button>
                </div>
                <div className="text-[8.5px] font-mono text-[#4a6580] text-center italic leading-tight">
                  *Auto-derives TP & SL from the Candlestick Bible Support & Resistance Key levels.
                </div>
              </div>
            ) : (
              <div className="p-2 border border-[#9d78f8]/30 bg-[#9d78f8]/5 rounded flex flex-col gap-1.5 font-sans">
                <div className="flex justify-between items-center text-[9px] font-mono">
                  <span className={`px-1 rounded text-[8px] font-bold ${activeTrade.type === "BUY" ? "bg-[#00df6e]/20 text-[#00df6e]" : "bg-[#f03060]/20 text-[#f03060]"}`}>
                    ACTIVE simulated {activeTrade.type} POSITION
                  </span>
                  <span className="text-[#a8c0d8] font-bold">{activeTrade.pattern}</span>
                </div>

                <div className="flex flex-col gap-1 font-mono text-[9.5px] border-t border-[#152236]/35 pt-1.5">
                  <div className="flex justify-between text-[#7a98b4]">
                    <span>Entry / Qty:</span>
                    <span className="text-white">${activeTrade.entryPrice.toFixed(2)} / {activeTrade.size} BTC</span>
                  </div>
                  <div className="flex justify-between text-[#7a98b4]">
                    <span>Target TP / SL:</span>
                    <span className="text-white">${activeTrade.tp.toFixed(2)} / ${activeTrade.sl.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#7a98b4] border-t border-[#152236]/20 pt-1 mt-1 font-bold">
                    <span>Unrealized PnL:</span>
                    {(() => {
                      const pnl = activeTrade.type === "BUY"
                        ? (currentSimPrice - activeTrade.entryPrice) * activeTrade.size
                        : (activeTrade.entryPrice - currentSimPrice) * activeTrade.size;
                      return (
                        <span className={`${pnl >= 0 ? "text-[#00df6e]" : "text-[#f03060]"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USD
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <button
                  onClick={handleCloseActiveTrade}
                  className="w-full mt-1.5 py-1.5 bg-[#f03060] hover:bg-[#f03060]/90 text-white font-bold text-[10px] rounded cursor-pointer transition select-none tracking-wide"
                >
                  MANUALLY CLOSE POSITION
                </button>
              </div>
            )}

            {/* Display list of last closed trades */}
            {closedTrades.length > 0 && (
              <div className="mt-2.5 font-sans">
                <span className="text-[8.5px] font-mono text-[#4a6580] uppercase block mb-1">Closed Trades Execution Audit</span>
                <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                  {closedTrades.slice(0, 3).map((t) => (
                    <div key={t.id} className="p-1 bg-[#060c17]/60 border border-[#152236] rounded flex justify-between items-center text-[8.5px] font-mono">
                      <div className="flex flex-col">
                        <span className="text-white font-bold">{t.type} · ${t.entryPrice.toFixed(0)} → ${t.closedPrice.toFixed(0)}</span>
                        <span className="text-[#4a6580]">{t.pattern} · {t.closedAt}</span>
                      </div>
                      <span className={`font-bold px-1 rounded ${t.result === "won" ? "bg-[#00df6e]/10 text-[#00df6e]" : "bg-[#f03060]/10 text-[#f03060]"}`}>
                        {t.result === "won" ? "+" : ""}${t.pnl.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: Scrutinized Trading Analysis (Real-time indicators & system diagnostics) */}
          <div className="border-b border-[#152236] p-3 text-xs bg-[#090f1e]/45 select-none">
            <span className="text-[10px] font-semibold tracking-wider text-[#9d78f8] uppercase flex items-center justify-between font-syne mb-2.5">
              <span className="flex items-center gap-1.5 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9d78f8] inline-block shrink-0 shadow-[0_0_8px_#9d78f8]"></span>
                Scrutinized Trading Analysis
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] bg-[#9d78f8]/15 text-[#a78bfa] font-mono uppercase tracking-wide shrink-0">
                Continuous Stream
              </span>
            </span>

            {/* Diagnostic Indicator Widgets Grid */}
            <div className="grid grid-cols-2 gap-1.5 mb-2 w-full font-mono">
              {/* RSI Widget */}
              <div className="p-2 bg-[#060c17]/90 border border-[#152236] rounded flex flex-col justify-between">
                <div className="text-[7px] uppercase text-[#7a98b4] tracking-wider leading-none">Momentum (RSI-14)</div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-[12px] font-extrabold ${
                    calculatedRSI14 > 70 ? "text-[#f03060]" :
                    calculatedRSI14 < 30 ? "text-[#00df6e]" : "text-[#00c8f0]"
                  }`}>
                    {calculatedRSI14.toFixed(1)}
                  </span>
                  <span className={`text-[7.5px] font-bold uppercase shrink-0 ${
                    calculatedRSI14 > 70 ? "text-[#f03060]" :
                    calculatedRSI14 < 30 ? "text-[#00df6e]" : "text-[#4a6580]"
                  }`}>
                    {calculatedRSI14 > 70 ? "O-BOUGHT" :
                     calculatedRSI14 < 30 ? "O-SOLD" : "NEUTRAL"}
                  </span>
                </div>
              </div>

              {/* Volatility Standard Deviation Widget */}
              <div className="p-2 bg-[#060c17]/90 border border-[#152236] rounded flex flex-col justify-between">
                <div className="text-[7px] uppercase text-[#7a98b4] tracking-wider leading-none">Volatility (σ-20)</div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-[12px] font-extrabold text-white">
                    ${calculatedStdDev.toFixed(1)}
                  </span>
                  <span className="text-[7.5px] font-bold text-[#4a6580] uppercase shrink-0">
                    {calculatedStdDev > 100 ? "HIGH VOL" : "STABLE"}
                  </span>
                </div>
              </div>
            </div>

            {/* Moving Average Alignment Diagnostics */}
            <div className="p-2 bg-[#060c17]/40 border border-[#152236]/80 rounded mb-2.5 font-sans leading-relaxed text-[10px]/normal text-[#a8c0d8]">
              <div className="flex justify-between items-center text-[8.5px] font-mono text-[#4a6580] uppercase border-b border-[#152236]/35 pb-1 mb-1.5">
                <span>MA Comparison (SMA 5 vs 15)</span>
                <span className={`font-bold ${calculatedSMA5 >= calculatedSMA15 ? "text-[#00df6e]" : "text-[#f03060]"}`}>
                  {calculatedSMA5 >= calculatedSMA15 ? "BULLISH CROSS" : "BEARISH CROSS"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center font-mono">
                <div className="text-left">
                  <span className="text-[#4a6580] text-[7.5px] block">FAST SMA (5)</span>
                  <span className="text-white text-[10px] font-bold">${calculatedSMA5.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                </div>
                <div className="text-right">
                  <span className="text-[#4a6580] text-[7.5px] block">SLOW SMA (15)</span>
                  <span className="text-white text-[10px] font-bold">${calculatedSMA15.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                </div>
              </div>
            </div>

            {/* Key Level Proximity Matrix */}
            <div className="p-2 bg-[#060c17]/80 border border-[#152236] rounded font-mono text-[9px] flex flex-col gap-1.5">
              <span className="text-[8.5px] font-bold text-[#7a98b4] uppercase border-b border-[#152236]/35 pb-1">Value Support / Resistance Scan</span>
              
              <div className="flex justify-between items-center">
                <span className="text-[#7a98b4]">Distance to Resistance:</span>
                {(() => {
                  const pixelToPrice = (y: number) => 67420.50 + (360 - y) * 8.33;
                  const resPrice = pixelToPrice(resistancePriceY);
                  const dist = resPrice - currentSimPrice;
                  const pct = (dist / currentSimPrice) * 100;
                  return (
                    <span className={`font-bold ${dist <= 150 ? "text-[#f03060] animate-pulse" : "text-white"}`}>
                      +${dist.toFixed(1)} ({pct.toFixed(2)}%)
                    </span>
                  );
                })()}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#7a98b4]">Distance to Support:</span>
                {(() => {
                  const pixelToPrice = (y: number) => 67420.50 + (360 - y) * 8.33;
                  const supPrice = pixelToPrice(supportPriceY);
                  const dist = currentSimPrice - supPrice;
                  const pct = (dist / currentSimPrice) * 100;
                  return (
                    <span className={`font-bold ${dist <= 150 ? "text-[#00df6e] animate-pulse" : "text-white"}`}>
                      -${dist.toFixed(1)} ({pct.toFixed(2)}%)
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Performance Audit Metrics */}
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-center font-mono">
              <div className="p-1.5 bg-[#060c17]/60 border border-[#152236]/65 rounded">
                <span className="text-[7.5px] text-[#4a6580] uppercase block">Profit Factor</span>
                <span className="text-[11px] font-bold text-[#00df6e]">{getProfitFactor()}</span>
              </div>
              <div className="p-1.5 bg-[#060c17]/60 border border-[#152236]/65 rounded">
                <span className="text-[7.5px] text-[#4a6580] uppercase block">Max Drawdown</span>
                <span className="text-[11px] font-bold text-[#f03060]">{getMaxDrawdown()}</span>
              </div>
            </div>
          </div>

          <MultiTimeframeEngine
            getScreenshot={getScreenshotBase64}
            addLog={addLog}
            analyses={mtfAnalyses}
            setAnalyses={setMtfAnalyses}
            confluenceResult={mtfConfluenceResult}
            setConfluenceResult={setMtfConfluenceResult}
            purchases={purchases}
            activePaymentCode={activePaymentCode}
            setActivePaymentCode={setActivePaymentCode}
            currentUser={currentUser}
            onTriggerVerifyPayment={() => setIsVerifyPaymentOpen(true)}
            trialUsed={trialUsed}
            onUseTrial={handleUseTrial}
          />

          <AIPanel
            getScreenshot={getScreenshotBase64}
            ocrText={latestOcrText}
            onAddLog={addLog}
            customFocusModes={customFocusModes}
            isCapturing={isCapturing}
            paused={paused}
            onAiAnalysisCompleted={(text) => setLatestAIResponse(text)}
            purchases={purchases}
            activePaymentCode={activePaymentCode}
            setActivePaymentCode={setActivePaymentCode}
            currentUser={currentUser}
            onTriggerVerifyPayment={() => setIsVerifyPaymentOpen(true)}
            trialUsed={trialUsed}
            onUseTrial={handleUseTrial}
          />

          <AudioPanel
            soundEnabled={audioAlertsEnabled}
            onToggleSound={() => setAudioAlertsEnabled((prev) => !prev)}
            feedSpeechToAI={feedVoiceToAI}
            setFeedSpeechToAI={setFeedSpeechToAI}
            transcriptText={transcriptText}
            setTranscriptText={setTranscriptText}
            onAddLog={addLog}
          />

          <TeamPanel
            onAddLog={addLog}
            onSharedImageReceived={(img) => setP2pSharedImage(img)}
            onSharedAIReceived={(txt) => setP2pSharedAI(txt)}
            latestOcr={latestOcrText}
            latestAI={latestAIResponse}
            getScreenshot={getScreenshotBase64}
          />

          <PremiumStrategiesPanel
            currentUser={currentUser}
            onAddLog={addLog}
            mtfConfluenceResult={mtfConfluenceResult}
            purchases={purchases}
            onPurchaseSuccess={() => currentUser && fetchGlobalPurchases(currentUser)}
          />

          <GmailPanel
            accessToken={gmailAccessToken}
            onSignIn={signInWithGmail}
            onSignOut={() => {
              setGmailAccessToken(null);
              addLog("Gmail console logged out. Secure token wiped from in-memory cache.", "info");
            }}
            currentUser={currentUser}
            confluenceResult={mtfConfluenceResult}
            mtfAnalyses={mtfAnalyses}
            onAddLog={addLog}
            onInjectContext={handleInjectGmailContext}
          />

          {/* Section: Console Logs */}
          <div className="p-3 text-xs flex-grow flex flex-col justify-end">
            <span className="text-[10px] font-semibold tracking-wider text-[#4a6580] uppercase flex items-center gap-1.5 font-syne mb-2">
              <Clock className="w-3.5 h-3.5 text-[#00c8f0]" />
              Active Workspace Logs
            </span>
            <div className="bg-[#090f1e] border border-[#152236] rounded p-2.5 h-36 overflow-y-auto flex flex-col gap-1.5 select-text">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-1.5 items-start text-[10px] font-mono leading-none">
                  <span className="text-[#4a6580] shrink-0">{log.ts}</span>
                  <span
                    className={`leading-tight ${
                      log.type === "success"
                        ? "text-[#00df6e]"
                        : log.type === "error"
                        ? "text-[#f03060]"
                        : log.type === "high"
                        ? "text-[#ff8c00]"
                        : log.type === "trading"
                        ? "text-[#00c8f0]"
                        : "text-[#7a98b4]"
                    }`}
                  >
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLogs([{ ts: "00:00:00", msg: "Console wiped.", type: "info" }])}
              className="mt-1.5 text-[8.5px] uppercase tracking-wider text-[#4a6580] hover:text-white font-bold text-left cursor-pointer transition select-none self-start"
            >
              Wipe Console Log
            </button>
          </div>

        </div>

      </div>

      {/* Synchronized Shared overlays feedback */}
      <AnimatePresence>
        {p2pSharedImage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-[#03070e]/85 backdrop-blur-md flex items-center justify-center z-[150] p-4 select-none"
          >
            <div className="bg-[#060c17] border border-[#152236] p-4 rounded-lg flex flex-col gap-3 max-w-2xl w-full shadow-2xl relative">
              <span className="font-syne font-bold text-[#00c8f0] text-sm uppercase">P2P Shared Screen frame received</span>
              <img src={p2pSharedImage} className="rounded border border-[#152236] w-full" alt="Shared workspace frame" />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = p2pSharedImage;
                    link.download = `screensight_shared_${Date.now()}.png`;
                    link.click();
                  }}
                  className="px-3.5 py-1.5 bg-[#00c8f0] text-black text-[10.5px] font-bold rounded cursor-pointer hover:brightness-110 active:scale-95 transition"
                >
                  Save Frame
                </button>
                <button
                  onClick={() => setP2pSharedImage(null)}
                  className="px-3.5 py-1.5 bg-[#090f1e] border border-[#152236] text-[#b8d0e8] hover:text-white rounded cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        keywords={keywords}
        onAddKeyword={handleAddKeyword}
        onRemoveKeyword={handleRemoveKeyword}
        roiEnabled={roiEnabled}
        onToggleRoi={setRoiEnabled}
        roiX={roiX}
        roiY={roiY}
        roiW={roiW}
        roiH={roiH}
        onChangeRoiCoord={(field, val) => {
          if (field === "x") setRoiX(val);
          if (field === "y") setRoiY(val);
          if (field === "w") setRoiW(val);
          if (field === "h") setRoiH(val);
        }}
        webhooks={webhooks}
        onAddWebhook={handleAddWebhook}
        onRemoveWebhook={handleRemoveWebhook}
        onTestWebhooks={handleTestWebhooks}
        customFocusModes={customFocusModes}
        onAddFocusMode={handleAddFocusMode}
        onRemoveFocusMode={handleRemoveFocusMode}
        minOcrConf={minOcrConf}
        setMinOcrConf={setMinOcrConf}
        ocrIntervalMethod={ocrIntervalMethod}
        setOcrIntervalMethod={setOcrIntervalMethod}
        onAddLog={addLog}
      />

      <CloudHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        cloudConfluences={cloudConfluences}
        onLoadConfluence={loadHistoricalConfluence}
        onDeleteConfluence={deleteCloudConfluence}
      />

      <VerifyPaymentModal
        isOpen={isVerifyPaymentOpen}
        onClose={() => setIsVerifyPaymentOpen(false)}
        currentUser={currentUser}
        onPurchaseSuccess={() => {
          if (currentUser) {
            fetchGlobalPurchases(currentUser);
          }
        }}
        setActivePaymentCode={setActivePaymentCode}
        onAddLog={addLog}
      />

    </div>
  );

  // Manual fast shooter snapshot
  function handleSaveScreenshot() {
    triggerAudioBeep();
    const screenshot = getScreenshotBase64();
    if (!screenshot) {
      addLog("Unable to fetch visual screenshot. Activate capturing stream.", "error");
      return;
    }

    const link = document.createElement("a");
    link.href = `data:image/jpeg;base64,${screenshot}`;
    link.download = `screensight_snapshot_${Date.now()}.jpg`;
    link.click();
    addLog("Snapshot successfully downloaded to host.", "success");
  }
}
