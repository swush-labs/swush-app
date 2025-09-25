import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";


interface SwapCompleteDialogProps {
    isOpen?: boolean
    isSwappingInProgress?: boolean
    isSwapComplete?: boolean
}


export function SwapCompleteDialog({
    isOpen = false,
    isSwappingInProgress = false,
    isSwapComplete = false,
}:SwapCompleteDialogProps) {
    const [swapProgress, setSwapProgress] = useState<number>(10)

    console.log({
        isSwappingInProgress,
        isSwapComplete,
        swapProgress
    })

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
    return (
        <Dialog open={isOpen}>
            <DialogContent className={cn("bg-baltic-sea border-none w-[489px] h-[178px] overflow-hidden"
            )} isCloseIconVisible={false} >
                {
                    isSwappingInProgress || swapProgress < 100 && (
                        <div className="w-full h-full flex items-center justify-center gap-x-2" >
                            <Zap className="size-8 text-white" />
                            <p className="text-[32px] font-bold text-white" >Swapping in Progress…</p>

                            <Progress 
                                className="absolute left-[-5px] w-[110%] bottom-[-7px] h-4" 
                                indicatorClassName="bg-tealish-green"
                                value={swapProgress} 
                            />
                        </div>
                    )
                }
                {
                    isSwapComplete && swapProgress >= 100 && (
                        <div className="flex flex-col items-center" >
                            <div className="flex items-center justify-center rounded-full bg-tune size-[65px]" >
                                <Image src="/icons/check_circle.svg" alt="check-icon" width={40} height={40} />
                            </div>

                            <p className="text-white text-[32px] font-bold" >Swap Complete!</p>
                        </div>
                    )
                }
            </DialogContent>
        </Dialog>
    )
}