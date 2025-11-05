import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface SwushPointCardProps {
    points: number
    className?: string
}

const SwushPointCard:React.FC<SwushPointCardProps> = ({
    className,
    points
}) => {
    return (
        <div className={cn("w-[194px] rounded-xl border border-white pt-[42px] pb-12 flex flex-col items-center gap-y-7 bg-gradient-to-b from-myrtle to-black", className)} >
            <Image src="/images/swush-coin.png" alt="coin" width={105} height={105} className="w-[105px] h-[105px]" />
            <div className="flex flex-col items-center gap-y-1" >
                <p className="text-white max-sm:text-3xl text-[38px] font-extrabold" >{points}+</p>
                <p className="text-white max-sm:text-sm text-base font-normal" >Swush Points</p>
            </div>
        </div>
    )
}

interface SecretGiftProps {
    className?: string
    onMouseDown?: () => void
}

const SecretGift:React.FC<SecretGiftProps> = ({
    className,
    onMouseDown
}) => {
    return (
        <div className={cn("flex flex-col items-center gap-y-[29px]", className)} onMouseDown={onMouseDown} >
            <div className="w-[210px] py-20 rounded-xl bg-gradient-to-b from-blueberry-blue to-prussian-blue flex items-center justify-center" >
                <div className="rounded-full w-[140px] h-[140px] bg-faded-orange/10 flex items-center justify-center" >
                    <Image src="/icons/gift-box.svg" alt="gift-box icon" width={64} height={64} className="size-16" />
                </div>
            </div>

            <p className="text-center text-cloud max-sm:text-sm text-base font-normal max-sm:w-[200px] w-[263px]" >“Swipe or click to reveal your reward!”</p>
        </div>
    )
}

/**
 * Format transaction type for display
 */
const formatTransactionType = (type: string | null | undefined): string => {
  if (!type) return 'Processing...';
  
  switch (type) {
    case 'SELECTING_EXCHANGE':
      return 'Selecting best exchange';
    case 'TRANSFER':
      return 'Transferring assets';
    case 'SWAP':
      return 'Swapping on DEX';
    case 'SWAP_AND_TRANSFER':
      return 'Swapping and transferring';
    case 'COMPLETED':
      return 'Completed';
    default:
      return type;
  }
};

interface SwapCompleteDialogProps {
    isOpen?: boolean
    isSwappingInProgress?: boolean
    isSwapComplete?: boolean
    inputAmount: string
    inputToken: string
    outputAmount: string
    outputToken: string
    duration: number
    onClose?: () => void
    currentStep?: number
    totalSteps?: number
    currentTransactionType?: string | null
}

export function SwapCompleteDialog({
    isOpen = false,
    isSwappingInProgress = false,
    isSwapComplete = false,
    inputAmount,
    inputToken,
    outputAmount,
    outputToken,
    duration,
    onClose,
    currentStep,
    totalSteps,
    currentTransactionType,
}:SwapCompleteDialogProps) {
    const [swapProgress, setSwapProgress] = useState<number>(10)
    const [isGiftRevealed, setIsGiftRevealed] = useState<boolean>(false)

    useEffect(() => {
        if(!isSwapComplete) return

        const intervalTimeout: NodeJS.Timeout = setInterval(() => {
            setSwapProgress(prev => {
                if(prev >= 100) {
                    clearInterval(intervalTimeout)
                    return 100;
                }
                return prev + 20
            })
        },300)
    },[isSwapComplete])

    const reset = () => {
        setSwapProgress(10)
        setIsGiftRevealed(false)
    }
    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if(swapProgress < 100) return
            if(!isGiftRevealed) return
            if(!open) {
                onClose?.();
                reset()
            }
        }} >
            <DialogContent className={cn("bg-blackPearl border-none rounded-xl w-[90%] sm:w-[489px] py-0 overflow-hidden"
            )} isCloseIconVisible={swapProgress >= 100 && isGiftRevealed} >
                {
                    (isSwappingInProgress || swapProgress < 100) && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-y-3 py-[78px]" >
                            <DialogTitle className="flex items-center gap-x-2">
                                <Zap className="size-8 text-white" />
                                <span className="text-lg sm:text-xl font-bold text-white">Swapping in Progress…</span>
                            </DialogTitle>

                            {/* Show multi-step progress if available */}
                            {currentStep !== undefined && totalSteps !== undefined && totalSteps > 1 && (
                                <div className="text-center">
                                    <p className="text-sm text-white/60">
                                        Step {currentStep + 1} of {totalSteps}
                                    </p>
                                    <p className="text-xs text-white/50 mt-1">
                                        {formatTransactionType(currentTransactionType)}
                                    </p>
                                </div>
                            )}

                            <Progress 
                                className="absolute left-[-5px] w-[110%] bottom-[-7px] h-4" 
                                indicatorClassName="bg-tealish-green"
                                value={swapProgress} 
                            />
                        </div>
                    )
                }
                {
                    (isSwapComplete && swapProgress >= 100) && (
                        <div className="flex flex-col items-center pb-[46px] pt-[36px]" >
                            <div className="flex items-center justify-center rounded-full bg-tune size-[65px]" >
                                <Image src="/icons/check_circle.svg" alt="check-icon" width={40} height={40} />
                            </div>

                            <DialogTitle className="text-white text-xl sm:text-3xl font-bold">Swap Complete!</DialogTitle>
                            <p className="text-cloud text-sm sm:text-base font-normal" >{`${inputAmount} ${inputToken} → ${outputAmount} ${outputToken}`}</p>
                            {
                                isGiftRevealed ? <SwushPointCard points={60} className="mt-9 sm:mt-16" /> :
                                <SecretGift className="mt-8" onMouseDown={() => {
                                    setIsGiftRevealed(true)
                                }} />
                            }
                        </div>
                    )
                }
            </DialogContent>
        </Dialog>
    )
}