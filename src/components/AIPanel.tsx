import React, { useState, useEffect, useRef } from "react";
import { Sparkles, MessageSquare, Clipboard, Send, RefreshCw, Layers } from "lucide-react";
import { FocusMode, ChatMessage, StructuredTradingData, LogEntry } from "../types";

interface AIPanelProps {
  getScreenshot: () => string | null;
  ocrText: string;
  onAddLog: (msg: string, type: LogEntry["type"]) => void;
  customFocusModes: FocusMode[];
  isCapturing: boolean;
  paused: boolean;
  onAiAnalysisCompleted: (text: string) => void;
  purchases: any[];
  activePaymentCode: string;
  setActivePaymentCode: (code: string) => void;
  currentUser: any;
  onTriggerVerifyPayment: () => void;
  trialUsed: boolean;
  onUseTrial: () => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({
  getScreenshot,
  ocrText,
  onAddLog,
  customFocusModes,
  isCapturing,
  paused,
  onAiAnalysisCompleted,
  purchases,
  activePaymentCode,
  setActivePaymentCode,
  currentUser,
  onTriggerVerifyPayment,
  trialUsed,
  onUseTrial,
}) => {
  const [aiFocus, setAiFocus] = useState<string>("trading");
  const [structuredOutput, setStructuredOutput] = useState<boolean>(true);
  const [isAnalyzing, setIsDrawing] = useState<boolean>(false);

  // Auto Tick states
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(false);
  const [autoIntervalSecs, setAutoIntervalSecs] = useState<number>(20);
  const [countdown, setCountdown] = useState<number>(20);

  // Analysis Result
  const [aiTextResult, setAiTextResult] = useState<string>("");
  const [structuredData, setStructuredTradingData] = useState<StructuredTradingData | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState<number>(0);
  const [tokensInfo, setTokensInfo] = useState<string>("");

  // Analysis History
  const [analysisHistory, setAnalysisHistory] = useState<{ ts: string; focus: string; summary: string; full: string; structured: boolean; structData?: StructuredTradingData }[]>([]);

  // Q&A Companion State
  const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
  const [qaInput, setQaInput] = useState<string>("");
  const [qaIncludeScreenshot, setQaIncludeScreenshot] = useState<boolean>(true);
  const [qaSending, setQaSending] = useState<boolean>(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Handle auto-analyze clock countdowns
  useEffect(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    if (!autoAnalyze || !isCapturing || paused) {
      setCountdown(autoIntervalSecs);
      return;
    }

    setCountdown(autoIntervalSecs);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          triggerQueryAnalysis();
          return autoIntervalSecs;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [autoAnalyze, autoIntervalSecs, isCapturing, paused]);

  // Scroll Chat to bottom on message updates
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [qaMessages]);

  const isPaymentVerified = (code: string) => {
    if (!code) return false;
    const formatted = code.toUpperCase().trim();
    return purchases.some((p: any) => p.transactionCode === formatted && p.status === "verified");
  };

  const triggerQueryAnalysis = async () => {
    if (!isCapturing) {
      onAddLog("Start canvas capture first before calling Gemini.", "error");
      return;
    }

    const screenshot = getScreenshot();
    if (!screenshot) {
      onAddLog("Visual workspace frame not loaded yet.", "error");
      return;
    }

    let paymentToPass = activePaymentCode ? activePaymentCode.toUpperCase().trim() : "";
    let isTrialRun = false;

    if (!isPaymentVerified(activePaymentCode)) {
      if (!trialUsed) {
        onAddLog("Free Trial: Running 1-time limited free trial analysis scan...", "info");
        paymentToPass = "FREE_TRIAL";
        isTrialRun = true;
      } else {
        onAddLog("Payment Required: Please select or enter a valid and verified 10-character M-Pesa transaction code as your activator to run analysis. Your free trial has already been used.", "error");
        setIsDrawing(false);
        onTriggerVerifyPayment();
        return;
      }
    }

    const tStart = performance.now();
    setIsDrawing(true);
    setAiTextResult("");
    setStructuredTradingData(null);

    try {
      // Determine prompt from custom Focus Modes list, or keep code logic
      let adjustedFocusPrompt = aiFocus;
      const customMode = customFocusModes.find((m) => m.id === aiFocus);
      if (customMode) {
        adjustedFocusPrompt = customMode.prompt;
      }

      onAddLog(`Interrogating Gemini visual system with payment activator [Mode: ${aiFocus}]`, "info");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-api-key": localStorage.getItem("custom_gemini_api_key") || ""
        },
        body: JSON.stringify({
          image: screenshot,
          mode: aiFocus.startsWith("custom_") ? "custom" : aiFocus,
          ocrSnip: ocrText.slice(0, 700),
          query: customMode ? customMode.prompt : undefined,
          structured: structuredOutput,
          paymentCode: paymentToPass
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP Response ${response.status}`);
      }

      if (isTrialRun) {
        onUseTrial();
      }

      const resData = await response.json();
      const elapsed = ((performance.now() - tStart) / 1000).toFixed(1);
      setElapsedSecs(parseFloat(elapsed));

      let contentStr = "";

      if (resData.structured && resData.data) {
        setStructuredTradingData(resData.data);
        contentStr = resData.data.summary || "Structured analysis extracted successfully.";
        setAiTextResult(JSON.stringify(resData.data, null, 2));

        // Sync with parent for P2P shared indicators
        onAiAnalysisCompleted(JSON.stringify(resData.data));
      } else {
        setAiTextResult(resData.text || "No insights emitted.");
        contentStr = resData.text;

        // Sync with parent
        onAiAnalysisCompleted(resData.text);
      }

      const timeStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
      const summaryStr = contentStr.slice(0, 65) + "...";

      // Append to local analysis history
      setAnalysisHistory((prev) => [
        {
          ts: timeStr,
          focus: aiFocus,
          summary: summaryStr,
          full: contentStr,
          structured: !!resData.structured,
          structData: resData.data,
        },
        ...prev.slice(0, 19), // Limit history list length to 20
      ]);

      setTokensInfo(`Gemini 3.5-flash · ${elapsed}s`);
      onAddLog(`Interrogation completed inside ${elapsed}s.`, "success");

    } catch (err: any) {
      console.error(err);
      setAiTextResult(`⚠ ANALYSIS PIPELINE ERROR: ${err.message}`);
      onAddLog(`Interrogation Error: ${err.message}`, "error");
    } finally {
      setIsDrawing(false);
    }
  };

  const handleSendQA = async () => {
    const question = qaInput.trim();
    if (!question) return;

    if (!isPaymentVerified(activePaymentCode)) {
      onAddLog("Payment Required: Please select or enter a valid and verified 10-character M-Pesa transaction code as your activator to use the chat companion.", "error");
      setQaMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "user",
          content: question,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          hasFrame: false
        },
        {
          id: Math.random().toString(),
          role: "assistant",
          content: "⚠ **Payment Required**: AI Companion chat is locked. Please activate your session in the 'Income Generating Strategies' panel using a verified M-Pesa transaction code.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
      setQaInput("");
      onTriggerVerifyPayment();
      return;
    }

    setQaInput("");
    setQaSending(true);

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = Math.random().toString();
    const screenshot = qaIncludeScreenshot ? getScreenshot() : null;

    // Append user message bubble
    setQaMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: question,
        timestamp: timeStr,
        hasFrame: !!screenshot,
      },
    ]);

    try {
      onAddLog(`Transmitting Q&A to chat companion...`, "info");

      // Format simple history for conversational context (max last 5 turns)
      const formattedHistory = qaMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-api-key": localStorage.getItem("custom_gemini_api_key") || ""
        },
        body: JSON.stringify({
          question,
          history: formattedHistory,
          currentImage: screenshot,
          ocrSnip: ocrText.slice(0, 600),
        }),
      });

      if (!response.ok) {
        throw new Error(`Companion route returned: ${response.status}`);
      }

      const result = await response.json();

      setQaMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content: result.reply || "Unable to formulate a response.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

    } catch (err: any) {
      console.error(err);
      setQaMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content: `⚠ Conversational Link Error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setQaSending(false);
    }
  };

  const handleCopyResult = () => {
    const textToCopy = structuredData ? JSON.stringify(structuredData, null, 2) : aiTextResult;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    onAddLog("Analytic telemetry copied to clipboard.", "info");
  };

  const handleLoadHistory = (item: typeof analysisHistory[0]) => {
    if (item.structured && item.structData) {
      setStructuredTradingData(item.structData);
      setAiTextResult(JSON.stringify(item.structData, null, 2));
    } else {
      setStructuredTradingData(null);
      setAiTextResult(item.full);
    }
    setTokensInfo(`Loaded via History Archive [${item.ts}]`);
  };

  return (
    <div className="border-b border-[#152236] p-3 text-xs flex flex-col gap-3">
      {/* Header bar */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-semibold tracking-wider text-[#9d78f8] uppercase flex items-center gap-1.5 font-syne">
          <Sparkles className="w-3.5 h-3.5 text-[#9d78f8] glow-active" />
          Google Gemini Core Engine
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00df6e]" />
          <button
            disabled={isAnalyzing || !isCapturing}
            onClick={triggerQueryAnalysis}
            className="px-2.5 py-1 bg-[#9d78f8]/10 hover:bg-[#9d78f8]/20 border border-[#9d78f8]/30 rounded text-[#9d78f8] font-bold text-[9.5px] uppercase transition cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isAnalyzing && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
            Analyze Now
          </button>
        </div>
      </div>

      {/* Payment Activator Input/Select */}
      <div className="p-2 border border-[#9d78f8]/20 bg-[#090f1e]/80 rounded flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[9px] font-mono text-[#7a98b4] uppercase tracking-wide">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9d78f8] animate-ping" />
            Analysis Activator M-Pesa Code
          </span>
          {isPaymentVerified(activePaymentCode) ? (
            <span className="text-[#00df6e] font-bold">● Subscribed</span>
          ) : !trialUsed ? (
            <span className="text-[#00df6e] font-bold">● 1 Free Trial Remaining</span>
          ) : (
            <span className="text-[#f03060] font-bold">● Trial Expired / Activation Required</span>
          )}
        </div>
        
        <div className="flex gap-1.5">
          {purchases.filter(p => p.status === "verified").length > 0 ? (
            <select
              value={activePaymentCode}
              onChange={(e) => setActivePaymentCode(e.target.value.toUpperCase().trim())}
              className="flex-grow bg-black border border-[#152236] px-2 py-1 rounded text-[10.5px] font-mono text-white focus:outline-none focus:border-[#9d78f8]/50 cursor-pointer"
            >
              <option value="">-- Select Active Payment Code --</option>
              {purchases.filter(p => p.status === "verified").map((p) => (
                <option key={p.transactionCode} value={p.transactionCode}>
                  {p.transactionCode} ({p.strategyId === "strat_analysis_pass" ? "Analysis Pass" : "Premium Strategy"})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="e.g. SDR2A349DF"
              maxLength={10}
              value={activePaymentCode}
              onChange={(e) => setActivePaymentCode(e.target.value.toUpperCase().trim())}
              className="flex-grow bg-black border border-[#152236] px-2 py-1 rounded text-[10.5px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#f03060]/50"
            />
          )}
          
          <button
            onClick={() => {
              if (activePaymentCode.length === 10) {
                onAddLog(`Activator key set: ${activePaymentCode}. Interrogator ready.`, "success");
              } else {
                onAddLog(`Invalid payment code. Must be 10 alphanumeric characters.`, "error");
              }
            }}
            className="px-2.5 py-1 bg-[#9d78f8]/10 hover:bg-[#9d78f8]/20 border border-[#9d78f8]/30 rounded text-[#9d78f8] text-[9.5px] font-bold uppercase cursor-pointer"
          >
            Apply
          </button>
        </div>
        <p className="text-[8.5px] text-[#4a6580] leading-tight">
          {trialUsed ? (
            <span>Your free trial has expired. Pay <strong className="text-white">KES 300</strong> to <strong className="text-white">0794300156</strong> in the <strong>Income Generating Strategies</strong> tab, and enter your 10-char receipt code above to continue.</span>
          ) : (
            <span>You have <strong className="text-[#00df6e]">1 FREE trial scan</strong> remaining. After that, subscription is required to run further premium analyses.</span>
          )}
        </p>
      </div>

      {/* Auto analyze ticking widgets */}
      <div className="flex items-center justify-between p-2 bg-[#090f1e] border border-[#152236] rounded">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="cb-auto"
            checked={autoAnalyze}
            onChange={(e) => setAutoAnalyze(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[#152236] bg-black text-[#9d78f8] focus:ring-0 cursor-pointer"
          />
          <label htmlFor="cb-auto" className="font-medium text-[#7a98b4] cursor-pointer">
            Auto-Analyze frame
          </label>
        </div>

        {autoAnalyze && (
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[#4a6580]">Every</span>
            <select
              value={autoIntervalSecs}
              onChange={(e) => setAutoIntervalSecs(parseInt(e.target.value))}
              className="bg-black border border-[#152236] px-1 py-0.5 rounded text-[10px] text-[#00c8f0] focus:ring-0"
            >
              <option value={10}>10s</option>
              <option value={20}>20s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
            <span className="text-[#9d78f8] tracking-widest font-bold min-w-8 text-right bg-black/40 px-1 rounded">
              {countdown}s
            </span>
          </div>
        )}
      </div>

      {/* Mode settings */}
      <div>
        <div className="text-[8px] font-mono text-[#4a6580] uppercase tracking-widest mb-1.5">Analytical Focus Mode</div>
        <div className="grid grid-cols-2 gap-1.5">
          <select
            value={aiFocus}
            onChange={(e) => setAiFocus(e.target.value)}
            className="bg-[#090f1e] text-[#b8d0e8] border border-[#152236] rounded p-1.5 text-[10.5px] w-full focus:outline-none focus:border-[#9d78f8]"
          >
            <option value="trading">📈 Chart Analysis</option>
            <option value="code">💻 Code Reviewer</option>
            <option value="data">📊 Statistics Audit</option>
            <option value="ui">🎨 Design Usability</option>
            <option value="general">👁 General Overview</option>
            {customFocusModes.map((m) => (
              <option key={m.id} value={m.id}>
                ⚡ {m.name}
              </option>
            ))}
          </select>

          {/* Structured selection */}
          <div className="flex items-center justify-center border border-[#152236] bg-[#090f1e] px-2 rounded">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[#7a98b4]">
              <input
                type="checkbox"
                checked={structuredOutput}
                disabled={aiFocus !== "trading"}
                onChange={(e) => setStructuredOutput(e.target.checked)}
                className="w-3.5 h-3.5 border-[#152236] bg-black text-[#9d78f8] rounded focus:ring-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              />
              Structured JSON
            </label>
          </div>
        </div>
      </div>

      {/* Main Analysis Display Board */}
      <div className="bg-[#090f1e] border border-[#152236] rounded p-3 min-h-24 relative overflow-hidden flex flex-col justify-between">
        {/* Shimmer loading feedback */}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#9d78f8]/5 to-transparent bg-[length:200%_100%] animate-pulse" />
        )}

        {structuredData && aiFocus === "trading" ? (
          // Visual Structured Stock/Crypto Bias Cards
          <div className="flex flex-col gap-2 font-sans animate-fade-in relative z-10">
            <div className="flex justify-between items-start">
              <span
                className={`font-black text-base uppercase leading-none font-syne tracking-wider ${
                  structuredData.bias === "bullish"
                    ? "text-[#00df6e]"
                    : `${structuredData.bias === "bearish" ? "text-[#f03060]" : "text-[#f5c842]"}`
                }`}
              >
                {structuredData.bias} DIRECTIONAL
              </span>
              <span className="text-[10px] bg-black/40 text-[#b8d0e8] px-2 py-0.5 rounded border border-[#152236] font-mono">
                CONF: {structuredData.confidence}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mt-1 font-mono">
              <div className="p-1 px-2 border border-[#152236] bg-black/35 rounded text-[10px]">
                <div className="text-[8px] uppercase text-[#4a6580]">Asset Price</div>
                <div className="font-bold text-white font-numeric-tabular">
                  {structuredData.price ? structuredData.price.toLocaleString(undefined, { maximumFractionDigits: 5 }) : "—"}
                </div>
              </div>
              <div className="p-1 px-2 border border-[#152236] bg-black/35 rounded text-[10px]">
                <div className="text-[8px] uppercase text-[#4a6580]">Chart Pattern</div>
                <div className="font-bold text-[#00c8f0] truncate">{structuredData.candlestickPattern || structuredData.pattern || "None Spotted"}</div>
              </div>
            </div>

            {/* Candlestick Bible parameters */}
            <div className="p-2 border border-[#152236] bg-[#0c1424] rounded flex flex-col gap-1.5 font-mono">
              <div className="text-[8.5px] uppercase text-[#9d78f8] tracking-wider font-extrabold border-b border-[#152236] pb-1">
                Candlestick Bible Specs
              </div>
              
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#7a98b4]">Structure:</span>
                <span className={`font-bold uppercase ${
                  structuredData.marketStructure === "trending-up" ? "text-[#00df6e]" :
                  structuredData.marketStructure === "trending-down" ? "text-[#f03060]" : "text-[#f5c842]"
                }`}>
                  {structuredData.marketStructure || "range-bound"}
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#7a98b4]">Zone of Value (S/R):</span>
                {structuredData.zoneOfValue ? (
                  <span className="text-[9px] bg-[#00df6e]/10 border border-[#00df6e]/30 px-1.5 py-0.5 rounded text-[#00df6e] font-extrabold uppercase">
                    ✓ VALID LEVEL
                  </span>
                ) : (
                  <span className="text-[9px] bg-[#f03060]/10 border border-[#f03060]/30 px-1.5 py-0.5 rounded text-[#f03060] font-extrabold uppercase">
                    ✗ FLOAT SETUP
                  </span>
                )}
              </div>
            </div>

            {/* Risk Management setup */}
            {(structuredData.entryPrice || structuredData.stopLoss || structuredData.takeProfit) && (
              <div className="grid grid-cols-3 gap-1 font-mono text-[9px] mt-0.5">
                <div className="p-1 px-1.5 border border-[#152236] bg-black/20 rounded">
                  <div className="text-[7.5px] uppercase text-[#4a6580]">Entry limit</div>
                  <div className="font-bold text-[#00c8f0] font-numeric-tabular">
                    {structuredData.entryPrice ? `$${structuredData.entryPrice.toFixed(1)}` : "—"}
                  </div>
                </div>
                <div className="p-1 px-1.5 border border-[#152236] bg-[#f03060]/5 rounded text-red-400">
                  <div className="text-[7.5px] uppercase text-red-500/80">Stop Loss</div>
                  <div className="font-bold font-numeric-tabular">
                    {structuredData.stopLoss ? `$${structuredData.stopLoss.toFixed(1)}` : "—"}
                  </div>
                </div>
                <div className="p-1 px-1.5 border border-[#152236] bg-[#00df6e]/5 rounded text-green-400">
                  <div className="text-[7.5px] uppercase text-green-500/80">Take Profit</div>
                  <div className="font-bold font-numeric-tabular">
                    {structuredData.takeProfit ? `$${structuredData.takeProfit.toFixed(1)}` : "—"}
                  </div>
                </div>
              </div>
            )}

            {structuredData.riskRewardRatio && (
              <div className="flex justify-between items-center text-[9.5px] bg-black/35 px-2 py-1 rounded border border-[#152236] font-mono mt-0.5">
                <span className="text-[#4a6580] text-[8.5px] uppercase">Risk-Reward Metric</span>
                <span className="text-[#00df6e] font-extrabold">{structuredData.riskRewardRatio}</span>
              </div>
            )}

            {/* S/R floor Ceil levels */}
            {structuredData.levels && structuredData.levels.length > 0 && (
              <div className="mt-1 flex flex-col gap-1 font-mono">
                <div className="text-[8.5px] uppercase text-[#4a6580] tracking-widest">Calculated support & resistance levels</div>
                <div className="grid grid-cols-1 gap-1">
                  {structuredData.levels.slice(0, 3).map((l, lIdx) => (
                    <div
                      key={lIdx}
                      className={`flex justify-between items-center text-[10px] p-1 px-2 border rounded ${
                        l.type === "resistance"
                          ? "bg-[#f03060]/5 border-[#f03060]/20 text-[#f03060]"
                          : "bg-[#00df6e]/5 border-[#00df6e]/20 text-[#00df6e]"
                      }`}
                    >
                      <span className="font-bold font-numeric-tabular">{l.price}</span>
                      <span className="text-[9px] uppercase tracking-widest opacity-80">
                        {l.type === "resistance" ? "Resistance" : "Support"} · {l.note || "Touches"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Structured Confidence Progress bar */}
            <div className="w-full bg-[#152236] h-1 rounded overflow-hidden mt-1 relative">
              <div
                className="h-full rounded transition-all duration-300"
                style={{
                  width: `${structuredData.confidence}%`,
                  backgroundColor:
                    structuredData.confidence > 70
                      ? "#00df6e"
                      : structuredData.confidence > 45
                      ? "#f5c842"
                      : "#f03060",
                }}
              />
            </div>

            <p className="text-[10px] text-[#7a98b4] italic mt-1 leading-relaxed border-t border-[#152236] pt-1 ml-[1px]">
              {structuredData.summary}
            </p>
          </div>
        ) : (
          // Freeform general texts
          <div className="text-[11px] leading-relaxed text-[#b8d0e8] whitespace-pre-wrap font-mono min-h-24 relative z-10 transition-all">
            {aiTextResult ? (
              aiTextResult
            ) : (
              <em className="text-[#4a6580] italic">
                No telemetry generated. Select a target analysis mode and trigger using manual buttons or automatic timers.
              </em>
            )}
          </div>
        )}

        {aiTextResult && (
          <div className="flex justify-between items-center border-t border-[#152236] mt-3.5 pt-2 relative z-10">
            <span className="text-[9.5px] font-mono text-[#4a6580]">{tokensInfo}</span>
            <button
              onClick={handleCopyResult}
              className="px-2 py-0.5 bg-[#0b1322] hover:text-[#00c8f0] border border-[#152236] rounded font-mono text-[9px] font-bold cursor-pointer transition flex items-center gap-1.5"
            >
              <Clipboard className="w-3 h-3" />
              Copy Output
            </button>
          </div>
        )}
      </div>

      {/* Historical analyses logs */}
      {analysisHistory.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[8.5px] font-mono tracking-widest text-[#4a6580] uppercase">Analysis History Logs</div>
          <div className="bg-[#090f1e] border border-[#152236] rounded max-h-20 overflow-y-auto">
            {analysisHistory.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleLoadHistory(item)}
                className="flex items-center justify-between p-1.5 px-2 border-b border-[#152236]/35 last:border-b-0 hover:bg-white/5 cursor-pointer text-[10px] transition"
              >
                <div className="flex gap-1.5 items-center">
                  <span className="font-mono text-[#4a6580]">{item.ts}</span>
                  <span className="font-bold text-[#9d78f8]">{item.focus}</span>
                </div>
                <span className="text-[#7a98b4] truncate max-w-[180px]">{item.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grounded Interactive Q&A chat */}
      <div className="border-t border-[#152236] pt-3.5 flex flex-col gap-2.5">
        <span className="text-[10px] font-semibold tracking-wider text-[#00c8f0] uppercase flex items-center gap-1.5 font-syne">
          <MessageSquare className="w-3.5 h-3.5 text-[#00c8f0]" />
          Conversational Grounding Companion
        </span>

        {/* Message scroll viewport */}
        <div ref={chatScrollRef} className="bg-[#090f1e] border border-[#152236] rounded p-2.5 h-32 overflow-y-auto flex flex-col gap-2.5">
          {qaMessages.length === 0 ? (
            <em className="text-[#4a6580] italic text-[10px] leading-relaxed self-center my-auto text-center max-w-[240px]">
              Query Gemini dynamically about the current screenshot, charts, code segments, or statistical tables.
            </em>
          ) : (
            qaMessages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col max-w-[85%] rounded p-2 text-[10.5px] leading-relaxed select-text animate-fade-in ${
                  m.role === "user"
                    ? "bg-[#00c8f0]/10 border border-[#00c8f0]/25 text-[#b8d0e8] self-end rounded-br-none"
                    : "bg-[#9d78f8]/10 border border-[#9d78f8]/25 text-[#b8d0e8] self-start rounded-bl-none"
                }`}
              >
                <div className="font-mono text-[8px] text-[#4a6580] mb-0.5 self-end tracking-wider uppercase">
                  {m.role === "user" ? "You" : "Gemini Analyst"} · {m.timestamp}
                </div>
                {m.hasFrame && (
                  <span className="text-[8px] font-mono text-[#00c8f0] uppercase leading-none block mb-1">
                    📷 With Grounding screenshot
                  </span>
                )}
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))
          )}

          {qaSending && (
            <div className="bg-[#9d78f8]/5 border border-[#9d78f8]/15 rounded p-2 text-[10.5px] text-[#4a6580] self-start rounded-bl-none animate-pulse w-32">
              Gemini model typing...
            </div>
          )}
        </div>

        {/* Q&A controls input */}
        <div className="flex gap-2">
          <textarea
            value={qaInput}
            onChange={(e) => setQaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendQA();
              }
            }}
            placeholder="Ask anything about what is visible on screen..."
            rows={1}
            disabled={qaSending}
            className="flex-grow bg-[#090f1e] text-[#b8d0e8] placeholder-[#4a6580] border border-[#152236] rounded px-3 py-2 text-[10.5px] resize-none focus:outline-none focus:border-[#00c8f0]"
          />
          <button
            onClick={handleSendQA}
            disabled={qaSending || !qaInput.trim()}
            className="px-3.5 py-2 bg-[#00c8f0] text-black hover:brightness-110 rounded flex items-center justify-center font-bold cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex justify-between items-center text-[10px]">
          <label className="flex items-center gap-2 cursor-pointer relative text-[#7a98b4]">
            <input
              type="checkbox"
              checked={qaIncludeScreenshot}
              onChange={(e) => setQaIncludeScreenshot(e.target.checked)}
              className="rounded border-[#152236] bg-black text-[#00c8f0] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            Attach screenshot to grounding prompt
          </label>

          <button
            onClick={() => setQaMessages([])}
            className="text-[#4a6580] hover:text-[#f03060] font-semibold transition"
          >
            Clear Conversation
          </button>
        </div>
      </div>
    </div>
  );
};
