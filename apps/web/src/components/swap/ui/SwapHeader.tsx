import { Settings, RotateCcw, History } from 'lucide-react';
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
  onHistoryClick: () => void;
}

export const SwapHeader = ({
  slippageTolerance,
  setSlippageTolerance,
  onHistoryClick,
}: SwapHeaderProps) => {
  return (
    <div className="flex justify-end items-center px-1">
      <div className="flex gap-2 items-center">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="tonalRounded" size="iconLg">
              <Settings className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-blackPearl border-dark-slate-gray">
            <DialogHeader className="flex items-center justify-center" >
              <DialogTitle className="text-white">Settings</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm text-slate-400">Slippage Tolerance (%)</label>
                <Input
                  type="number"
                  value={slippageTolerance}
                  onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
                  className="bg-woodsmoke border-0 text-white no-arrows"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800/50">
          <RotateCcw className="w-5 h-5" />
        </Button> */}
        <Button
        onClick={onHistoryClick}
        variant="tonalRounded"
        size="iconLg"
      >
        <History className="w-5 h-5" />
      </Button>
      </div>
    </div>
  );
};
