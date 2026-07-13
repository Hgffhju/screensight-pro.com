import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Lock, 
  Unlock, 
  Smartphone, 
  Check, 
  Coins, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Sparkles, 
  FileText, 
  DollarSign, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Zap,
  BookmarkCheck,
  RefreshCw,
  LineChart
} from "lucide-react";

interface PremiumStrategiesPanelProps {
  currentUser: any;
  onAddLog: (msg: string, type: "success" | "error" | "info" | "high" | "trading") => void;
  mtfConfluenceResult: any;
}

interface PremiumStrategy {
  id: string;
  name: string;
  priceKes: number;
  winRate: string;
  profitFactor: string;
  timeframe: string;
  shortDesc: string;
  detailedDesc: string;
  indicatorChecklist: string[];
  entryTrigger: string;
  riskManagement: string;
  executionRules: string[];
}

export const PremiumStrategiesPanel: React.FC<PremiumStrategiesPanelProps> = ({
  currentUser,
  onAddLog,
  mtfConfluenceResult
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"catalog" | "my_hub">("catalog");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState<boolean>(false);
  const [selectedStrategy, setSelectedStrategy] = useState<PremiumStrategy | null>(null);
  
  // Checkout form states
  const [checkoutStrategyId, setCheckoutStrategyId] = useState<string | null>(null);
  const [payerPhone, setPayerPhone] = useState<string>("");
  const [transactionCode, setTransactionCode] = useState<string>("");
  const [submittingCheckout, setSubmittingCheckout] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean>(false);

  // Define premium trading strategies catalog
  const PRE_STRATEGIES: PremiumStrategy[] = [
    {
      id: "strat_smc_sweep",
      name: "SMC Liquidity Grab & Order Block Sweep",
      priceKes: 1500,
      winRate: "78.4%",
      profitFactor: "2.1",
      timeframe: "5M - 15M",
      shortDesc: "High-probability institutional liquidity raid. Tracks swing highs/lows and enters on Market Structure Shift (MSS) at key order blocks.",
      detailedDesc: "This high-confluence algorithmic strategy looks for the manipulation phase of the market cycle where price sweeps clean a clear swing high/low to engineer liquidity, then rapidly reverses creating a Fair Value Gap and structural market structure break. Enters on the retracement into the newly printed Order Block.",
      indicatorChecklist: [
        "Swept premium or discount swing liquidity level on higher timeframe (1H/4H)",
        "Displacement candle showing strong institutional momentum in the opposite direction",
        "Clear Market Structure Shift (MSS) with body close on the 5-Minute timeframe",
        "Enters on 50% equilibrium level of the primary Order Block zone"
      ],
      entryTrigger: "Set limit order at the 50% (Mean Threshold) of the 5M Order Block printed during the structural break.",
      riskManagement: "Place hard stop-loss 2 pips beyond the high/low of the sweep candle. Aim for structural 1:2.5 minimum risk-reward.",
      executionRules: [
        "Only execute during London or New York sessions (high volatility).",
        "Avoid trading 15 minutes before and after high-impact macroeconomic news releases.",
        "Ensure higher-timeframe order flow (daily or 4H) aligns with the sweep direction."
      ]
    },
    {
      id: "strat_fvg_confluence",
      name: "Top-Down Fair Value Gap (FVG) Magnet",
      priceKes: 2500,
      winRate: "82.1%",
      profitFactor: "2.4",
      timeframe: "15M - 1H",
      shortDesc: "Premium multi-timeframe gap fill matching. Traces high-volume institutional imbalances and captures rapid rebalancing surges.",
      detailedDesc: "Imbalances in the market are represented as single-candle imbalances or Fair Value Gaps. Because price is drawn to these zones like a magnet to rebalance liquidity, this strategy maps Higher Timeframe (4H/1H) imbalances and combines them with lower timeframe (15M) momentum triggers.",
      indicatorChecklist: [
        "Unmitigated major 1H or 4H Fair Value Gap present above/below market price",
        "Price touches the 25% boundary of the HTF Fair Value Gap zone",
        "Relative Strength Index (RSI) showing bullish or bearish divergence on the 15M chart",
        "MACD signal line crossover matching the direction of the gap rebalance"
      ],
      entryTrigger: "Enter at the touch of the FVG boundary with confirmation from a 15M candlestick reversal pattern (e.g. hammer or shooting star).",
      riskManagement: "Stop-loss is placed at the opposite end of the HTF FVG. Take-profit is locked at the full gap filling zone (100% mitigation).",
      executionRules: [
        "If price closes outside the HTF FVG on a 1-Hour candle, invalidate the setup immediately.",
        "Take partial profits at the 50% (consequent encroachment) of the FVG.",
        "Do not enter if the gap is smaller than 15 pips on major currency pairs."
      ]
    },
    {
      id: "strat_momentum_surge",
      name: "AI Volume Surge & Trend breakout",
      priceKes: 3000,
      winRate: "86.5%",
      profitFactor: "2.8",
      timeframe: "15M - 4H",
      shortDesc: "Dynamic breakout filter system. Combines multi-timeframe Bollinger Band squeeze and AI-synthesized volume imbalances.",
      detailedDesc: "This highly specialized trend-following model monitors low-volatility compression phases (squeezes) and filters breakouts with raw volume delta. Uses institutional market volume analysis to reject false breakouts and capture explosive trend continuation runs.",
      indicatorChecklist: [
        "Bollinger Bands on the 15-Minute chart are severely contracted (Squeeze phase)",
        "Sudden explosive relative volume spike exceeding 200% of the 20-period moving average",
        "Price breaks and closes clearly outside the Bollinger Band boundary",
        "Moving Average Convergence Divergence (MACD) histogram expands rapidly"
      ],
      entryTrigger: "Enter instantly on the close of the breakout candle confirming the Bollinger Band expansion.",
      riskManagement: "Stop-loss placed at the opposite Bollinger Band or the recent minor swing pivot. Trail stops using ATR (Average True Range).",
      executionRules: [
        "Only hold the position as long as price remains close to the outer Bollinger Band edge.",
        "Exit 80% of volume if price crosses back over the 20-period middle moving average.",
        "Strictly invalidate the trade if volume drops below average during the first three breakout candles."
      ]
    }
  ];

  // Fetch purchases on mount and when currentUser changes
  const fetchUserPurchases = async () => {
    if (!currentUser) return;
    setLoadingPurchases(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/premium/purchases", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPurchases(data.purchases || []);
      }
    } catch (err) {
      console.error("Error retrieving user purchases:", err);
    } finally {
      setLoadingPurchases(false);
    }
  };

  useEffect(() => {
    fetchUserPurchases();
  }, [currentUser]);

  // Is strategy unlocked?
  const isUnlocked = (strategyId: string) => {
    return purchases.some(p => p.strategyId === strategyId && p.status === "verified");
  };

  // Submit checkout / verification code
  const handleVerifyCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setCheckoutError("Authenticating failed. Please log in first.");
      return;
    }
    if (!payerPhone || !payerPhone.trim()) {
      setCheckoutError("Please specify your paying M-Pesa phone number.");
      return;
    }
    if (!transactionCode || transactionCode.length !== 10) {
      setCheckoutError("Invalid transaction code. Must be exactly 10 alphanumeric characters (e.g. SDR2A349DF).");
      return;
    }

    setSubmittingCheckout(true);
    setCheckoutError(null);
    setCheckoutSuccess(false);

    try {
      const token = await currentUser.getIdToken();
      const strategy = PRE_STRATEGIES.find(s => s.id === checkoutStrategyId);
      if (!strategy) throw new Error("Strategy not found.");

      const payload = {
        strategyId: checkoutStrategyId,
        phoneNumber: payerPhone.trim(),
        transactionCode: transactionCode.toUpperCase().trim(),
        amountPaid: strategy.priceKes
      };

      const res = await fetch("/api/premium/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Payment verification failed.");
      }

      setCheckoutSuccess(true);
      onAddLog(`Income Strategies: Unlocked "${strategy.name}" successfully! KES ${strategy.priceKes} processed.`, "success");
      
      // Reset checkout panel and update local purchases
      setTimeout(() => {
        setCheckoutStrategyId(null);
        setPayerPhone("");
        setTransactionCode("");
        setCheckoutSuccess(false);
        fetchUserPurchases();
        setActiveTab("my_hub");
      }, 2000);

    } catch (err: any) {
      setCheckoutError(err.message || "An error occurred during verification.");
      onAddLog(`Payment Verification Failed: ${err.message}`, "error");
    } finally {
      setSubmittingCheckout(false);
    }
  };

  return (
    <div className="border-b border-[#152236] text-xs">
      {/* Header section toggle */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-[#090f1e]/40 flex items-center justify-between cursor-pointer select-none hover:bg-[#090f1e]/80 transition"
      >
        <div className="flex items-center gap-1.5 font-syne">
          <Coins className="w-4 h-4 text-[#00df6e] animate-pulse" />
          <span className="font-extrabold text-white text-[10px] tracking-wider uppercase">Income Generating Strategies</span>
        </div>
        <div className="flex items-center gap-1.5">
          {purchases.length > 0 && (
            <span className="px-1.5 py-0.5 bg-[#00df6e]/10 border border-[#00df6e]/30 text-[#00df6e] text-[8.5px] rounded font-mono font-bold">
              {purchases.length} ACTIVE
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-[#4a6580]" /> : <ChevronDown className="w-4 h-4 text-[#4a6580]" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-3 bg-[#060c17]/30 flex flex-col gap-3">
          {/* User state banner */}
          {!currentUser ? (
            <div className="p-3 border border-[#152236] bg-[#090f1e]/80 rounded text-center">
              <Lock className="w-8 h-8 text-[#4a6580] mx-auto mb-2" />
              <h4 className="font-bold text-white text-xs mb-1">Access Premium Trading Vault</h4>
              <p className="text-[10px] text-[#7a98b4] mb-3 leading-relaxed">
                Connect your account using the Google Cloud Auth button at the top to unlock proprietary strategies and track payment registers.
              </p>
            </div>
          ) : (
            <>
              {/* Tab Toggles */}
              <div className="grid grid-cols-2 gap-1 border-b border-[#152236] pb-1">
                <button
                  onClick={() => {
                    setActiveTab("catalog");
                    setSelectedStrategy(null);
                  }}
                  className={`py-1 text-[9.5px] font-extrabold uppercase tracking-wide border-b-2 text-center transition cursor-pointer ${
                    activeTab === "catalog"
                      ? "border-[#00df6e] text-[#00df6e]"
                      : "border-transparent text-[#7a98b4] hover:text-white"
                  }`}
                >
                  Strategies Catalog
                </button>
                <button
                  onClick={() => {
                    setActiveTab("my_hub");
                    setSelectedStrategy(null);
                  }}
                  className={`py-1 text-[9.5px] font-extrabold uppercase tracking-wide border-b-2 text-center transition cursor-pointer ${
                    activeTab === "my_hub"
                      ? "border-[#00df6e] text-[#00df6e]"
                      : "border-transparent text-[#7a98b4] hover:text-white"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    My Strategy Hub ({purchases.filter(p => p.status === "verified").length})
                  </span>
                </button>
              </div>

              {/* TAB CONTENT: Strategies Catalog */}
              {activeTab === "catalog" && !checkoutStrategyId && !selectedStrategy && (
                <div className="flex flex-col gap-2.5">
                  {PRE_STRATEGIES.map((strat) => {
                    const unlocked = isUnlocked(strat.id);
                    return (
                      <div 
                        key={strat.id}
                        className={`p-2.5 border rounded transition flex flex-col gap-1.5 ${
                          unlocked 
                            ? "bg-[#00df6e]/5 border-[#00df6e]/30" 
                            : "bg-[#090f1e]/40 border-[#152236] hover:border-[#4a6580]/40"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-extrabold text-white text-[10.5px] leading-tight flex-grow">
                            {strat.name}
                          </h4>
                          <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                            unlocked 
                              ? "bg-[#00df6e]/15 text-[#00df6e]" 
                              : "bg-[#00c8f0]/10 text-[#00c8f0] border border-[#00c8f0]/20"
                          }`}>
                            {unlocked ? "UNLOCKED" : `KES ${strat.priceKes.toLocaleString()}`}
                          </span>
                        </div>

                        <p className="text-[9.5px] text-[#7a98b4] leading-relaxed">
                          {strat.shortDesc}
                        </p>

                        <div className="flex items-center justify-between text-[8.5px] font-mono text-[#4a6580] pt-1 border-t border-[#152236]/30">
                          <span className="flex items-center gap-0.5">
                            Win Rate: <strong className="text-[#00df6e]">{strat.winRate}</strong>
                          </span>
                          <span>TF: <strong>{strat.timeframe}</strong></span>
                        </div>

                        <div className="mt-1 flex gap-1.5">
                          {unlocked ? (
                            <button
                              onClick={() => {
                                setSelectedStrategy(strat);
                                setActiveTab("my_hub");
                              }}
                              className="w-full py-1 bg-[#00df6e]/15 hover:bg-[#00df6e]/25 border border-[#00df6e]/40 text-[#00df6e] text-[9px] font-extrabold tracking-wider uppercase rounded transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Unlock className="w-3 h-3" />
                              View Core Parameters
                            </button>
                          ) : (
                            <button
                              onClick={() => setCheckoutStrategyId(strat.id)}
                              className="w-full py-1 bg-[#00df6e] hover:bg-[#00df6e]/90 text-black text-[9px] font-extrabold tracking-wider uppercase rounded transition cursor-pointer flex items-center justify-center gap-1 shadow-[0_0_8px_rgba(0,223,110,0.25)]"
                            >
                              <Lock className="w-3 h-3 text-black" />
                              Unlock Strategy via M-Pesa
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* M-PESA CHECKOUT PANEL */}
              {activeTab === "catalog" && checkoutStrategyId && (
                <div className="p-3 border border-[#00df6e]/30 bg-[#06100d]/60 rounded-lg flex flex-col gap-3 animate-fadeIn">
                  {/* Strategy Info Header */}
                  <div className="flex justify-between items-start pb-2 border-b border-[#00df6e]/15">
                    <div>
                      <span className="text-[8px] font-mono text-[#00df6e] uppercase font-bold tracking-wider block">PREMIUM CHECKOUT GATEWAY</span>
                      <h4 className="font-extrabold text-white text-[11px] mt-0.5">
                        {PRE_STRATEGIES.find(s => s.id === checkoutStrategyId)?.name}
                      </h4>
                    </div>
                    <button 
                      onClick={() => {
                        setCheckoutStrategyId(null);
                        setCheckoutError(null);
                      }}
                      className="text-[#4a6580] hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Payment Instructions */}
                  <div className="flex flex-col gap-1.5 text-[10px] leading-relaxed text-[#cbd5e1]">
                    <div className="p-2 bg-[#00df6e]/5 border border-[#00df6e]/15 rounded flex items-start gap-2 text-[#00df6e] text-[10.5px]">
                      <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span>Send money via <strong>M-Pesa Pochi la Biashara</strong> directly to:</span>
                        <div className="text-white font-mono font-black text-xs bg-black/40 py-1 px-2 rounded border border-[#00df6e]/30 inline-block mt-1">
                          0794300156
                        </div>
                      </div>
                    </div>

                    <span className="font-bold text-white uppercase text-[8px] tracking-wide mt-1.5 block">Step-By-Step Payment Process</span>
                    <ol className="list-decimal list-inside flex flex-col gap-1 text-[9.5px] text-[#7a98b4] pl-1 font-mono">
                      <li>Dial <strong className="text-white">*334#</strong> or open Safaricom M-Pesa App</li>
                      <li>Select option <strong className="text-white">Lipa Na M-PESA</strong></li>
                      <li>Choose option <strong className="text-white">Pochi La Biashara</strong></li>
                      <li>Enter phone number: <strong className="text-white">0794300156</strong></li>
                      <li>Enter amount: <strong className="text-[#00df6e]">KES {PRE_STRATEGIES.find(s => s.id === checkoutStrategyId)?.priceKes}</strong></li>
                      <li>Complete with M-Pesa PIN and copy the <strong className="text-white">10-digit transaction code</strong> (e.g. SKD4A39D9E)</li>
                    </ol>
                  </div>

                  {/* Verification Form */}
                  <form onSubmit={handleVerifyCheckout} className="flex flex-col gap-2.5 border-t border-[#152236] pt-2.5">
                    <div>
                      <label className="text-[8.5px] font-mono text-[#4a6580] uppercase block mb-1">Paying M-Pesa Phone Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 0722000000"
                        value={payerPhone}
                        onChange={(e) => setPayerPhone(e.target.value)}
                        className="w-full bg-black/60 text-white border border-[#152236] focus:border-[#00df6e] focus:outline-none p-1.5 rounded text-[10.5px] font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[8.5px] font-mono text-[#4a6580] uppercase block mb-1">M-Pesa Transaction Code (10 Chars)</label>
                      <input
                        type="text"
                        placeholder="e.g. SDR2A349DF"
                        value={transactionCode}
                        onChange={(e) => setTransactionCode(e.target.value)}
                        className="w-full bg-black/60 text-white border border-[#152236] focus:border-[#00df6e] focus:outline-none p-1.5 rounded text-[10.5px] font-mono uppercase tracking-widest font-black"
                        required
                        maxLength={10}
                      />
                    </div>

                    {checkoutError && (
                      <div className="p-2 border border-[#f03060]/30 bg-[#f03060]/5 rounded flex items-start gap-1.5 text-[#f03060] font-mono text-[9px]">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{checkoutError}</span>
                      </div>
                    )}

                    {checkoutSuccess && (
                      <div className="p-2 border border-[#00df6e]/30 bg-[#00df6e]/5 rounded flex items-center gap-1.5 text-[#00df6e] font-mono text-[9px]">
                        <CheckCircle2 className="w-4 h-4 text-[#00df6e]" />
                        <span>Receipt Verified! Access Unlocked.</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingCheckout || checkoutSuccess}
                      className="w-full py-1.5 bg-[#00df6e] hover:bg-[#00df6e]/90 text-black text-[10px] font-black uppercase rounded transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      {submittingCheckout ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          VERIFYING CODE...
                        </>
                      ) : (
                        "SUBMIT & UNLOCK ACCESS"
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB CONTENT: MY STRATEGY HUB */}
              {activeTab === "my_hub" && (
                <div className="flex flex-col gap-2">
                  {purchases.filter(p => p.status === "verified").length === 0 ? (
                    <div className="p-5 border border-[#152236]/30 bg-[#090f1e]/20 rounded text-center flex flex-col items-center justify-center">
                      <Lock className="w-6 h-6 text-[#4a6580] mb-1.5" />
                      <span className="font-bold text-[#7a98b4] text-[10px]">No premium strategies unlocked yet</span>
                      <p className="text-[8.5px] text-[#4a6580] mt-1 leading-relaxed max-w-[190px]">
                        Unlock strategies in the Catalog tab by making a direct payment using Safaricom M-Pesa.
                      </p>
                    </div>
                  ) : !selectedStrategy ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-[8px] font-mono text-[#00df6e] uppercase tracking-wider block">UNLOCKED PREMIUM MODELS</span>
                      {PRE_STRATEGIES.filter(s => isUnlocked(s.id)).map(strat => (
                        <div
                          key={strat.id}
                          onClick={() => setSelectedStrategy(strat)}
                          className="p-2.5 border border-[#00df6e]/30 bg-[#00df6e]/5 hover:bg-[#00df6e]/10 rounded cursor-pointer transition flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#00df6e]" />
                            <div className="flex flex-col">
                              <span className="text-white font-extrabold text-[10px] leading-tight">{strat.name}</span>
                              <span className="text-[8px] text-[#4a6580] font-mono mt-0.5">Win Rate: <strong className="text-[#00df6e]">{strat.winRate}</strong></span>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-[#00df6e]" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Strategy Detail Workspace View */
                    <div className="flex flex-col gap-3 animate-fadeIn">
                      {/* Back to List row */}
                      <div className="flex justify-between items-center pb-1.5 border-b border-[#152236]">
                        <button
                          onClick={() => setSelectedStrategy(null)}
                          className="text-[#4a6580] hover:text-white font-mono text-[9px] uppercase font-bold"
                        >
                          ← BACK TO HUB
                        </button>
                        <span className="text-[8px] font-mono text-[#00df6e] uppercase bg-[#00df6e]/10 px-1 py-0.5 rounded font-bold">
                          ACTIVE STRATEGY
                        </span>
                      </div>

                      {/* Title & metrics block */}
                      <div className="flex flex-col">
                        <h3 className="font-syne font-black text-white text-xs">{selectedStrategy.name}</h3>
                        <div className="grid grid-cols-3 gap-1 mt-1.5 p-1.5 bg-[#090f1e] rounded border border-[#152236] text-[8.5px] font-mono text-center">
                          <div>
                            <span className="text-[#4a6580] block uppercase text-[7.5px]">Win Rate</span>
                            <strong className="text-[#00df6e] text-[10px]">{selectedStrategy.winRate}</strong>
                          </div>
                          <div className="border-x border-[#152236]">
                            <span className="text-[#4a6580] block uppercase text-[7.5px]">Profit Factor</span>
                            <strong className="text-white text-[10px]">{selectedStrategy.profitFactor}</strong>
                          </div>
                          <div>
                            <span className="text-[#4a6580] block uppercase text-[7.5px]">Timeframe</span>
                            <strong className="text-[#00c8f0] text-[10px]">{selectedStrategy.timeframe}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Theory */}
                      <div>
                        <span className="text-[8px] font-mono text-[#00c8f0] uppercase block mb-1">Strategy Methodology</span>
                        <p className="text-[9.5px] text-[#cbd5e1] leading-relaxed select-text bg-black/30 p-2 border border-[#152236] rounded font-sans italic">
                          "{selectedStrategy.detailedDesc}"
                        </p>
                      </div>

                      {/* Multi-Timeframe Confluence Engine Check */}
                      <div className="p-2 border border-[#9d78f8]/30 bg-[#9d78f8]/5 rounded flex flex-col gap-1.5">
                        <div className="flex items-center gap-1 text-[#9d78f8]">
                          <Zap className="w-3.5 h-3.5" />
                          <span className="font-bold text-[9px] uppercase tracking-wider font-mono">Live Confluence Alignment Scan</span>
                        </div>
                        {mtfConfluenceResult ? (
                          <div className="flex flex-col gap-1">
                            <p className="text-[9.5px] text-white">
                              Current analysis model matches <strong className="text-[#00df6e]">{mtfConfluenceResult.confluenceScore}%</strong> confluence metrics.
                            </p>
                            <div className="flex items-center gap-1 text-[8.5px] text-[#7a98b4] font-mono">
                              <span>Market Bias: </span>
                              <strong className={mtfConfluenceResult.overallBias.toLowerCase() === 'bullish' ? 'text-[#00df6e]' : 'text-[#f03060]'}>
                                {mtfConfluenceResult.overallBias.toUpperCase()}
                              </strong>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[8.5px] text-[#7a98b4] leading-relaxed">
                            Awaiting real-time data. Run the <strong>Confluence Engine</strong> to scan the current screen frame against this strategy's parameters.
                          </p>
                        )}
                      </div>

                      {/* Actionable Rules / Steps */}
                      <div>
                        <span className="text-[8px] font-mono text-[#00df6e] uppercase block mb-1">Actionable Entry Rules</span>
                        <ul className="flex flex-col gap-1 pl-1 text-[9.5px] text-[#7a98b4]">
                          {selectedStrategy.indicatorChecklist.map((rule, index) => (
                            <li key={index} className="flex items-start gap-1.5">
                              <span className="text-[#00df6e] shrink-0 mt-0.5 font-bold">✓</span>
                              <span className="select-text text-[#cbd5e1]">{rule}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Entry Trigger */}
                      <div className="p-2.5 bg-[#152236]/40 border border-[#2d3e54] rounded">
                        <span className="text-[8.5px] font-mono text-[#00df6e] uppercase block mb-0.5">Trigger Condition</span>
                        <p className="text-[9.5px] text-[#f8fafc] font-mono leading-relaxed select-text font-bold">
                          {selectedStrategy.entryTrigger}
                        </p>
                      </div>

                      {/* Risk Setup */}
                      <div className="p-2.5 bg-[#f03060]/5 border border-[#f03060]/20 rounded">
                        <span className="text-[8.5px] font-mono text-[#f03060] uppercase block mb-0.5">Risk Management Parameters</span>
                        <p className="text-[9.5px] text-[#f8fafc] font-mono leading-relaxed select-text">
                          {selectedStrategy.riskManagement}
                        </p>
                      </div>

                      {/* Execution discipline rules */}
                      <div>
                        <span className="text-[8px] font-mono text-[#4a6580] uppercase block mb-1">Risk Discipline Guardrails</span>
                        <ul className="flex flex-col gap-1 pl-1 text-[9px] text-[#7a98b4] font-mono">
                          {selectedStrategy.executionRules.map((rule, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-[#9d78f8] shrink-0 font-bold">▪</span>
                              <span className="select-text">{rule}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
