import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user';

// POST /api/user/points
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    const user = await UserService.addPoints(walletAddress);
    return NextResponse.json({
      user,
      pointsPerSwap: UserService.getPointsPerSwap(),
    });
  } catch (error) {
    console.error('Error adding points:', error);
    return NextResponse.json(
      { error: 'Failed to add points' },
      { status: 500 }
    );
  }
}
