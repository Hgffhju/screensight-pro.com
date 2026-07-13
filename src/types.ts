export interface LogEntry {
  ts: string;
  msg: string;
  type: "info" | "success" | "error" | "high" | "trading";
}

export interface SparklineData {
  fps: number[];
  delta: number[];
  ocrConf: number[];
  price: number[];
}

export interface StructuredTradingData {
  bias: "bullish" | "bearish" | "neutral";
  price: number | null;
  pattern: string | null; // e.g., Bearish Engulfing, Morning Star, Pin Bar
  confidence: number;
  levels: {
    price: number;
    type: "support" | "resistance";
    note?: string;
  }[];
  summary: string;
  // Candlestick Bible specific extensions:
  candlestickPattern?: string; // e.g. "Pin Bar / Hammer", "Engulfing Bar", "Inside Bar"
  marketStructure?: "trending-up" | "trending-down" | "range-bound";
  zoneOfValue?: boolean; // Signal validity based on key Level alignment
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskRewardRatio?: string | null;
}

export interface AlertEntry {
  id: string;
  ts: string;
  kw: string;
  context: string;
}

export interface FocusMode {
  id: string;
  name: string;
  prompt: string;
  isSystem?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  hasFrame?: boolean;
}

export interface PluginItem {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  lastOutput?: string | null;
  lastError?: string | null;
}

export interface WebhookConfig {
  id: string;
  url: string;
  trigger: "keyword" | "analysis" | "high" | "all";
  lastStatus?: "ok" | "error" | null;
}
