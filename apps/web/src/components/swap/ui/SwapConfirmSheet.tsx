import React, { useEffect, useState } from "react";
import { AlertCircle, ArrowDown, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBalance } from "../utils";
import { FeeBreakdown } from "../hooks/types";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
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
    <p className={cn("text-sm font-normal text-white/70 max-w-40",className)} >{children}</p>
  )
}

interface SwapCardProps {
  label?: string
  token: string
  tokenIcon?: string
  amount: string
  className?: string
}
const SwapCard: React.FC<SwapCardProps> = ({
  label,
  token,
  tokenIcon,
  amount,
  className
}) => {
  return (
    <div className={cn("space-y-1", className)} >
      {label && <p className="text-white text-sm font-medium" >{label}</p>}
      <div className="h-fit flex items-center rounded-2xl" >
        {
          tokenIcon ? <Image src={tokenIcon} alt="token-icon" className="size-[45px]" /> :
          <div className="size-[45px] rounded-full bg-blackPearl" ></div>
        }
        <p className="text-lg font-medium uppercase ml-3 text-white" >{token ? token : "NOT FOUND"}</p>
        <p className="ml-auto text-white text-xl sm:text-2xl font-medium max-w-20 sm:max-w-44 overflow-hidden" >{amount}</p>
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

  return (
    <Dialog open={isOpen || true}>
      <DialogContent className="w-[90%] sm:w-full max-w-md px-4 py-4 sm:pb-8 bg-blackPearl border-dark-slate-gray rounded-xl sm:rounded-2xl" isCloseIconVisible={false}  >
        <div>
          <div className="relative flex items-center justify-center" >
            <DialogClose onClick={onClose} className="absolute right-0 self-center" >
              <X className="text-white" />
            </DialogClose>
            <p className="text-lg font-medium text-white h-fit" >Confirm Swap</p>
          </div>
          <div className="flex flex-col items-stretch justify-start mt-6" >
            <div className="bg-midnight border border-dark-slate-gray rounded-2xl pt-4 pb-4 shadow-[4px_4px_12px_0_rgba(0,0,0,0.25)]" >
              <SwapCard 
                label="You Pay"
                token={inputToken}
                amount={inputAmount}
                className="pl-4 sm:pl-8 pr-6"
              />
              <div className="flex items-center justify-center relative mt-[18px] h-[1px] bg-dark-slate-gray" >
                <div className="absolute size-[30px] rounded-full bg-burning-orange flex items-center justify-center self-center" >
                  <ArrowDown className="text-white size-5" />
                </div>
              </div>
              <SwapCard 
                label="You Receive"
                token={outputToken}
                amount={outputAmount}
                className="pl-4 sm:pl-8 pr-6 pt-4"
              />
            </div>

            {/* Show warning if simulation indicates potential failure */}
            {simulationResult && !simulationResult.willSucceed && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-red-400 w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-red-400 font-medium text-sm">Transaction may fail</p>
                    <p className="text-red-300/70 text-xs mt-1">
                      {simulationResult.error || 'Dry-run simulation indicates this swap might not succeed'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-4 mt-8" >
              <SubText>Network Fee</SubText>
              <SubText className="justify-self-end" >
              {simulationResult?.estimatedFee && simulationResult.estimatedFee !== '0' 
                ? `${simulationResult.estimatedFee}` 
                : '—'}
              </SubText>
              <SubText>Slippage Tolerance</SubText>
              <SubText className="justify-self-end" >{slippageTolerance}%</SubText>
              <SubText>Minimum Received</SubText>
              <SubText className="justify-self-end text-right" >
              {outputAmount && parseFloat(outputAmount) > 0
                ? `${formatBalance((parseFloat(outputAmount) * (1 - slippageTolerance / 100)).toString(), true)} ${outputToken}`
                : '—'}
              </SubText>
            </div>

            <div className="flex items-center flex-row-reverse gap-x-2" >
              <Button 
                variant="primary"
                size="primary"
                className="mt-[26px] w-full text-sm sm:text-base"
                onClick={onConfirm}
              >Confirm Swap</Button>

              <button
                className="text-sm sm:text-base font-medium hover:bg-midnight/80 text-white mt-5 w-full rounded-full bg-midnight h-[60px]"
                onClick={onClose}
              >Close</button>
            </div>

            
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}; 