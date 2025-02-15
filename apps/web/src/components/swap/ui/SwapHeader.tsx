import { Settings, RotateCcw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

interface SwapHeaderProps {
  slippageTolerance: number;
  setSlippageTolerance: (value: number) => void;
  transactionDeadline: number;
  setTransactionDeadline: (value: number) => void;
}

export const SwapHeader = ({
  slippageTolerance,
  setSlippageTolerance,
  transactionDeadline,
  setTransactionDeadline
}: SwapHeaderProps) => {
  return (
    <div className="flex justify-between items-center px-1">
      <h1 className="text-2xl font-bold text-white"></h1>
      <div className="flex gap-2 items-center">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800/50">
              <Settings className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Settings</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm text-slate-400">Slippage Tolerance (%)</label>
                <Input
                  type="number"
                  value={slippageTolerance}
                  onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm text-slate-400">Transaction Deadline (minutes)</label>
                <Input
                  type="number"
                  value={transactionDeadline}
                  onChange={(e) => setTransactionDeadline(parseInt(e.target.value))}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800/50">
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}; 