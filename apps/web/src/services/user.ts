import { db, users, type User, type NewUser } from '@/db';
import { eq } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const POINTS_PER_SWAP = 60;

const RANK_THRESHOLDS = [
  { name: 'Master', minPoints: 10000 },
  { name: 'Expert', minPoints: 5000 },
  { name: 'Advanced', minPoints: 2000 },
  { name: 'Intermediate', minPoints: 500 },
  { name: 'Initiate', minPoints: 0 },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class UserService {
  /**
   * Get user by wallet address
   */
  static async getUser(walletAddress: string): Promise<User | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, walletAddress))
        .limit(1);

      return user || null;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }

  /**
   * Get or create user (ensures user exists)
   */
  static async getOrCreate(walletAddress: string): Promise<User> {
    try {
      // Try to get existing user
      const existing = await this.getUser(walletAddress);
      if (existing) {
        return existing;
      }

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          walletAddress,
          totalPoints: 0,
          totalSwaps: 0,
          currentRank: 'Initiate',
        })
        .returning();

      if (!newUser) {
        throw new Error('Failed to create user');
      }

      return newUser;
    } catch (error) {
      console.error('Error in getOrCreate:', error);
      throw error;
    }
  }

  /**
   * Add points to user and return new total
   * Automatically updates rank based on new total
   */
  static async addPoints(
    walletAddress: string,
    points: number = POINTS_PER_SWAP
  ): Promise<number> {
    try {
      // Get or create user
      const user = await this.getOrCreate(walletAddress);

      // Calculate new totals
      const newTotalPoints = user.totalPoints + points;
      const newTotalSwaps = user.totalSwaps + 1;
      const newRank = this.calculateRank(newTotalPoints);

      // Update user
      const [updatedUser] = await db
        .update(users)
        .set({
          totalPoints: newTotalPoints,
          totalSwaps: newTotalSwaps,
          currentRank: newRank,
        })
        .where(eq(users.walletAddress, walletAddress))
        .returning();

      if (!updatedUser) {
        throw new Error('Failed to update user points');
      }

      return updatedUser.totalPoints;
    } catch (error) {
      console.error('Error adding points:', error);
      throw error;
    }
  }

  /**
   * Calculate rank based on total points
   */
  private static calculateRank(totalPoints: number): string {
    for (const rank of RANK_THRESHOLDS) {
      if (totalPoints >= rank.minPoints) {
        return rank.name;
      }
    }
    return 'Initiate';
  }

  /**
   * Get points per swap constant (for display purposes)
   */
  static getPointsPerSwap(): number {
    return POINTS_PER_SWAP;
  }
}

// Re-export types for convenience
export type { User };
