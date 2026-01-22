import { NextRequest, NextResponse } from 'next/server';
import { SwapHistoryService } from '@/services/swapHistory';
import { UserService } from '@/services/user';

// GET /api/swap-history?walletAddress=xxx
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    const history = await SwapHistoryService.getByWallet(walletAddress);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching swap history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch swap history' },
      { status: 500 }
    );
  }
}

// POST /api/swap-history
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Ensure user exists before recording swap (required for foreign key constraint)
    await UserService.getOrCreate(body.walletAddress);
    
    const swap = await SwapHistoryService.recordSwap(body);
    return NextResponse.json(swap);
  } catch (error) {
    console.error('Error recording swap:', error);
    return NextResponse.json(
      { error: 'Failed to record swap' },
      { status: 500 }
    );
  }
}
