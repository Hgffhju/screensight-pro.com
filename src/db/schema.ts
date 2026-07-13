import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

// Define the 'users' table
export const users = pgTable("users", {
  uid: text("uid").primaryKey(), // Firebase Auth UID directly as primary key
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define the 'analyses' table for timeframe scans
export const analyses = pgTable("analyses", {
  id: text("id").primaryKey(), // Custom ID e.g. analysis_...
  userId: text("user_id")
    .references(() => users.uid, { onDelete: "cascade" })
    .notNull(),
  timeframe: text("timeframe").notNull(),
  bias: text("bias").notNull(),
  trend: text("trend").notNull(),
  candlestickPattern: text("candlestick_pattern").notNull(),
  chartPattern: text("chart_pattern").notNull(),
  smcSignals: text("smc_signals").notNull(),
  supportLevel: text("support_level"),
  resistanceLevel: text("resistance_level"),
  momentum: text("momentum"),
  movingAverageAlignment: text("moving_average_alignment"),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define the 'confluences' table for market synthesis
export const confluences = pgTable("confluences", {
  id: text("id").primaryKey(), // Custom ID e.g. conf_...
  userId: text("user_id")
    .references(() => users.uid, { onDelete: "cascade" })
    .notNull(),
  overallBias: text("overall_bias").notNull(),
  confluenceScore: integer("confluence_score").notNull(),
  dominantNarrative: text("dominant_narrative").notNull(),
  alignedTimeframes: jsonb("aligned_timeframes").$type<string[]>().notNull(),
  conflictingTimeframes: jsonb("conflicting_timeframes").$type<string[]>().notNull(),
  tacticalEntryPlan: jsonb("tactical_entry_plan").$type<{
    entryTrigger: string;
    stopLoss: string;
    takeProfit: string;
    riskRewardRatio: string;
    executionStrategy: string;
  }>(),
  timeframeSuite: jsonb("timeframe_suite").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relationships for the 'users' table
export const usersRelations = relations(users, ({ many }) => ({
  analyses: many(analyses),
  confluences: many(confluences),
  premiumPurchases: many(premiumPurchases),
}));

// Define relationships for the 'analyses' table
export const analysesRelations = relations(analyses, ({ one }) => ({
  user: one(users, {
    fields: [analyses.userId],
    references: [users.uid],
  }),
}));

// Define relationships for the 'confluences' table
export const confluencesRelations = relations(confluences, ({ one }) => ({
  user: one(users, {
    fields: [confluences.userId],
    references: [users.uid],
  }),
}));

// Define the 'premium_purchases' table
export const premiumPurchases = pgTable("premium_purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.uid, { onDelete: "cascade" })
    .notNull(),
  strategyId: text("strategy_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  transactionCode: text("transaction_code").notNull().unique(),
  amountPaid: integer("amount_paid").notNull(),
  status: text("status").notNull(), // 'pending' or 'verified'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relationships for the 'premium_purchases' table
export const premiumPurchasesRelations = relations(premiumPurchases, ({ one }) => ({
  user: one(users, {
    fields: [premiumPurchases.userId],
    references: [users.uid],
  }),
}));
