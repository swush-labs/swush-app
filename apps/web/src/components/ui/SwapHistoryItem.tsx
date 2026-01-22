import { formatDistanceToNow } from 'date-fns';
import type { SwapHistory } from '@/types/swapHistory';

interface SwapHistoryItemProps {
  swap: SwapHistory;
}

export function SwapHistoryItem({ swap }: SwapHistoryItemProps) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
      {/* Row 1: Swap pair + Status */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-slate-100 font-medium">{swap.fromAsset}</span>
          <span className="text-slate-500">→</span>
          <span className="text-slate-100 font-medium">{swap.toAsset}</span>
        </div>
        <span className={`px-2 py-0.5 text-xs rounded-full ${
          swap.status === 'success' 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-red-500/20 text-red-400'
        }`}>
          {swap.status === 'success' ? '✓' : '✗'}
        </span>
      </div>
      
      {/* Row 2: Amount, Time, Provider */}
      <div className="flex justify-between items-center mt-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">{swap.inputAmount} {swap.fromAsset}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-500">
            {formatDistanceToNow(new Date(swap.createdAt), { addSuffix: true })}
          </span>
        </div>
        {/* Provider badge */}
        <span className={`px-1.5 py-0.5 rounded text-xs ${
          swap.provider === 'chainflip'
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-purple-500/20 text-purple-400'
        }`}>
          {swap.provider === 'chainflip' ? 'Chainflip' : 'XCM'}
        </span>
      </div>
    </div>
  );
}