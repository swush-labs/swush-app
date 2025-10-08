import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils";
import { X } from "lucide-react"
import Image from 'next/image';
import { useWallets } from "@kheopskit/react";

interface ConnectWalletDialogProps {
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}
export default function ConnectWalletDialog({
    isOpen = false,
    onOpenChange
}:ConnectWalletDialogProps) {
    const {wallets} = useWallets();
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange} >
        <DialogContent className="w-11/12 sm:w-full max-w-lg p-6 rounded-xl sm:rounded-xl bg-midnight border border-dark-slate-gray flex flex-col max-h-[85vh] sm:max-h-[80vh]" isCloseIconVisible={false}
         >
          <div className="flex items-center justify-center relative flex-shrink-0 mb-4" >
            <p className="text-white text-2xl font-medium" >Connect Wallet</p>
            <DialogClose className="absolute self-center right-0" ><X className="w-5 h-5 stroke-2 text-white" /></DialogClose>
          </div>
          <div className="flex flex-col items-stretch gap-y-3 overflow-y-auto pr-2 custom-scrollbar" >
          {
            wallets?.map((wallet) => {
              return (
                <div key={wallet.id} className="flex items-center gap-4 p-4 rounded-xl bg-black-wallet-fill border border-dark-slate-gray" >
                  <Image src={wallet.icon} alt={`${wallet.name} icon`} width={48} height={48} className="rounded-full" />
                  <div className="ml-3 space-y-1" >
                    <p className="text-white text-base font-medium" >{wallet?.name}</p>
                    <p className="text-white/60 text-xs font-light" >{wallet?.platform}</p>
                  </div>
                  <button 
                    className={cn("ml-auto rounded-full px-3 py-2 text-sm bg-blue-whale hover:blue-whale/70",
                      wallet?.isConnected ? "text-red-500" : "text-white"
                    )} 
                    onClick={async () => {
                      if(wallet?.isConnected) {
                        await wallet.disconnect()
                        return 
                      }
                      await wallet.connect()
                    }}
                    >{
                    wallet?.isConnected ? "Disconnect" : "Connect"
                    }</button>
                  </div>
              )
            })
          }
          </div>
        </DialogContent>
      </Dialog>
    )
}