import React, { useEffect, useState } from "react";
import { AlertCircle, ArrowDown, CheckCircle, ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBalance } from "../utils";
import { FeeBreakdown } from "../hooks/types";
import { SwapToasts, TOAST_IDS } from "../utils/toastUtils";
import { Dialog, DialogClose, DialogContent, DialogHeader } from "@/components/ui/dialog";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SubTextProps {
  className?: string
  children: React.ReactNode | React.ReactNode[]
}
const SubText:React.FC<SubTextProps> = ({
  className,
  children,
}) => {
  return (
    <p className={cn("text-sm font-normal text-white/70",className)} >{children}</p>
  )
}

interface SwapCardProps {
  label?: string
  token: string
  tokenIcon?: string
  amount: string
}
const SwapCard: React.FC<SwapCardProps> = ({
  label,
  token,
  tokenIcon,
  amount
}) => {
  return (
    <div className="space-y-1" >
      {label && <p className="text-white text-sm font-medium" >{label}</p>}
      <div className="bg-midnight border-darkSlateGray border h-[90px] flex items-center rounded-2xl p-6" >
        {
          tokenIcon ? <Image src={tokenIcon} alt="token-icon" className="size-[45px]" /> :
          <div className="size-[45px] rounded-full bg-blackPearl" ></div>
        }
        <p className="text-[20px] font-medium uppercase ml-3 text-white" >{token ? token : "NOT FOUND"}</p>
        <p className="ml-auto text-white text-[20px] font-medium" >{amount}</p>
      </div>
    </div>
  )
}

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

  // Handle close with toast cleanup
  const handleClose = () => {
    // Dismiss any preparation toasts when cancelling
    SwapToasts.dismiss(TOAST_IDS.SWAP_STATUS);
    onClose();
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="w-[517px] h-[608px] px-6 pt-4 bg-blackPearl border-darkSlateGray" isCloseIconVisible={false}  >
        <div>
          <div className="relative flex items-center justify-center" >
            <DialogClose onClick={handleClose} >
              <ChevronLeft className="text-white absolute left-0 self-center" />
            </DialogClose>
            <p className="text-lg font-medium text-white h-fit" >Confirm Swap</p>
          </div>
          <div className="flex flex-col items-stretch justify-start mt-7" >
            <SwapCard 
              label="You Pay"
              token={inputToken}
              amount={inputAmount}
            />
            <div className="flex justify-center relative mt-[14px] h-[20px]" >
              <div className="absolute bottom-[-10px] size-[30px] rounded-full bg-burningOrange flex items-center justify-center self-center" >
                <ArrowDown className="text-white size-5" />
              </div>
            </div>
            <SwapCard 
              label="You Receive"
              token={outputToken}
              amount={outputAmount}
            />

            <div className="grid grid-cols-2 gap-y-5 mt-[61px]" >
              <SubText>Network Fee</SubText>
              <SubText className="justify-self-end" >
              {simulationResult?.estimatedFee && simulationResult.estimatedFee !== '0' 
                ? `${simulationResult.estimatedFee} ${inputToken}` 
                : '—'}
              </SubText>
              <SubText>Slippage Tolerance</SubText>
              <SubText className="justify-self-end" >{slippageTolerance}%</SubText>
              <SubText>Minimum Received</SubText>
              <SubText className="justify-self-end" >
              {outputAmount && parseFloat(outputAmount) > 0
                ? `${formatBalance((parseFloat(outputAmount) * (1 - slippageTolerance / 100)).toString(), true)} ${outputToken}`
                : '—'}
              </SubText>
            </div>

            <div className="flex items-center flex-row-reverse gap-x-2" >
              <Button 
                variant="primary"
                size="primary"
                className="mt-[26px] w-full"
                onClick={onConfirm}
              >Confirm Swap</Button>

              <button
                className="text-[20px] font-medium hover:bg-transparent text-white mt-5 w-full rounded-full bg-midnight h-[60px]"
                onClick={handleClose}
              >Close</button>
            </div>

            
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      onClick={(e) => {
        // Close on backdrop click, but not while confirming
        if (e.target === e.currentTarget && !isConfirming) handleClose();
      }}
    >
      <div 
        className={`w-full max-w-md rounded-t-2xl bg-forest-900/95 border border-forest-600/50 border-b-0 p-6 shadow-2xl shadow-flame-500/10 backdrop-blur-xl transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Header with close button */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Confirm Swap</h3>
          <button 
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-forest-800/50 text-forest-400 hover:text-white transition-colors"
            disabled={isConfirming}
          >
            <X size={20} />
          </button>
        </div>

        {/* Swap Summary */}
        <div className="bg-forest-800/60 backdrop-blur-sm rounded-xl p-5 mb-5 border border-forest-600/30">
          <div className="flex justify-between mb-4">
            <span className="text-forest-300">You pay</span>
            <span className="font-semibold text-white">
              {inputAmount && parseFloat(inputAmount) > 0 ? `${inputAmount} ${inputToken}` : '— —'}
            </span>
          </div>
          <div className="flex justify-center my-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-flame-400 to-flame-500 flex items-center justify-center">
              <ArrowDown size={16} className="text-white" />
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-forest-300">You receive</span>
            <span className="font-semibold text-white">
              {outputAmount && parseFloat(outputAmount) > 0 ? `${outputAmount} ${outputToken}` : '— —'}
            </span>
          </div>
        </div>

        {/* Simulation Results */}
        {simulationResult && (
          <div className={`mb-4 p-3 rounded-lg border ${
            simulationResult?.success && simulationResult?.willSucceed
              ? 'bg-green-900/20 border-green-800/30 text-green-300'
              : 'bg-amber-900/20 border-amber-800/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {simulationResult?.success && simulationResult?.willSucceed ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : (
                <AlertCircle size={16} className="text-amber-400" />
              )}
              <span className="font-medium">
                {simulationResult?.success && simulationResult?.willSucceed
                  ? 'Transaction Simulation Successful'
                  : 'Transaction May Fail'}
              </span>
            </div>
            {!simulationResult?.success && simulationResult?.error && (
              <p className="text-sm ml-6">{simulationResult?.error}</p>
            )}
          </div>
        )}

        {/* Transaction Details */}
        <div className="mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-forest-400">Network Fee</span>
            <span className="text-forest-200">
              {simulationResult?.estimatedFee && simulationResult?.estimatedFee !== '0' 
                ? `${simulationResult?.estimatedFee} ${inputToken}` 
                : '—'}
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-forest-400">Slippage Tolerance</span>
            <span className="text-forest-200">{slippageTolerance}%</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-forest-400">Minimum Received</span>
            <span className="text-forest-200">
              {outputAmount && parseFloat(outputAmount) > 0
                ? `${formatBalance((parseFloat(outputAmount) * (1 - slippageTolerance / 100)).toString(), true)} ${outputToken}`
                : '—'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-forest-600 text-forest-300 hover:bg-forest-800/50 hover:border-forest-500 transition-all duration-200"
            onClick={handleClose}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            className="flex-1 bg-gradient-to-r from-flame-500 to-flame-400 hover:from-flame-400 hover:to-flame-300 text-white border-0 font-semibold transition-all duration-200 shadow-lg shadow-flame-500/25"
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