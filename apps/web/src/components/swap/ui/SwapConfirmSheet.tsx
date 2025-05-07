import { useEffect, useState } from "react";
import { AlertCircle, ArrowDown, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBalance } from "../utils";
import { FeeBreakdown } from "../hooks/types";

export interface SimulationResult {
  success: boolean;
  estimatedFee: string;
  feeBreakdown?: FeeBreakdown;
  willSucceed: boolean;
  error?: string;
}

export interface SwapConfirmSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  inputAmount: string;
  inputToken: string;
  outputAmount: string;
  outputToken: string;
  slippageTolerance: number;
  simulationResult: SimulationResult | null;
  isConfirming: boolean;
}

export const SwapConfirmSheet: React.FC<SwapConfirmSheetProps> = ({
  isOpen,
  onClose,
  onConfirm,
  inputAmount,
  inputToken,
  outputAmount,
  outputToken,
  slippageTolerance,
  simulationResult,
  isConfirming
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Reset visibility states when the sheet opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  // Determine if the button should be disabled
  const isButtonDisabled = 
    isConfirming || 
    Boolean(simulationResult && (!simulationResult.success || simulationResult.willSucceed === false));

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      onClick={(e) => {
        // Close on backdrop click, but not while confirming
        if (e.target === e.currentTarget && !isConfirming) onClose();
      }}
    >
      <div 
        className={`w-full max-w-md rounded-t-xl bg-slate-900 border border-slate-800 border-b-0 p-5 shadow-xl transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Header with close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Confirm Swap</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            disabled={isConfirming}
          >
            <X size={18} />
          </button>
        </div>

        {/* Swap Summary */}
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between mb-3">
            <span className="text-slate-400">You pay</span>
            <span className="font-medium text-white">{inputAmount} {inputToken}</span>
          </div>
          <div className="flex justify-center my-2">
            <ArrowDown size={20} className="text-slate-500" />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">You receive</span>
            <span className="font-medium text-white">{outputAmount} {outputToken}</span>
          </div>
        </div>

        {/* Simulation Results */}
        {simulationResult && (
          <div className={`mb-4 p-3 rounded-lg border ${
            simulationResult.success && simulationResult.willSucceed
              ? 'bg-green-900/20 border-green-800/30 text-green-300'
              : 'bg-amber-900/20 border-amber-800/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {simulationResult.success && simulationResult.willSucceed ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : (
                <AlertCircle size={16} className="text-amber-400" />
              )}
              <span className="font-medium">
                {simulationResult.success && simulationResult.willSucceed
                  ? 'Transaction Simulation Successful'
                  : 'Transaction May Fail'}
              </span>
            </div>
            {!simulationResult.success && simulationResult.error && (
              <p className="text-sm ml-6">{simulationResult.error}</p>
            )}
          </div>
        )}

        {/* Transaction Details */}
        <div className="mb-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Network Fee</span>
            <span className="text-slate-200">{simulationResult?.estimatedFee || '0.0'} {inputToken}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Slippage Tolerance</span>
            <span className="text-slate-200">{slippageTolerance}%</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Minimum Received</span>
            <span className="text-slate-200">{formatBalance((parseFloat(outputAmount) * (1 - slippageTolerance / 100)).toString())} {outputToken}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-slate-700 hover:bg-slate-800"
            onClick={onClose}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={onConfirm}
            disabled={isButtonDisabled}
          >
            {isConfirming ? 'Confirming...' : 'Confirm Swap'}
          </Button>
        </div>
      </div>
    </div>
  );
}; 