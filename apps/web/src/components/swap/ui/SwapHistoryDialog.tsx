import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from '@/components/ui/spinner';
import { SwapHistoryItem } from '@/components/ui/SwapHistoryItem';
import { SwapHistory } from '@/services/swapHistoryService';

interface SwapHistoryDialogProps {
  showHistory: boolean;
  setShowHistory: (value: boolean) => void;
  swapHistory: SwapHistory[];
  isLoadingHistory: boolean;
}

export const SwapHistoryDialog = ({
  showHistory,
  setShowHistory,
  swapHistory,
  isLoadingHistory
}: SwapHistoryDialogProps) => {
  return (
    <Dialog open={showHistory} onOpenChange={setShowHistory}>
      <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">Swap History</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4 max-h-96 overflow-y-auto">
          {isLoadingHistory ? (
            <div className="flex justify-center">
              <Spinner className="w-6 h-6" />
            </div>
          ) : swapHistory.length > 0 ? (
            swapHistory.map((swap) => (
              <SwapHistoryItem key={swap.id} swap={swap} />
            ))
          ) : (
            <p className="text-slate-400 text-center">No swap history yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}; 