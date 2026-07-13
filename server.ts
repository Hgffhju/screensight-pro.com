import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { getOrCreateUser, getUserConfluences, saveConfluenceSession, deleteConfluenceSession, recordPremiumPurchase, getUserPremiumPurchases } from "./src/db/queries.ts";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

// Lazily initialize the Google Gen AI client with validation to prevent cold start crashes
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it via the secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enhance payload size limit to accommodate base64 image data comfortably
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // API Route: Verify backend and key availability
  app.get("/api/health", (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({
      status: "ok",
      aiLoaded: hasKey,
      message: hasKey ? "Ready to track performance and analyze screen frames." : "Missing GEMINI_API_KEY.",
    });
  });

  // API Route: Sync user profile to PostgreSQL
  app.post("/api/users/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || "";
      const displayName = req.body.displayName || "Anonymous Trader";
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized: Missing user UID" });
      }
      const user = await getOrCreateUser(uid, email, displayName);
      res.json({ success: true, user });
    } catch (error: any) {
      console.error("Error syncing user profile:", error);
      res.status(500).json({ error: error.message || "Failed to sync trader profile." });
    }
  });

  // API Route: Get saved top-down confluence history from PostgreSQL
  app.get("/api/confluences", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized: Missing user UID" });
      }
      const history = await getUserConfluences(uid);
      res.json({ success: true, confluences: history });
    } catch (error: any) {
      console.error("Error fetching confluences:", error);
      res.status(500).json({ error: error.message || "Failed to fetch top-down confluence history." });
    }
  });

  // API Route: Save a complete confluence session and timeframe analyses to PostgreSQL
  app.post("/api/confluences", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized: Missing user UID" });
      }
      const { confluence, analyses } = req.body;
      if (!confluence || !analyses) {
        return res.status(400).json({ error: "Missing confluence or analyses payload." });
      }
      const result = await saveConfluenceSession(uid, confluence, analyses);
      res.json({ success: true, confluence: result });
    } catch (error: any) {
      console.error("Error saving confluence session:", error);
      res.status(500).json({ error: error.message || "Failed to save confluence session." });
    }
  });

  // API Route: Delete a confluence session from PostgreSQL
  app.delete("/api/confluences/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const confluenceId = req.params.id;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized: Missing user UID" });
      }
      if (!confluenceId) {
        return res.status(400).json({ error: "Missing confluence ID parameter." });
      }
      const result = await deleteConfluenceSession(uid, confluenceId);
      res.json(result);
    } catch (error: any) {
      console.error("Error deleting confluence:", error);
      res.status(500).json({ error: error.message || "Failed to delete confluence record." });
    }
  });

  // API Route: Record an M-Pesa Pochi la Biashara payment and unlock a premium strategy
  app.post("/api/premium/purchase", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized: Missing user UID" });
      }
      const { strategyId, phoneNumber, transactionCode, amountPaid } = req.body;
      if (!strategyId || !phoneNumber || !transactionCode || !amountPaid) {
        return res.status(400).json({ error: "Missing required checkout parameters." });
      }

      // Simple check for Kenyan mobile money transaction code (10 alphanumeric chars)
      const cleanedCode = transactionCode.toUpperCase().trim();
      const codeRegex = /^[A-Z0-9]{10}$/;
      if (!codeRegex.test(cleanedCode)) {
        return res.status(400).json({ error: "Invalid transaction code. M-Pesa codes must be exactly 10 alphanumeric characters (e.g., SDR2A349DF)." });
      }

      // Store purchase as verified (simulated authentic verification)
      const purchase = await recordPremiumPurchase(uid, strategyId, phoneNumber, cleanedCode, amountPaid, "verified");
      res.json({ success: true, purchase });
    } catch (error: any) {
      console.error("Error saving premium purchase:", error);
      res.status(500).json({ error: error.message || "Failed to record payment verification." });
    }
  });

  // API Route: Get user's unlocked premium strategies
  app.get("/api/premium/purchases", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized: Missing user UID" });
      }
      const purchases = await getUserPremiumPurchases(uid);
      res.json({ success: true, purchases });
    } catch (error: any) {
      console.error("Error fetching purchases:", error);
      res.status(500).json({ error: error.message || "Failed to fetch purchase histories." });
    }
  });

  // API Route: Unified Screen and Chart Visual Analyzer
  app.post("/api/analyze", async (req, res) => {
    try {
      const { image, mode, detailLevel, ocrSnip, query, structured } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No screen capture frame (base64 image) provided." });
      }

      const client = getGeminiClient();

      // Configure system prompts based on targeted screen analytical category
      let systemPrompt = `You are ScreenSight Pro v4's elite computer vision and chart analyst.
You will assess the screenshot, cross-reference it with the extracted OCR text, and output a high-precision review.
Be concise, clear, and direct. Use bullet points or short paragraphs. Avoid promotional filler.`;

      if (mode === "trading") {
        systemPrompt += ` You are analyzing a technical trading dashboard or stock chart.
You must apply the core rules of "The Candlestick Bible":
1. Determine Market Structure: Identify if the target price action is "trending-up", "trending-down", or "range-bound".
2. Search for high-probability Candlestick Patterns: Name them exactly if found (e.g. Pin Bar / Hammer, Shooting Star, Bullish Engulfing, Bearish Engulfing, Inside Bar, Morning Star, Evening Star, Doji).
3. Verify "Zone of Value": A candlestick pattern only carries weight if it is printed precisely at a major Support or Resistance price floor/ceiling. Note if the signal resides at a true Zone of Value.
4. Manage Risk-to-Reward: Provide structural Entry Price, Stop Loss (placed beyond the pattern's wick limit), and Take Profit target levels aiming for a minimum 1:2 risk-to-reward ratio.`;
      } else if (mode === "code") {
        systemPrompt += ` You are analyzing code on screen. List key design flaws, potential syntax/logical bugs, and language stack. Suggest instant fixes.`;
      } else if (mode === "data") {
        systemPrompt += ` You are evaluating a statistics dashboard. Extract the key KPIs with context and alert on any apparent anomalies or spikes.`;
      } else if (mode === "ui") {
        systemPrompt += ` You are assessing user interface usability, design aesthetics, margin spacing, and accessibility. Offer direct styling updates.`;
      }

      const inlineImage = {
        inlineData: {
          mimeType: "image/jpeg",
          data: image,
        },
      };

      const parts: any[] = [inlineImage];
      if (ocrSnip) {
        parts.push({ text: `Pre-scanned OCR Text Context:\n${ocrSnip}` });
      }
      parts.push({ text: query || `Perform complete screen analysis under ${mode || "general"} guidelines.` });

      const model = "gemini-3.5-flash";

      // If user toggles advanced Structured Trading output, request response in strict JSON
      if (mode === "trading" && structured) {
        const response = await client.models.generateContent({
          model,
          contents: parts,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                bias: {
                  type: Type.STRING,
                  description: "The estimated price direction: bullish, bearish, or neutral",
                },
                price: {
                  type: Type.NUMBER,
                  description: "The primary stock/crypto price spotted on the chart, or null",
                },
                pattern: {
                  type: Type.STRING,
                  description: "Notable technical chart pattern identified, such as Double Bottom, Head and Shoulders, Bull Flag, or null",
                },
                confidence: {
                  type: Type.INTEGER,
                  description: "Degree of analytic confidence represented as a percentage from 0 to 100",
                },
                levels: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      price: { type: Type.NUMBER, description: "The price point of support or resistance" },
                      type: { type: Type.STRING, description: "Must be 'support' or 'resistance'" },
                      note: { type: Type.STRING, description: "Short description of significance or touches" },
                    },
                    required: ["price", "type"],
                  },
                  description: "Strong support and resistance price floors and ceilings",
                },
                summary: {
                  type: Type.STRING,
                  description: "Concisely state what to watch next (max 120 characters)",
                },
                candlestickPattern: {
                  type: Type.STRING,
                  description: "The primary Candlestick Bible pattern found: Pin Bar, Engulfing Bar, Inside Bar, Morning Star, Evening Star, Doji, or None",
                },
                marketStructure: {
                  type: Type.STRING,
                  description: "Must be one of: trending-up, trending-down, range-bound",
                },
                zoneOfValue: {
                  type: Type.BOOLEAN,
                  description: "Is the detected pattern verified at a major support or resistance level?",
                },
                entryPrice: {
                  type: Type.NUMBER,
                  description: "Suggested high-probability entry stop/limit price trigger, or null",
                },
                stopLoss: {
                  type: Type.NUMBER,
                  description: "Suggested protective invalidation level (stop loss), or null",
                },
                takeProfit: {
                  type: Type.NUMBER,
                  description: "Suggested profit target satisfying at least a 1:2 risk-to-reward ratio, or null",
                },
                riskRewardRatio: {
                  type: Type.STRING,
                  description: "Calculated ratio, e.g., '1:2' or '1:3', or null",
                },
              },
              required: ["bias", "confidence", "levels", "summary"],
            },
          },
        });

        return res.json({ finished: true, structured: true, data: JSON.parse(response.text || "{}") });
      }

      // Default rich content generation
      const response = await client.models.generateContent({
        model,
        contents: parts,
        config: {
          systemInstruction: systemPrompt,
        },
      });

      return res.json({ finished: true, structured: false, text: response.text });
    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
      return res.status(500).json({ error: error.message || "Visual analysis pipeline failed." });
    }
  });

  // API Route: Per-Timeframe Multi-Discipline Analysis
  app.post("/api/analyze-timeframe", async (req, res) => {
    try {
      const { image, timeframe, ocrSnip, query } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No screen capture frame (base64 image) provided." });
      }
      if (!timeframe) {
        return res.status(400).json({ error: "No timeframe specified." });
      }

      const client = getGeminiClient();
      const model = "gemini-3.5-flash";

      const systemPrompt = `You are an elite quantitative technical analyst and market structure specialist evaluating a financial chart specifically on the ${timeframe} timeframe.
Your analysis must cover multiple disciplines in high-scrutiny detail:
1. Trend & Market Structure: Identify the market structure (e.g., trending-up/bullish, trending-down/bearish, range-bound/sideways) and note any swing highs/lows or breaks of structure (BOS/CHoCH).
2. Momentum: Analyze oscillator readings, RSI levels, or price acceleration/deceleration.
3. Volume: Assess the correlation between price moves and volume spikes/exhaustion if visible.
4. Candlestick Bible Patterns: Detect any high-probability candlesticks (Pin Bar, Engulfing, Inside Bar, Doji, etc.) at key levels.
5. Chart Patterns: Identify geometric setups (e.g., Bull Flag, Double Top/Bottom, Head & Shoulders, Ascending/Descending Triangle).
6. Fibonacci & Zones of Value: Spot key retracement lines, golden pocket levels, or crucial support/resistance zone levels.
7. Smart Money Concepts (SMC): Look for Order Blocks (OB), Liquidity Pools (buy-side/sell-side liquidity), and Fair Value Gaps (FVG) or imbalances.
8. Moving Average Alignment: Observe if short-term MAs reside above or below long-term MAs and describe their alignment.

You MUST strictly output your analysis in JSON format adhering to the requested schema.`;

      const inlineImage = {
        inlineData: {
          mimeType: "image/jpeg",
          data: image,
        },
      };

      const parts: any[] = [inlineImage];
      if (ocrSnip) {
        parts.push({ text: `Pre-scanned OCR Text context for the chart:\n${ocrSnip}` });
      }
      parts.push({ text: query || `Perform complete multi-discipline scrutiny of this chart on the ${timeframe} timeframe.` });

      const response = await client.models.generateContent({
        model,
        contents: parts,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              timeframe: { type: Type.STRING, description: "The specific timeframe analyzed" },
              bias: { type: Type.STRING, description: "The directional bias: bullish, bearish, or neutral" },
              trend: { type: Type.STRING, description: "Detailed description of trend & market structure, BOS, CHoCH" },
              candlestickPattern: { type: Type.STRING, description: "Candlestick pattern identified, or 'None'" },
              chartPattern: { type: Type.STRING, description: "Chart pattern identified, or 'None'" },
              smcSignals: { type: Type.STRING, description: "SMC indications: Order Blocks, FVG, or Liquidity lines" },
              supportLevel: { type: Type.STRING, description: "Crucial support level price spotted, or null" },
              resistanceLevel: { type: Type.STRING, description: "Crucial resistance level price spotted, or null" },
              momentum: { type: Type.STRING, description: "Analysis of momentum and RSI" },
              movingAverageAlignment: { type: Type.STRING, description: "MAs alignment summary" },
              summary: { type: Type.STRING, description: "Scrutinized quantitative summary of this timeframe (max 150 characters)" },
            },
            required: ["timeframe", "bias", "trend", "candlestickPattern", "chartPattern", "smcSignals", "summary"],
          },
        },
      });

      const parsedData = JSON.parse(response.text || "{}");
      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Analyze Timeframe Error:", error);
      return res.status(500).json({ error: error.message || "Failed to analyze specified timeframe." });
    }
  });

  // API Route: Top-Down Confluence Engine Correlation Pass
  app.post("/api/confluence", async (req, res) => {
    try {
      const { timeframeAnalyses } = req.body;
      if (!timeframeAnalyses || !Array.isArray(timeframeAnalyses) || timeframeAnalyses.length < 2) {
        return res.status(400).json({ error: "At least 2 timeframe analyses are required to run the confluence engine." });
      }

      const client = getGeminiClient();
      const model = "gemini-3.5-flash";

      const systemPrompt = `You are ScreenSight Pro's ultimate Top-Down Confluence Engine.
You will receive a list of structured analysis results across multiple timeframes (e.g., Daily, 4H, 1H, 15M, etc.).
Your mission is to perform a strict multi-timeframe correlation synthesis:
1. Top-Down Weighting: Give higher weights to higher timeframes (Monthly, Weekly, Daily) for setting the macro directional bias, and lower timeframes (4H, 1H, 15M, 5M, 1M) for tactical entry timing and confirmation.
2. Direct Confluence Alignment: Evaluate which timeframes align in their bias and which conflict.
3. Confluence Score: Calculate a synthesized confluence conviction score as a percentage (0% to 100%) based on timeframe alignment, quality of Candlestick Bible patterns, and SMC zones of value.
4. Dominant Narrative: Formulate a cohesive, institutional-grade top-down market thesis of how the order flow is developing.
5. Tactical Trade-Framing Plan: Outline a precise trade execution strategy:
   - Specific entry trigger signal (e.g., FVG retest, Pin Bar breakout)
   - Estimated entry price, stop-loss level, and take-profit targets aiming for a minimum of 1:2 risk-reward ratio.
   - Core risk management execution advice.

You MUST strictly output your analysis in JSON format adhering to the requested schema.`;

      const analysisContext = JSON.stringify(timeframeAnalyses, null, 2);

      const response = await client.models.generateContent({
        model,
        contents: `Timeframe Analyses Input Data:\n${analysisContext}\n\nPerform full top-down confluence comparison and formulate the final trade plan.`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallBias: { type: Type.STRING, description: "BULLISH, BEARISH, or NEUTRAL" },
              confluenceScore: { type: Type.INTEGER, description: "Confluence alignment confidence score from 0 to 100" },
              dominantNarrative: { type: Type.STRING, description: "The overarching top-down market narrative" },
              alignedTimeframes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Timeframes that agree with the overall bias" },
              conflictingTimeframes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Timeframes that conflict with the overall bias" },
              tacticalEntryPlan: {
                type: Type.OBJECT,
                properties: {
                  entryTrigger: { type: Type.STRING, description: "Specific signal to wait for before entering" },
                  stopLoss: { type: Type.STRING, description: "Strategic invalidation price or zone" },
                  takeProfit: { type: Type.STRING, description: "Primary and secondary targets" },
                  riskRewardRatio: { type: Type.STRING, description: "The estimated risk-reward ratio, e.g. 1:2.5" },
                  executionStrategy: { type: Type.STRING, description: "Execution rules: conservative or aggressive entry" },
                },
                required: ["entryTrigger", "stopLoss", "takeProfit", "riskRewardRatio", "executionStrategy"],
              },
            },
            required: ["overallBias", "confluenceScore", "dominantNarrative", "alignedTimeframes", "conflictingTimeframes", "tacticalEntryPlan"],
          },
        },
      });

      const parsedData = JSON.parse(response.text || "{}");
      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Confluence Engine Error:", error);
      return res.status(500).json({ error: error.message || "Failed to execute confluence engine." });
    }
  });

  // API Route: Interactive Chat Grounded on Screen Context
  app.post("/api/chat", async (req, res) => {
    try {
      const { history, currentImage, question, ocrSnip } = req.body;
      if (!question) {
        return res.status(400).json({ error: "Question is required." });
      }

      const client = getGeminiClient();
      const model = "gemini-3.5-flash";

      // Build system instruction grounding
      const systemInstruction = `You are ScreenSight Pro's intelligent Q&A screen analyst.
The user is viewing their screen real-time. You receive user comments, previous conversational history, and any attached screenshots.
Provide helpful, high-fidelity responses. Keep answers compact, insightful, and factual. Do not use complex markdown headings.`;

      // Map chat history to correct format
      const contentsList: any[] = [];

      if (history && Array.isArray(history)) {
        for (const turn of history) {
          contentsList.push({
            role: turn.role === "user" ? "user" : "model",
            parts: [{ text: turn.content }],
          });
        }
      }

      // Add the final user query with optional visual grounding
      const finalParts: any[] = [];
      if (currentImage) {
        finalParts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: currentImage,
          },
        });
      }
      if (ocrSnip) {
        finalParts.push({ text: `Reference Live OCR Scan:\n${ocrSnip}` });
      }
      finalParts.push({ text: question });

      contentsList.push({
        role: "user",
        parts: finalParts,
      });

      const response = await client.models.generateContent({
        model,
        contents: contentsList,
        config: {
          systemInstruction,
        },
      });

      return res.json({ reply: response.text });
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      return res.status(500).json({ error: error.message || "Conversational companion offline." });
    }
  });

  // Hot Module Replacement option, Dev server middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Serve index.html for undefined index-fallback routing
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.info(`[ScreenSight Express] Server serving on http://0.0.0.0:${PORT}`);
  });
}

startServer();
