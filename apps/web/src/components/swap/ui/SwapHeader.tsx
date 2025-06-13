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
import { WalletButton, WalletMenu } from '@/components/swap';

interface SwapHeaderProps {
  slippageTolerance: number;
  setSlippageTolerance: (value: number) => void;
}

interface HeaderActionsProps {
  isConnected: boolean;
  setIsConnected: (value: boolean) => void;
  setWalletAddress: (value: string) => void;
  walletAddress: string;
  onDisconnect: () => void;
  onHistoryClick: () => void;
  isSwapping: boolean;
  setIsSwapping: (value: boolean) => void;
}

export const SwapHeader = ({
  slippageTolerance,
  setSlippageTolerance
}: SwapHeaderProps) => {
  return (
    <div className="flex justify-end items-center px-1">
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

export const HeaderActions = ({
  isConnected,
  setIsConnected,
  setWalletAddress,
  walletAddress,
  onDisconnect,
  onHistoryClick,
  isSwapping,
  setIsSwapping
}: HeaderActionsProps) => {
  return (
    <div className="fixed top-4 right-4 hidden sm:flex items-center gap-4 z-50">
      <Button
        onClick={onHistoryClick}
        variant="outline"
        size="icon"
        className="bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-slate-300 transition-all duration-200"
      >
        <History className="w-4 h-4" />
      </Button>
      {!isConnected ? (
        <WalletButton
          isConnected={isConnected}
          setIsConnected={setIsConnected}
          setWalletAddress={setWalletAddress}
          variant="outline"
          className="flex items-center gap-2 bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-slate-300 transition-all duration-200"
          onWalletModalClose={() => {
            // Reset swapping state if wallet modal is closed without connecting
            if (isSwapping) {
              setIsSwapping(false);
            }
          }}
        />
      ) : (
        <WalletMenu
          address={walletAddress}
          onDisconnect={onDisconnect}
          className="bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-slate-300 transition-all duration-200"
        />
      )}
    </div>
  );
}; 