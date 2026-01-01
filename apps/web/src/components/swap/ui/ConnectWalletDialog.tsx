import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn, shortenAddress } from "@/lib/utils";
import { X, ArrowLeft, Check } from "lucide-react"
import Image from 'next/image';
import { useWallets } from "@kheopskit/react";
import { useSelectedAccount } from "@/components/wallet/use-selected-account";
import Identicon from "@/components/ui/identicon";
import { useState, useEffect, useRef } from "react";
import { toast } from 'react-hot-toast';

// Account Card Component
const AccountCard = ({ 
  account, 
  isSelected, 
  onSelect 
}: { 
  account: any; 
  isSelected: boolean; 
  onSelect: () => void; 
}) => (
  <div 
    className={cn(
      "p-4 rounded-xl cursor-pointer transition-all",
      isSelected 
        ? 'bg-tealish-green/10 border-2 border-tealish-green' 
        : 'bg-black-wallet-fill border border-dark-slate-gray hover:border-prussian-blue'
    )}
    onClick={onSelect}
  >
    <div className="flex items-center gap-3">
      <div className="relative">
        <Identicon
          value={account.address}
          size={40}
          theme="polkadot"
          className="rounded-full"
        />
      </div>
      <div className="flex-1">
        <div className="font-medium text-white text-base">
          {account.platform === "polkadot" && 'name' in account ? account.name : "Account"}
        </div>
        <div className="text-sm text-white/60 font-mono">
          {shortenAddress(account.address)}
        </div>
        <div className="text-xs text-white/50 capitalize">
          {account.platform}
        </div>
      </div>
      {isSelected && (
        <div className="bg-tealish-green rounded-full p-1.5">
          <Check className="h-4 w-4 text-midnight" strokeWidth={3} />
        </div>
      )}
    </div>
  </div>
);

interface ConnectWalletDialogProps {
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

export default function ConnectWalletDialog({
    isOpen = false,
    onOpenChange
}:ConnectWalletDialogProps) {
    const { wallets, accounts } = useWallets();
    const { selectedAccount, setSelectedAccount } = useSelectedAccount();
    const [currentView, setCurrentView] = useState<"wallets" | "accounts">("wallets");
    const [forceWalletView, setForceWalletView] = useState(false);
    const [selectedWalletName, setSelectedWalletName] = useState<string | null>(null);
    const [selectedWalletPlatform, setSelectedWalletPlatform] = useState<string | null>(null);
    
    const connectedWallets = wallets.filter(wallet => wallet.isConnected);
    const hasConnectedWallets = connectedWallets.length > 0;
    
    // Use ref to prevent useEffect conflicts
    const isUserNavigating = useRef(false);

    // Filter accounts based on selected wallet AND platform
    const filteredAccounts = selectedWalletName && selectedWalletPlatform
      ? accounts.filter(account => 
          account.walletName === selectedWalletName && 
          account.platform === selectedWalletPlatform
        )
      : selectedWalletName
      ? accounts.filter(account => account.walletName === selectedWalletName)
      : accounts;

    // Auto-select account if only one is available AND it belongs to the filtered wallet
    useEffect(() => {
      if (filteredAccounts.length === 1 && currentView === "accounts") {
        // Only auto-select if no account is selected, or if the selected account is not in the current filtered list
        if (!selectedAccount || !filteredAccounts.find(acc => acc.id === selectedAccount.id)) {
          // Don't auto-select, let user explicitly choose
          // This prevents unwanted automatic selection when switching between wallets
        }
      }
    }, [filteredAccounts, selectedAccount, currentView, setSelectedAccount]);

    // Smart view management - but respect user navigation
    useEffect(() => {
      if (isUserNavigating.current || forceWalletView) {
        return; // Don't auto-change view if user is navigating or forced to wallet view
      }

      if (hasConnectedWallets && accounts.length > 0) {
        setCurrentView("accounts");
        
        // Auto-select wallet filter if not set
        if (!selectedWalletName || !selectedWalletPlatform) {
          if (connectedWallets.length === 1) {
            // Single wallet: auto-select it
            setSelectedWalletName(connectedWallets[0].name);
            setSelectedWalletPlatform(connectedWallets[0].platform);
          } else if (selectedAccount) {
            // Multiple wallets with selected account: show that account's wallet and platform
            setSelectedWalletName(selectedAccount.walletName);
            setSelectedWalletPlatform(selectedAccount.platform);
          } else if (connectedWallets.length > 0) {
            // Multiple wallets, no selection: show most recently connected wallet
            const lastWallet = connectedWallets[connectedWallets.length - 1];
            setSelectedWalletName(lastWallet.name);
            setSelectedWalletPlatform(lastWallet.platform);
          }
        }
      } else {
        setCurrentView("wallets");
      }
    }, [hasConnectedWallets, accounts.length, forceWalletView, connectedWallets, selectedWalletName, selectedWalletPlatform, selectedAccount]);

    // Reset state when modal closes
    useEffect(() => {
      if (!isOpen) {
        // Don't reset selectedAccount - preserve across modal sessions
        setForceWalletView(false);
        // Reset wallet filter - will be recalculated on next open
        setSelectedWalletName(null);
        setSelectedWalletPlatform(null);
        isUserNavigating.current = false;
        // Reset view based on current connection state
        setTimeout(() => {
          setCurrentView(hasConnectedWallets && accounts.length > 0 ? "accounts" : "wallets");
        }, 100);
      }
    }, [isOpen, hasConnectedWallets, accounts.length]);

    const handleWalletConnect = async (wallet: any) => {
      try {
        await wallet.connect();
        toast.success(`${wallet.name} connected successfully!`);
        // Allow auto-transition to accounts after successful connection
        setForceWalletView(false);
        // Automatically set the selected wallet AND platform to show only its accounts
        setSelectedWalletName(wallet.name);
        setSelectedWalletPlatform(wallet.platform);
        
        // Clear previous account selection when connecting a different wallet/platform
        if (selectedAccount && (selectedAccount.walletName !== wallet.name || selectedAccount.platform !== wallet.platform)) {
          setSelectedAccount(null);
        }
      } catch (error) {
        toast.error(`Failed to connect ${wallet.name}: ${(error as Error).message}`);
      }
    };

    const handleWalletDisconnect = (wallet: any) => {
      wallet.disconnect();
      toast.success(`${wallet.name} disconnected`);
    };

    const handleBackToWallets = () => {
      isUserNavigating.current = true;
      setCurrentView("wallets");
      setForceWalletView(true);
      setSelectedWalletName(null);
      setTimeout(() => {
        isUserNavigating.current = false;
      }, 500);
    };

    const handleProceedToAccounts = () => {
      if (hasConnectedWallets && accounts.length > 0) {
        isUserNavigating.current = true;
        setCurrentView("accounts");
        setForceWalletView(false);
        // Don't clear wallet filter - let the user see what they selected
        // If they want to see all, they can click on individual wallets
        setTimeout(() => {
          isUserNavigating.current = false;
        }, 500);
      }
    };

    const handleViewWalletAccounts = (wallet: any) => {
      isUserNavigating.current = true;
      setCurrentView("accounts");
      setForceWalletView(false);
      setSelectedWalletName(wallet.name);
      setSelectedWalletPlatform(wallet.platform);
      
      // Clear selection if viewing a different wallet/platform's accounts
      if (selectedAccount && (selectedAccount.walletName !== wallet.name || selectedAccount.platform !== wallet.platform)) {
        setSelectedAccount(null);
      }
      
      setTimeout(() => {
        isUserNavigating.current = false;
      }, 500);
    };

    const handleAccountSelect = (account: any) => {
      setSelectedAccount(account);
      const name = account.platform === "polkadot" && 'name' in account ? account.name : "Account";
      toast.success(`Account ${name} selected!`);
      // Close modal after selection
      onOpenChange?.(false);
    };

    const walletAccounts = (wallet: any) => 
      accounts.filter(account => 
        account.walletName === wallet.name && 
        account.platform === wallet.platform
      );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange} >
          <DialogContent className="w-11/12 sm:w-full max-w-lg p-6 rounded-xl sm:rounded-xl bg-midnight border border-dark-slate-gray flex flex-col max-h-[85vh] sm:max-h-[80vh]" isCloseIconVisible={false}>
            <div className="flex items-center justify-center relative flex-shrink-0 mb-4" >
              {currentView === "accounts" && (
                <button 
                  onClick={handleBackToWallets}
                  className="absolute left-0 p-1 hover:bg-blue-whale rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
              )}
              <DialogTitle className="text-white text-2xl font-medium" >
                {currentView === "accounts" ? "Select Account" : "Connect Wallet"}
              </DialogTitle>
              <DialogClose className="absolute self-center right-0" >
                <X className="w-5 h-5 stroke-2 text-white" />
              </DialogClose>
            </div>

            {/* Wallet Connection View */}
            {currentView === "wallets" && (
              <div className="flex flex-col items-stretch gap-y-3 overflow-y-auto pr-2 custom-scrollbar" >
                {wallets?.map((wallet) => {
                  const accountCount = walletAccounts(wallet).length;
                  return (
                    <div 
                      key={wallet.id} 
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border border-dark-slate-gray transition-all",
                        wallet.isConnected 
                          ? 'bg-burning-orange/10 border-burning-orange/30 cursor-pointer hover:bg-burning-orange/15' 
                          : 'bg-black-wallet-fill hover:bg-blue-whale/30'
                      )}
                      onClick={wallet.isConnected && accountCount > 0 ? () => handleViewWalletAccounts(wallet) : undefined}
                    >
                      <Image src={wallet.icon} alt={`${wallet.name} icon`} width={48} height={48} className="rounded-full" />
                      <div className="ml-3 space-y-1 flex-1" >
                        <div className="flex items-center gap-2">
                          <p className="text-white text-base font-medium" >{wallet?.name}</p>
                          {wallet.isConnected && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-green-400 font-medium">Connected</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-white/60 text-xs font-light" >{wallet?.platform}</p>
                          {wallet.isConnected && accountCount > 0 && (
                            <>
                              <span className="text-xs text-white/40">•</span>
                              <span className="text-xs text-white/60">
                                {accountCount} account{accountCount !== 1 ? 's' : ''}
                              </span>
                            </>
                          )}
                        </div>
                        {wallet.isConnected && accountCount > 0 && (
                          <div className="text-xs text-burning-orange mt-1">
                            Click to view accounts →
                          </div>
                        )}
                      </div>
                      <button 
                        className={cn("ml-auto rounded-full px-3 py-2 text-sm bg-blue-whale hover:bg-blue-whale/70",
                          wallet?.isConnected ? "text-red-500" : "text-white"
                        )} 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if(wallet?.isConnected) {
                            handleWalletDisconnect(wallet);
                          } else {
                            await handleWalletConnect(wallet);
                          }
                        }}
                      >
                        {wallet?.isConnected ? "Disconnect" : "Connect"}
                      </button>
                    </div>
                  );
                })}

                {/* Continue Button (shows when wallets are connected) */}
                {hasConnectedWallets && accounts.length > 0 && (
                  <div className="border-t border-dark-slate-gray pt-4 mt-2">
                    <button
                      onClick={handleProceedToAccounts}
                      className="w-full py-3 px-4 rounded-xl bg-burning-orange hover:bg-burning-orange/90 text-white font-medium transition-all"
                    >
                      Continue to Account Selection
                    </button>
                    <div className="text-xs text-white/50 text-center mt-2">
                      {accounts.length} account{accounts.length !== 1 ? 's' : ''} available
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Account Selection View */}
            {currentView === "accounts" && (
              <div className="flex flex-col h-full">
                <div className="text-center mb-4">
                  <p className="text-white/60 text-sm">Choose an account to interact with the app</p>
                </div>

                <div className="flex flex-col gap-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {filteredAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      isSelected={selectedAccount?.id === account.id}
                      onSelect={() => handleAccountSelect(account)}
                    />
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
    )
}