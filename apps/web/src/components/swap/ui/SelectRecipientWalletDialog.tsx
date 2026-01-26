import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn, shortenAddress } from "@/lib/utils";
import { X, Check } from "lucide-react";
import { useWallets } from "@kheopskit/react";
import { useSelectedAccount } from "@/components/wallet/use-selected-account";
import Identicon from "@/components/ui/identicon";
import { useState } from "react";
import { toast } from 'react-hot-toast';

interface SelectRecipientWalletDialogProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAccountSelect?: (account: any) => void;
  currentRecipient?: any; // Currently selected recipient to highlight
}

/**
 * Dedicated dialog for selecting recipient wallet/account
 * - Shows all connected accounts (read-only)
 * - Doesn't manage wallet connections (use ConnectWalletDialog for that)
 * - Doesn't interfere with sender account state
 * - Simple, focused component
 */
export default function SelectRecipientWalletDialog({
  isOpen = false,
  onOpenChange,
  onAccountSelect,
  currentRecipient
}: SelectRecipientWalletDialogProps) {
  const { accounts } = useWallets();
  const { selectedAccount: senderAccount } = useSelectedAccount();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    currentRecipient?.id || null
  );

  const handleAccountSelect = (account: any) => {
    setSelectedAccountId(account.id);
    onAccountSelect?.(account);
    const name = account.platform === "polkadot" && 'name' in account ? account.name : "Account";
    toast.success(`Destination ${name} selected!`);
    onOpenChange?.(false);
  };

  // Check if an account is the sender
  const isSenderAccount = (account: any) => {
    return senderAccount?.id === account.id;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-11/12 sm:w-full max-w-lg p-6 rounded-xl sm:rounded-xl bg-midnight border border-dark-slate-gray flex flex-col max-h-[85vh] sm:max-h-[80vh]" 
        isCloseIconVisible={false}
      >
        {/* Header */}
        <div className="flex items-center justify-center relative flex-shrink-0 mb-4">
          <DialogTitle className="text-white text-2xl font-medium">
            Choose Destination Account
          </DialogTitle>
          <DialogClose className="absolute self-center right-0">
            <X className="w-5 h-5 stroke-2 text-white" />
          </DialogClose>
        </div>

        {/* Info Text */}
        <div className="text-center mb-4">
          <p className="text-white/60 text-sm">
            Select which account should receive the tokens
          </p>
        </div>

        {/* Account List */}
        <div className="flex flex-col gap-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/60 text-sm mb-4">No wallets connected</p>
              <p className="text-white/40 text-xs">
                Please connect a wallet first using the &quot;Connect Wallet&quot; button
              </p>
            </div>
          ) : (
            accounts.map((account) => {
              const isSelected = selectedAccountId === account.id;
              const isSender = isSenderAccount(account);
              
              return (
                <div
                  key={account.id}
                  className={cn(
                    "p-4 rounded-xl cursor-pointer transition-all",
                    isSelected
                      ? 'bg-tealish-green/10 border-2 border-tealish-green'
                      : isSender
                      ? 'bg-blue-whale/20 border border-blue-whale/40'
                      : 'bg-black-wallet-fill border border-dark-slate-gray hover:border-prussian-blue'
                  )}
                  onClick={() => handleAccountSelect(account)}
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
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-white text-base">
                          {account.platform === "polkadot" && 'name' in account 
                            ? account.name 
                            : "Account"}
                        </div>
                        {isSender && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-whale/30 text-blue-400 border border-blue-400/30">
                            Source
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-white/60 font-mono">
                        {shortenAddress(account.address)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs text-white/50 capitalize">
                          {account.platform}
                        </div>
                        <span className="text-xs text-white/40">•</span>
                        <div className="text-xs text-white/50">
                          {account.walletName}
                        </div>
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
            })
          )}
        </div>

        {/* Footer Note */}
        {accounts.length > 0 && (
          <div className="text-center mt-4 pt-4 border-t border-dark-slate-gray">
            <p className="text-xs text-white/40">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} available
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

