import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from '@/components/ui/spinner';
import { SwapHistoryItem } from '@/components/ui/SwapHistoryItem';
import type { SwapHistory } from '@/types/swapHistory';

interface SwapHistoryDialogProps {
  showHistory: boolean;
  setShowHistory: (value: boolean) => void;
  swapHistory: SwapHistory[];
  isLoadingHistory: boolean;
  totalPoints: number;
}

export const SwapHistoryDialog = ({
  showHistory,
  setShowHistory,
  swapHistory,
  isLoadingHistory,
  totalPoints
}: SwapHistoryDialogProps) => {
  return (
    <Dialog open={showHistory} onOpenChange={setShowHistory}>
      <DialogContent className="bg-blackPearl border-dark-slate-gray sm:max-w-md max-sm:w-[90%]">
        <DialogHeader className="flex flex-col items-center gap-1">
          <DialogTitle className="text-lg font-medium text-white">Swap History</DialogTitle>
          {totalPoints > 0 && (
            <span className="text-xs text-tealish-green font-medium">
              {totalPoints} XP earned
            </span>
          )}
        </DialogHeader>
        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6" />
            </div>
          ) : swapHistory.length > 0 ? (
            swapHistory.map((swap) => (
              <SwapHistoryItem key={swap.id} swap={swap} />
            ))
          ) : (
            <p className="text-slate-400 text-center py-8">No swap history yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}; 