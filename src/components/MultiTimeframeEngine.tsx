import React, { useState, useEffect } from "react";
import { 
  Layers, 
  Camera, 
  BrainCircuit, 
  RotateCcw, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  AlertTriangle,
  HelpCircle,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Timer,
  Play,
  Pause,
  ChevronRight
} from "lucide-react";

export interface TimeframeAnalysis {
  timeframe: string;
  bias: string;
  trend: string;
  candlestickPattern: string;
  chartPattern: string;
  smcSignals: string;
  supportLevel?: string | null;
  resistanceLevel?: string | null;
  momentum?: string;
  movingAverageAlignment?: string;
  summary: string;
}

export interface ConfluenceResult {
  overallBias: string;
  confluenceScore: number;
  dominantNarrative: string;
  alignedTimeframes: string[];
  conflictingTimeframes: string[];
  tacticalEntryPlan: {
    entryTrigger: string;
    stopLoss: string;
    takeProfit: string;
    riskRewardRatio: string;
    executionStrategy: string;
  };
}

interface MultiTimeframeEngineProps {
  getScreenshot: () => string | null;
  addLog: (msg: string, type?: "info" | "success" | "error" | "high" | "trading") => void;
  analyses: Record<string, TimeframeAnalysis>;
  setAnalyses: React.Dispatch<React.SetStateAction<Record<string, TimeframeAnalysis>>>;
  confluenceResult: ConfluenceResult | null;
  setConfluenceResult: React.Dispatch<React.SetStateAction<ConfluenceResult | null>>;
  purchases: any[];
  activePaymentCode: string;
  setActivePaymentCode: (code: string) => void;
  currentUser: any;
  onTriggerVerifyPayment: () => void;
  trialUsed: boolean;
  onUseTrial: () => void;
}

const ALL_TIMEFRAMES = ["Monthly", "Weekly", "Daily", "4H", "1H", "15M", "5M", "1M"];

export const MultiTimeframeEngine: React.FC<MultiTimeframeEngineProps> = ({ 
  getScreenshot, 
  addLog,
  analyses,
  setAnalyses,
  confluenceResult,
  setConfluenceResult,
  purchases,
  activePaymentCode,
  setActivePaymentCode,
  currentUser,
  onTriggerVerifyPayment,
  trialUsed,
  onUseTrial
}) => {
  const isPaymentVerified = (code: string) => {
    if (!code) return false;
    const formatted = code.toUpperCase().trim();
    return purchases.some((p: any) => p.transactionCode === formatted && p.status === "verified");
  };

  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(["Daily", "4H", "1H", "15M"]);
  const [capturedImages, setCapturedImages] = useState<Record<string, string>>({});
  const [loadingTimeframe, setLoadingTimeframe] = useState<string | null>(null);
  const [runningConfluence, setRunningConfluence] = useState<boolean>(false);
  const [expandedTimeframe, setExpandedTimeframe] = useState<string | null>(null);

  // Auto-Capture Sequence State
  const [isAutoSequenceActive, setIsAutoSequenceActive] = useState<boolean>(false);
  const [pacingMode, setPacingMode] = useState<"countdown" | "manual">("countdown");
  const [countdownInterval, setCountdownInterval] = useState<number>(10); // in seconds
  const [currentTfIndex, setCurrentTfIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(10);

  // Toggle active slot in the suite
  const handleToggleTimeframeSelection = (tf: string) => {
    if (isAutoSequenceActive) {
      addLog("Cannot configure timeframes while Auto-Capture Sequence is active.", "error");
      return;
    }
    if (selectedTimeframes.includes(tf)) {
      if (selectedTimeframes.length > 2) {
        setSelectedTimeframes(prev => prev.filter(t => t !== tf));
        // Clean state
        const updatedImages = { ...capturedImages };
        delete updatedImages[tf];
        setCapturedImages(updatedImages);

        const updatedAnalyses = { ...analyses };
        delete updatedAnalyses[tf];
        setAnalyses(updatedAnalyses);
      } else {
        addLog("Maintain at least 2 active timeframes for meaningful top-down comparison.", "error");
      }
    } else {
      setSelectedTimeframes(prev => [...prev, tf]);
    }
  };

  // Capture screenshot of current TradingView chart specifically for this timeframe slot
  const handleCaptureSlot = (tf: string): string | null => {
    const shot = getScreenshot();
    if (!shot) {
      addLog(`No active screen capture source. Please start a session or run simulation first.`, "error");
      return null;
    }
    setCapturedImages(prev => ({ ...prev, [tf]: shot }));
    addLog(`Captured live chart frame for ${tf} timeframe. Hit "Analyze" to parse.`, "success");
    return shot;
  };

  // Trigger individual quantitative scan
  const handleAnalyzeSlot = async (tf: string, directImage?: string) => {
    const image = directImage || capturedImages[tf];
    if (!image) {
      addLog(`Capture a visual frame for ${tf} first before scanning.`, "error");
      return null;
    }

    let paymentToPass = activePaymentCode ? activePaymentCode.toUpperCase().trim() : "";
    let isTrialRun = false;

    if (!isPaymentVerified(activePaymentCode)) {
      if (!trialUsed) {
        addLog(`Free Trial: Running 1-time limited free trial scan on ${tf} frame...`, "info");
        paymentToPass = "FREE_TRIAL";
        isTrialRun = true;
      } else {
        addLog(`Payment Required: A valid, verified 10-character M-Pesa activator code is required to trigger ${tf} analysis. Your free trial has already been used.`, "error");
        onTriggerVerifyPayment();
        return null;
      }
    }

    setLoadingTimeframe(tf);
    addLog(`Initiating complete multi-discipline scanning on ${tf} frame...`, "info");

    try {
      const response = await fetch("/api/analyze-timeframe", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-api-key": localStorage.getItem("custom_gemini_api_key") || ""
        },
        body: JSON.stringify({
          image,
          timeframe: tf,
          paymentCode: paymentToPass
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed timeframe visual parse.");
      }

      if (isTrialRun) {
        onUseTrial();
      }

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        setAnalyses(prev => ({ ...prev, [tf]: resJson.data }));
        addLog(`Successfully completed high-scrutiny visual analysis of ${tf} timeframe.`, "success");
        return resJson.data;
      } else {
        throw new Error("No structured data returned.");
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Failed scanning ${tf} timeframe: ${err.message}`, "error");
      return null;
    } finally {
      setLoadingTimeframe(null);
    }
  };

  // Single flow to capture and analyze a timeframe (bypasses state race condition)
  const runCaptureAndAnalyze = async (tf: string): Promise<TimeframeAnalysis | null> => {
    const shot = getScreenshot();
    if (!shot) {
      addLog(`Auto-Sequence [${tf}]: No active screen capture source. Start capture first.`, "error");
      return null;
    }
    setCapturedImages(prev => ({ ...prev, [tf]: shot }));
    addLog(`Auto-Sequence [${tf}]: Live frame stored. Initiating visual analysis...`, "info");

    let paymentToPass = activePaymentCode ? activePaymentCode.toUpperCase().trim() : "";
    let isTrialRun = false;

    if (!isPaymentVerified(activePaymentCode)) {
      if (!trialUsed) {
        addLog(`Free Trial [${tf}]: Running 1-time limited free trial scan...`, "info");
        paymentToPass = "FREE_TRIAL";
        isTrialRun = true;
      } else {
        addLog(`Payment Required: A valid, verified 10-character M-Pesa activator code is required to trigger ${tf} analysis. Your free trial has already been used.`, "error");
        onTriggerVerifyPayment();
        return null;
      }
    }

    setLoadingTimeframe(tf);
    try {
      const response = await fetch("/api/analyze-timeframe", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-api-key": localStorage.getItem("custom_gemini_api_key") || ""
        },
        body: JSON.stringify({
          image: shot,
          timeframe: tf,
          paymentCode: paymentToPass
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed timeframe visual parse.");
      }

      if (isTrialRun) {
        onUseTrial();
      }

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        setAnalyses(prev => ({ ...prev, [tf]: resJson.data }));
        addLog(`Auto-Sequence [${tf}]: Visual analysis completed successfully.`, "success");
        return resJson.data;
      } else {
        throw new Error("No structured data returned.");
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Auto-Sequence [${tf}] Failed: ${err.message}`, "error");
      return null;
    } finally {
      setLoadingTimeframe(null);
    }
  };

  // Core capture & advance trigger used by both pacing modes
  const advanceSequence = async () => {
    if (selectedTimeframes.length === 0) return;
    const currentTf = selectedTimeframes[currentTfIndex];
    
    // Capture & scan current timeframe
    const result = await runCaptureAndAnalyze(currentTf);
    
    if (currentTfIndex < selectedTimeframes.length - 1) {
      // Advance to next timeframe index
      setCurrentTfIndex(prev => prev + 1);
      if (pacingMode === "countdown") {
        setTimeLeft(countdownInterval);
      }
    } else {
      // Last timeframe captured! Complete auto sequence and trigger top-down confluence automatically.
      setIsAutoSequenceActive(false);
      addLog("Auto-Capture Sequence completed! Formulating top-down market confluence...", "success");
      
      const finalAnalyses = { ...analyses };
      if (result) {
        finalAnalyses[currentTf] = result;
      }

      const listToCompare = Object.values(finalAnalyses).filter(Boolean);
      if (listToCompare.length >= 2) {
        let paymentToPass = activePaymentCode ? activePaymentCode.toUpperCase().trim() : "";
        let isTrialRun = false;

        if (!isPaymentVerified(activePaymentCode)) {
          if (!trialUsed) {
            addLog("Free Trial: Computing top-down confluence synthesis on 1-time trial pass...", "info");
            paymentToPass = "FREE_TRIAL";
            isTrialRun = true;
          } else {
            addLog("Payment Required: A valid, verified 10-character M-Pesa activator code is required to compute confluence synthesis. Your free trial has already been used.", "error");
            onTriggerVerifyPayment();
            return;
          }
        }

        setRunningConfluence(true);
        try {
          const response = await fetch("/api/confluence", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-custom-api-key": localStorage.getItem("custom_gemini_api_key") || ""
            },
            body: JSON.stringify({
              timeframeAnalyses: listToCompare,
              paymentCode: paymentToPass
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed confluence calculation.");
          }

          if (isTrialRun) {
            onUseTrial();
          }

          const resJson = await response.json();
          if (resJson.success && resJson.data) {
            setConfluenceResult(resJson.data);
            addLog(`Top-down Confluence Engine completed with Score ${resJson.data.confluenceScore}%!`, "success");
          }
        } catch (err: any) {
          addLog(`Failed top-down confluence synthesis: ${err.message}`, "error");
        } finally {
          setRunningConfluence(false);
        }
      }
    }
  };

  // Countdown timer clock cycle
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isAutoSequenceActive && pacingMode === "countdown") {
      if (timeLeft > 0) {
        timer = setTimeout(() => {
          setTimeLeft(prev => prev - 1);
        }, 1000);
      } else {
        advanceSequence();
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAutoSequenceActive, pacingMode, timeLeft, currentTfIndex, selectedTimeframes]);

  // Handle active sequence toggle
  const handleToggleAutoSequence = () => {
    if (isAutoSequenceActive) {
      setIsAutoSequenceActive(false);
      addLog("Auto-Capture Sequence aborted by user.", "info");
    } else {
      setIsAutoSequenceActive(true);
      setCurrentTfIndex(0);
      setTimeLeft(countdownInterval);
      addLog(`Auto-Capture Sequence started. Switch your chart to the active timeframe slot!`, "high");
    }
  };

  // Trigger secondary Top-down Confluence Pass manually
  const handleRunConfluence = async () => {
    const listToCompare = Object.values(analyses).filter(Boolean);
    if (listToCompare.length < 2) {
      addLog(`Analyze at least 2 active timeframes first before running top-down confluence.`, "error");
      return;
    }

    let paymentToPass = activePaymentCode ? activePaymentCode.toUpperCase().trim() : "";
    let isTrialRun = false;

    if (!isPaymentVerified(activePaymentCode)) {
      if (!trialUsed) {
        addLog("Free Trial: Computing top-down confluence synthesis on 1-time trial pass...", "info");
        paymentToPass = "FREE_TRIAL";
        isTrialRun = true;
      } else {
        addLog("Payment Required: A valid, verified 10-character M-Pesa activator code is required to compute confluence synthesis. Your free trial has already been used.", "error");
        onTriggerVerifyPayment();
        return;
      }
    }

    setRunningConfluence(true);
    addLog("Assembling and weighting timeframe matrices. Querying Confluence Engine...", "info");

    try {
      const response = await fetch("/api/confluence", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-custom-api-key": localStorage.getItem("custom_gemini_api_key") || ""
        },
        body: JSON.stringify({
          timeframeAnalyses: listToCompare,
          paymentCode: paymentToPass
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed confluence calculation.");
      }

      if (isTrialRun) {
        onUseTrial();
      }

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        setConfluenceResult(resJson.data);
        addLog(`Top-down Confluence Engine completed with Score ${resJson.data.confluenceScore}%!`, "success");
      } else {
        throw new Error("Confluence report missing from payload.");
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Failed top-down confluence synthesis: ${err.message}`, "error");
    } finally {
      setRunningConfluence(false);
    }
  };

  // Reset Engine
  const handleResetEngine = () => {
    setCapturedImages({});
    setAnalyses({});
    setConfluenceResult(null);
    setIsAutoSequenceActive(false);
    setCurrentTfIndex(0);
    addLog("Cleared all multi-timeframe slots & confluence matrices.", "info");
  };

  return (
    <div id="multi-timeframe-engine" className="border-b border-[#152236] p-3 text-xs bg-[#090f1e]/80 select-none">
      {/* Title */}
      <span className="text-[10px] font-semibold tracking-wider text-[#00c8f0] uppercase flex items-center justify-between font-syne mb-2">
        <span className="flex items-center gap-1.5 font-sans">
          <Layers className="w-3.5 h-3.5 text-[#00c8f0]" />
          Multi-Timeframe Confluence Engine
        </span>
        <span className="px-1.5 py-0.5 rounded text-[8px] bg-[#00c8f0]/10 text-[#00c8f0] font-mono uppercase tracking-wide">
          Top-Down Pass
        </span>
      </span>

      {/* Timeframe Chips Selector */}
      <div className="mb-3">
        <span className="text-[8.5px] font-mono text-[#4a6580] uppercase block mb-1.5">Configure Target Timeframe Suite:</span>
        <div className="flex flex-wrap gap-1">
          {ALL_TIMEFRAMES.map(tf => {
            const isSelected = selectedTimeframes.includes(tf);
            const isAnalyzed = !!analyses[tf];
            return (
              <button
                key={tf}
                disabled={isAutoSequenceActive}
                onClick={() => handleToggleTimeframeSelection(tf)}
                className={`px-1.5 py-1 text-[9px] font-bold rounded font-mono transition border ${
                  isSelected 
                    ? isAnalyzed 
                      ? "bg-[#00df6e]/15 border-[#00df6e]/40 text-[#00df6e]" 
                      : "bg-[#00c8f0]/15 border-[#00c8f0]/40 text-[#00c8f0]"
                    : "bg-[#060c17]/60 border-[#152236] text-[#4a6580] hover:text-[#7a98b4] hover:border-[#1e2d44]"
                } ${isAutoSequenceActive ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {tf}
                {isAnalyzed && " ✓"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment Activator Input/Select */}
      <div className="mb-3 p-2 border border-[#00c8f0]/20 bg-[#060c17]/80 rounded flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[9px] font-mono text-[#7a98b4] uppercase tracking-wide">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00c8f0] animate-ping" />
            Confluence Activator M-Pesa Code
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
              className="flex-grow bg-black border border-[#152236] px-2 py-1 rounded text-[10.5px] font-mono text-white focus:outline-none focus:border-[#00c8f0]/50 cursor-pointer"
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
              className="flex-grow bg-black border border-[#152236] px-2 py-1 rounded text-[10.5px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#00c8f0]/50"
            />
          )}
          
          <button
            onClick={() => {
              if (activePaymentCode.length === 10) {
                addLog(`Confluence activator key set: ${activePaymentCode}. Engine ready.`, "success");
              } else {
                addLog(`Invalid payment code. Must be 10 alphanumeric characters.`, "error");
              }
            }}
            className="px-2.5 py-1 bg-[#00c8f0]/10 hover:bg-[#00c8f0]/20 border border-[#00c8f0]/30 rounded text-[#00c8f0] text-[9.5px] font-bold uppercase cursor-pointer"
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

      {/* Auto-Capture Sequence Panel */}
      <div className="mb-3 p-2 bg-[#060c17]/90 border border-[#152236] rounded flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[9px] font-mono font-bold text-[#9d78f8] uppercase flex items-center gap-1">
            <Timer className="w-3.5 h-3.5 text-[#9d78f8]" />
            Auto-Capture Sequence
          </span>
          <button
            onClick={handleToggleAutoSequence}
            className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wider font-mono transition border flex items-center gap-1 ${
              isAutoSequenceActive 
                ? "bg-[#f03060]/10 border-[#f03060]/30 text-[#f03060] animate-pulse" 
                : "bg-[#9d78f8]/10 border-[#9d78f8]/30 text-[#c084fc] hover:bg-[#9d78f8]/20"
            }`}
          >
            {isAutoSequenceActive ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
            {isAutoSequenceActive ? "STOP SEQUENCE" : "START SEQUENCE"}
          </button>
        </div>

        {/* Configuration row inside Auto-Capture */}
        <div className="grid grid-cols-2 gap-2 text-[8px] font-mono pb-1 border-b border-[#152236]/40">
          <div>
            <span className="text-[#4a6580] block mb-1">PACING MODE:</span>
            <div className="flex gap-1">
              <button
                disabled={isAutoSequenceActive}
                onClick={() => setPacingMode("countdown")}
                className={`flex-1 py-0.5 rounded text-[8px] font-bold border transition ${
                  pacingMode === "countdown" 
                    ? "bg-[#00c8f0]/15 border-[#00c8f0]/30 text-[#00c8f0]" 
                    : "bg-[#090f1e] border-[#152236] text-[#4a6580] hover:text-white"
                }`}
              >
                COUNTDOWN
              </button>
              <button
                disabled={isAutoSequenceActive}
                onClick={() => setPacingMode("manual")}
                className={`flex-1 py-0.5 rounded text-[8px] font-bold border transition ${
                  pacingMode === "manual" 
                    ? "bg-[#00c8f0]/15 border-[#00c8f0]/30 text-[#00c8f0]" 
                    : "bg-[#090f1e] border-[#152236] text-[#4a6580] hover:text-white"
                }`}
              >
                MANUAL
              </button>
            </div>
          </div>

          <div>
            <span className="text-[#4a6580] block mb-1">INTERVAL:</span>
            <div className="flex gap-0.5">
              {[5, 10, 15, 30].map(val => (
                <button
                  key={val}
                  disabled={isAutoSequenceActive || pacingMode === "manual"}
                  onClick={() => setCountdownInterval(val)}
                  className={`flex-1 py-0.5 text-[8px] font-bold rounded border transition ${
                    countdownInterval === val && pacingMode !== "manual"
                      ? "bg-[#9d78f8]/15 border-[#9d78f8]/30 text-[#c084fc]" 
                      : "bg-[#090f1e] border-[#152236] text-[#4a6580] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                  }`}
                >
                  {val}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live progress flow bar / tracker */}
        <div className="flex items-center gap-1 py-1 overflow-x-auto select-none">
          {selectedTimeframes.map((tf, idx) => {
            const isDone = !!analyses[tf];
            const isCurrent = isAutoSequenceActive && currentTfIndex === idx;
            return (
              <div key={tf} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <ChevronRight className="w-2.5 h-2.5 text-[#152236]" />}
                <div className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border flex items-center gap-1 ${
                  isCurrent 
                    ? "bg-[#00c8f0]/20 border-[#00c8f0] text-[#00c8f0] animate-pulse" 
                    : isDone 
                      ? "bg-[#00df6e]/10 border-[#00df6e]/30 text-[#00df6e]" 
                      : "bg-[#090f1e] border-[#152236] text-[#4a6580]"
                }`}>
                  {tf}
                  {isDone && "✓"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Status Output & manual firing action */}
        {isAutoSequenceActive && (
          <div className="p-1.5 rounded bg-[#090f1e] border border-[#152236] flex flex-col gap-1 text-[9px] font-mono">
            <div className="flex justify-between items-center text-[#a8c0d8]">
              <span>Active Stage:</span>
              <span className="font-bold text-white uppercase">{selectedTimeframes[currentTfIndex]} timeframe</span>
            </div>

            {pacingMode === "countdown" ? (
              <div className="flex justify-between items-center text-[#00c8f0] font-bold">
                <span>Auto-Capturing in:</span>
                <span className="animate-pulse">{timeLeft} seconds</span>
              </div>
            ) : (
              <div className="mt-1">
                <button
                  onClick={advanceSequence}
                  className="w-full py-1 bg-[#00df6e]/15 hover:bg-[#00df6e]/25 border border-[#00df6e] text-[#00df6e] font-extrabold text-[9px] rounded transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  READY — CAPTURE {selectedTimeframes[currentTfIndex]} & CONTINUE
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Capture slots list */}
      <div className="flex flex-col gap-1.5 max-h-[170px] overflow-y-auto mb-3 pr-0.5 font-mono">
        {selectedTimeframes.map(tf => {
          const hasImage = !!capturedImages[tf];
          const analysis = analyses[tf];
          const isLoading = loadingTimeframe === tf;
          const isExpanded = expandedTimeframe === tf;

          return (
            <div key={tf} className="p-1.5 bg-[#060c17]/90 border border-[#152236] rounded flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${analysis ? "bg-[#00df6e]" : hasImage ? "bg-[#00c8f0]" : "bg-[#4a6580]"}`}></span>
                  <span className="text-[10px] font-bold text-white uppercase">{tf} Slot</span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Capture Button */}
                  <button
                    disabled={isAutoSequenceActive}
                    onClick={() => handleCaptureSlot(tf)}
                    className={`p-1 rounded flex items-center justify-center transition border ${
                      hasImage 
                        ? "bg-[#00c8f0]/10 border-[#00c8f0]/30 text-[#00c8f0] hover:bg-[#00c8f0]/20" 
                        : "bg-[#090f1e] border-[#152236] text-[#7a98b4] hover:text-white"
                    } ${isAutoSequenceActive ? "cursor-not-allowed opacity-30" : ""}`}
                    title={`Capture ${tf} Chart`}
                  >
                    <Camera className="w-3 h-3" />
                  </button>

                  {/* Analyze Button */}
                  <button
                    onClick={() => handleAnalyzeSlot(tf)}
                    disabled={!hasImage || isLoading || isAutoSequenceActive}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider transition border ${
                      analysis 
                        ? "bg-[#00df6e]/10 border-[#00df6e]/30 text-[#00df6e]" 
                        : hasImage 
                          ? isLoading 
                            ? "bg-[#9d78f8]/5 border-[#9d78f8]/30 text-[#9d78f8] animate-pulse" 
                            : "bg-[#9d78f8]/10 border-[#9d78f8]/30 text-[#9d78f8] hover:bg-[#9d78f8]/20" 
                          : "bg-transparent border-transparent text-[#4a6580] cursor-not-allowed"
                    } ${isAutoSequenceActive ? "cursor-not-allowed opacity-30" : ""}`}
                  >
                    {isLoading ? "SCANNING..." : analysis ? "SCANNED ✓" : "ANALYZE"}
                  </button>

                  {/* Expand Toggle */}
                  {analysis && (
                    <button
                      onClick={() => setExpandedTimeframe(isExpanded ? null : tf)}
                      className="p-1 text-[#7a98b4] hover:text-white"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Collapsible analysis details */}
              {analysis && isExpanded && (
                <div className="mt-1 pt-1.5 border-t border-[#152236]/40 text-[8.5px] leading-normal flex flex-col gap-1 text-[#a8c0d8] font-sans">
                  <div className="flex justify-between items-center font-mono">
                    <span>Bias:</span>
                    <span className={`font-bold uppercase ${
                      analysis.bias.toLowerCase().includes("bull") ? "text-[#00df6e]" :
                      analysis.bias.toLowerCase().includes("bear") ? "text-[#f03060]" : "text-[#00c8f0]"
                    }`}>{analysis.bias}</span>
                  </div>
                  {analysis.candlestickPattern !== "None" && (
                    <div><span className="font-semibold text-white font-mono">Candlestick:</span> {analysis.candlestickPattern}</div>
                  )}
                  {analysis.chartPattern !== "None" && (
                    <div><span className="font-semibold text-white font-mono">Pattern:</span> {analysis.chartPattern}</div>
                  )}
                  <div><span className="font-semibold text-white font-mono">Structure:</span> {analysis.trend}</div>
                  <div><span className="font-semibold text-white font-mono">SMC:</span> {analysis.smcSignals}</div>
                  {analysis.summary && (
                    <div className="text-[#00c8f0] italic bg-[#00c8f0]/5 p-1 border border-[#00c8f0]/10 rounded mt-0.5">
                      "{analysis.summary}"
                    </div>
                  )}
                </div>
              )}

              {/* Mini feedback text */}
              {!analysis && (
                <span className="text-[7.5px] text-[#4a6580] uppercase tracking-wide">
                  {hasImage ? "Chart snapshot stored. Ready for quantitative scan." : "No active screenshot capture."}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Control Buttons (Confluence / Reset) */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleRunConfluence}
          disabled={Object.keys(analyses).length < 2 || runningConfluence || isAutoSequenceActive}
          className={`flex-grow py-1.5 rounded font-extrabold text-[10px] tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer border ${
            Object.keys(analyses).length >= 2 && !isAutoSequenceActive
              ? "bg-[#9d78f8]/10 hover:bg-[#9d78f8]/20 border-[#9d78f8]/50 text-[#c084fc] hover:border-[#c084fc]"
              : "bg-[#0b1322] border-[#152236] text-[#4a6580] cursor-not-allowed"
          }`}
        >
          <BrainCircuit className={`w-3.5 h-3.5 ${runningConfluence ? "animate-spin" : ""}`} />
          {runningConfluence ? "RUNNING CONFLUENCE..." : "RUN CONFLUENCE ENGINE"}
        </button>

        <button
          onClick={handleResetEngine}
          className="px-2.5 bg-[#090f1e] hover:bg-[#0b1322] border border-[#152236] text-[#7a98b4] hover:text-white rounded transition cursor-pointer"
          title="Reset Multi-Timeframe Suite"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Confluence Synthesis Result Card */}
      {confluenceResult && (
        <div className="p-2.5 bg-[#090f1e]/90 border border-[#9d78f8]/45 rounded flex flex-col gap-2 font-sans text-[10px] text-[#a8c0d8]">
          <div className="flex justify-between items-center border-b border-[#152236]/40 pb-1.5">
            <span className="text-[8.5px] font-bold font-mono text-[#9d78f8] uppercase flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#9d78f8] fill-[#9d78f8]" />
              Confluence Synthesis
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono uppercase ${
                confluenceResult.overallBias === "BULLISH" ? "bg-[#00df6e]/20 text-[#00df6e]" :
                confluenceResult.overallBias === "BEARISH" ? "bg-[#f03060]/20 text-[#f03060]" : "bg-[#00c8f0]/20 text-[#00c8f0]"
              }`}>
                {confluenceResult.overallBias}
              </span>
              <span className="font-mono font-bold text-white shrink-0 bg-[#9d78f8]/10 border border-[#9d78f8]/30 px-1 py-0.5 rounded text-[8px]">
                {confluenceResult.confluenceScore}% SCORE
              </span>
            </div>
          </div>

          {/* Timeframes correlation indicators */}
          <div className="grid grid-cols-2 gap-2 text-[8px] font-mono leading-tight">
            <div className="p-1 bg-[#00df6e]/5 border border-[#00df6e]/15 rounded">
              <span className="text-[#00df6e] font-bold block uppercase mb-0.5">Aligned Frames:</span>
              <span className="text-white">{confluenceResult.alignedTimeframes.join(", ") || "None"}</span>
            </div>
            <div className="p-1 bg-[#f03060]/5 border border-[#f03060]/15 rounded">
              <span className="text-[#f03060] font-bold block uppercase mb-0.5">Conflicts:</span>
              <span className="text-white">{confluenceResult.conflictingTimeframes.join(", ") || "None"}</span>
            </div>
          </div>

          {/* Dominant Narrative */}
          <div className="bg-[#060c17]/40 border border-[#152236]/40 p-2 rounded leading-relaxed text-[9.5px]">
            <span className="font-bold text-[#9d78f8] block mb-0.5 uppercase tracking-wide text-[8px] font-mono">Dominant Top-Down Narrative:</span>
            <p className="text-[#b8d0e8]">{confluenceResult.dominantNarrative}</p>
          </div>

          {/* Tactical Entry Plan */}
          {confluenceResult.tacticalEntryPlan && (
            <div className="border border-[#152236] bg-[#060c17]/60 p-2 rounded flex flex-col gap-1 text-[9.5px]">
              <span className="font-bold text-[#00c8f0] block mb-1 uppercase tracking-wide text-[8.5px] font-mono border-b border-[#152236]/40 pb-0.5">Tactical Trade Execution Plan</span>
              
              <div className="flex justify-between">
                <span className="text-[#7a98b4] font-mono">Trigger Signal:</span>
                <span className="text-white font-bold text-right pl-2">{confluenceResult.tacticalEntryPlan.entryTrigger}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7a98b4] font-mono">Take Profit / Stop Loss:</span>
                <span className="text-white font-bold text-right pl-2">
                  TP: {confluenceResult.tacticalEntryPlan.takeProfit} / SL: {confluenceResult.tacticalEntryPlan.stopLoss}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7a98b4] font-mono">Risk/Reward:</span>
                <span className="text-[#00df6e] font-bold">{confluenceResult.tacticalEntryPlan.riskRewardRatio}</span>
              </div>
              <div className="flex justify-between border-t border-[#152236]/30 pt-1 mt-1 flex-col gap-0.5">
                <span className="text-[#7a98b4] font-mono text-[8px] uppercase">Execution Strategy:</span>
                <span className="text-white italic leading-snug">{confluenceResult.tacticalEntryPlan.executionStrategy}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
