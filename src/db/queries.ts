import { eq, desc } from "drizzle-orm";
import { db } from "./index.ts";
import { users, analyses, confluences, premiumPurchases } from "./schema.ts";

export async function getOrCreateUser(uid: string, email: string, displayName: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        displayName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database query getOrCreateUser failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function getUserConfluences(uid: string) {
  try {
    return await db.select()
      .from(confluences)
      .where(eq(confluences.userId, uid))
      .orderBy(desc(confluences.createdAt));
  } catch (error) {
    console.error("Database query getUserConfluences failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function saveConfluenceSession(
  uid: string,
  confluencePayload: {
    id: string;
    overallBias: string;
    confluenceScore: number;
    dominantNarrative: string;
    alignedTimeframes: string[];
    conflictingTimeframes: string[];
    tacticalEntryPlan: any;
    timeframeSuite: string[];
  },
  analysesPayloads: Array<{
    id: string;
    timeframe: string;
    bias: string;
    trend: string;
    candlestickPattern: string;
    chartPattern: string;
    smcSignals: string;
    supportLevel: string | null;
    resistanceLevel: string | null;
    momentum: string | null;
    movingAverageAlignment: string | null;
    summary: string;
  }>
) {
  try {
    // 1. Save individual timeframe analyses
    for (const analysis of analysesPayloads) {
      await db.insert(analyses)
        .values({
          id: analysis.id,
          userId: uid,
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
          summary: analysis.summary,
        })
        .onConflictDoUpdate({
          target: analyses.id,
          set: {
            bias: analysis.bias,
            trend: analysis.trend,
            candlestickPattern: analysis.candlestickPattern,
            chartPattern: analysis.chartPattern,
            smcSignals: analysis.smcSignals,
            supportLevel: analysis.supportLevel,
            resistanceLevel: analysis.resistanceLevel,
            momentum: analysis.momentum,
            movingAverageAlignment: analysis.movingAverageAlignment,
            summary: analysis.summary,
          },
        });
    }

    // 2. Save master confluence record
    const result = await db.insert(confluences)
      .values({
        id: confluencePayload.id,
        userId: uid,
        overallBias: confluencePayload.overallBias,
        confluenceScore: confluencePayload.confluenceScore,
        dominantNarrative: confluencePayload.dominantNarrative,
        alignedTimeframes: confluencePayload.alignedTimeframes,
        conflictingTimeframes: confluencePayload.conflictingTimeframes,
        tacticalEntryPlan: confluencePayload.tacticalEntryPlan,
        timeframeSuite: confluencePayload.timeframeSuite,
      })
      .onConflictDoUpdate({
        target: confluences.id,
        set: {
          overallBias: confluencePayload.overallBias,
          confluenceScore: confluencePayload.confluenceScore,
          dominantNarrative: confluencePayload.dominantNarrative,
          alignedTimeframes: confluencePayload.alignedTimeframes,
          conflictingTimeframes: confluencePayload.conflictingTimeframes,
          tacticalEntryPlan: confluencePayload.tacticalEntryPlan,
          timeframeSuite: confluencePayload.timeframeSuite,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database transaction saveConfluenceSession failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function deleteConfluenceSession(uid: string, confluenceId: string) {
  try {
    await db.delete(confluences)
      .where(eq(confluences.id, confluenceId));
    return { success: true };
  } catch (error) {
    console.error("Database query deleteConfluenceSession failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function recordPremiumPurchase(
  uid: string,
  strategyId: string,
  phoneNumber: string,
  transactionCode: string,
  amountPaid: number,
  status: string = "pending"
) {
  try {
    const result = await db.insert(premiumPurchases)
      .values({
        id: `purch_${Math.random().toString(36).substring(2, 11)}`,
        userId: uid,
        strategyId,
        phoneNumber,
        transactionCode: transactionCode.toUpperCase().trim(),
        amountPaid,
        status,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Database query recordPremiumPurchase failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function getUserPremiumPurchases(uid: string) {
  try {
    return await db.select()
      .from(premiumPurchases)
      .where(eq(premiumPurchases.userId, uid))
      .orderBy(desc(premiumPurchases.createdAt));
  } catch (error) {
    console.error("Database query getUserPremiumPurchases failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

export async function getVerifiedPurchaseByCode(code: string) {
  try {
    const results = await db.select()
      .from(premiumPurchases)
      .where(eq(premiumPurchases.transactionCode, code.toUpperCase().trim()));
    return results[0] || null;
  } catch (error) {
    console.error("Database query getVerifiedPurchaseByCode failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
