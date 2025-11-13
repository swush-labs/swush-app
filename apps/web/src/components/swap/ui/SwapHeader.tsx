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

// Slippage presets for quick selection
// ParaSpell now supports decimal slippage percentages
const SLIPPAGE_PRESETS = [0.1, 0.5, 1, 3, 5];
const MIN_SLIPPAGE = 0.01;
const MAX_SLIPPAGE = 50;

export const SwapHeader = ({
  slippageTolerance,
  setSlippageTolerance,
  onHistoryClick,
}: SwapHeaderProps) => {
  // Validate and clamp slippage value
  const handleSlippageChange = (value: string) => {
    const numValue = parseFloat(value);
    
    // Allow empty input for user to type
    if (value === '' || isNaN(numValue)) {
      return;
    }
    
    // Clamp between min and max
    const clampedValue = Math.max(MIN_SLIPPAGE, Math.min(MAX_SLIPPAGE, numValue));
    
    // Round to 2 decimal places for precision
    const roundedValue = Math.round(clampedValue * 100) / 100;
    
    setSlippageTolerance(roundedValue);
  };

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
                
                {/* Preset buttons */}
                <div className="flex gap-2 mb-2">
                  {SLIPPAGE_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      variant={slippageTolerance === preset ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSlippageTolerance(preset)}
                      className={`flex-1 ${
                        slippageTolerance === preset 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-woodsmoke border-slate-600 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {preset}%
                    </Button>
                  ))}
                </div>

                {/* Custom input */}
                <div className="relative">
                  <Input
                    type="number"
                    value={slippageTolerance}
                    onChange={(e) => handleSlippageChange(e.target.value)}
                    onBlur={(e) => {
                      // Ensure valid value on blur
                      const value = parseFloat(e.target.value);
                      if (isNaN(value) || value < MIN_SLIPPAGE) {
                        setSlippageTolerance(MIN_SLIPPAGE);
                      }
                    }}
                    min={MIN_SLIPPAGE}
                    max={MAX_SLIPPAGE}
                    step={0.1}
                    className="bg-woodsmoke border-0 text-white no-arrows pr-8"
                    placeholder="Custom"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                    %
                  </span>
                </div>
                
                {/* Warning for high slippage */}
                {slippageTolerance > 5 && (
                  <p className="text-xs text-yellow-500 mt-1">
                    ⚠️ High slippage tolerance may result in unfavorable rates
                  </p>
                )}
                
                {/* Info text */}
                <p className="text-xs text-slate-500 mt-1">
                  Slippage range: {MIN_SLIPPAGE}% - {MAX_SLIPPAGE}%
                </p>
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
