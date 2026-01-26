import { pgTable, text, integer, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core';

// ═══════════════════════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════════════════════

export const swapProviderEnum = pgEnum('swap_provider', ['xcm', 'chainflip']);
export const swapStatusEnum = pgEnum('swap_status', ['success', 'failed']);

// ═══════════════════════════════════════════════════════════════════════════════
// Users Table
// ═══════════════════════════════════════════════════════════════════════════════

export const users = pgTable('users', {
  walletAddress: text('wallet_address').primaryKey(),
  totalPoints: integer('total_points').notNull().default(0),
  totalSwaps: integer('total_swaps').notNull().default(0),
  currentRank: text('current_rank').notNull().default('Initiate'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// Swap History Table
// ═══════════════════════════════════════════════════════════════════════════════

export const swapHistory = pgTable('swap_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // User & addresses
  userWallet: text('user_wallet').notNull().references(() => users.walletAddress),
  
  // Assets
  fromAsset: text('from_asset').notNull(),
  toAsset: text('to_asset').notNull(),
  inputAmount: text('input_amount').notNull(),
  outputAmount: text('output_amount'),
  
  // Chains
  chainFrom: text('chain_from').notNull(),
  chainTo: text('chain_to').notNull(),
  
  // Provider & routing
  provider: swapProviderEnum('provider').notNull(),
  routeSummary: text('route_summary').notNull(),
  
  // Status & timing
  status: swapStatusEnum('status').notNull(),
  durationMs: integer('duration_ms'),
  
  // Transaction references
  txHash: text('tx_hash'),
  
  // Points
  pointsEarned: integer('points_earned').notNull().default(0),
  
  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SwapHistory = typeof swapHistory.$inferSelect;
export type NewSwapHistory = typeof swapHistory.$inferInsert;
