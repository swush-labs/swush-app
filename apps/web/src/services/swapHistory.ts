import { db, swapHistory, type SwapHistory, type NewSwapHistory } from '@/db';
import { eq, desc } from 'drizzle-orm';
import type { RecordSwapParams } from '@/types/swapHistory';

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class SwapHistoryService {
  /**
   * Record a completed swap (success or failure)
   * This is called only after the swap completes, not at the start
   */
  static async recordSwap(params: RecordSwapParams): Promise<SwapHistory> {
    try {
      const [swap] = await db
        .insert(swapHistory)
        .values({
          userWallet: params.walletAddress,
          fromAsset: params.fromAsset,
          toAsset: params.toAsset,
          inputAmount: params.inputAmount,
          outputAmount: params.outputAmount,
          chainFrom: params.chainFrom,
          chainTo: params.chainTo,
          provider: params.provider,
          routeSummary: params.routeSummary,
          status: params.status,
          durationMs: params.durationMs,
          txHash: params.txHash,
          pointsEarned: params.pointsEarned || 0,
        })
        .returning();

      if (!swap) {
        throw new Error('Failed to record swap');
      }

      return swap;
    } catch (error) {
      console.error('Error recording swap:', error);
      throw error;
    }
  }

  /**
   * Get swap history for a wallet address
   */
  static async getByWallet(walletAddress: string, limit = 50): Promise<SwapHistory[]> {
    try {
      const history = await db
        .select()
        .from(swapHistory)
        .where(eq(swapHistory.userWallet, walletAddress))
        .orderBy(desc(swapHistory.createdAt))
        .limit(limit);

      return history;
    } catch (error) {
      console.error('Error fetching swap history:', error);
      throw error;
    }
  }

  /**
   * Get a single swap by ID
   */
  static async getById(swapId: string): Promise<SwapHistory | null> {
    try {
      const [swap] = await db
        .select()
        .from(swapHistory)
        .where(eq(swapHistory.id, swapId))
        .limit(1);

      return swap || null;
    } catch (error) {
      console.error('Error fetching swap by ID:', error);
      throw error;
    }
  }
}

// Re-export types for convenience
export type { SwapHistory, RecordSwapParams };
