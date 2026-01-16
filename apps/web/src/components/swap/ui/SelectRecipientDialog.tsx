import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowRight, CircleAlert, X, Check, RefreshCw, Bookmark } from "lucide-react";
import { useSelectedAccount } from "@/components/wallet/use-selected-account";
import { useRecipientAccount } from "@/components/wallet/use-recipient-account";
import { shortenAddress } from "@/lib/utils";
import Identicon from "@/components/ui/identicon";
import { useState } from "react";

interface KheopskitAccount {
  id: string;
  address: string;
  name?: string;
  platform: "polkadot" | "ethereum" | "solana";
  walletName: string;
  polkadotSigner?: any;
  client?: any;
}

interface SelectRecipientDialogProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectDifferentWallet?: () => void;
  selectedRecipient: KheopskitAccount | null;
  customAddress: string;
  onCustomAddressSubmit?: (address: string) => void;
  onResetToSender?: () => void;
}

export default function SelectRecipientDialog({
  isOpen,
  onOpenChange,
  onSelectDifferentWallet,
  selectedRecipient,
  customAddress,
  onCustomAddressSubmit,
  onResetToSender
}: SelectRecipientDialogProps) {
  const { selectedAccount: senderAccount } = useSelectedAccount();
  const { hasSavedRecipient } = useRecipientAccount();
  const [customAddressInput, setCustomAddressInput] = useState('');
  const [addressError, setAddressError] = useState('');

  // Determine what to display
  const displayAccount = customAddress 
    ? null // Show custom address UI
    : selectedRecipient || senderAccount; // Show selected recipient or default to sender

  const isDifferentFromSender = selectedRecipient && 
    senderAccount && 
    selectedRecipient.address !== senderAccount.address;

  const handleCustomAddressSubmit = () => {
    const trimmedAddress = customAddressInput.trim();
    
    if (!trimmedAddress) {
      setAddressError('Please enter an address');
      return;
    }

    // Basic validation (you can enhance this)
    if (trimmedAddress.length < 32) {
      setAddressError('Invalid address format');
      return;
    }

    onCustomAddressSubmit?.(trimmedAddress);
    setAddressError('');
    setCustomAddressInput('');
    onOpenChange?.(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-11/12 sm:w-full max-w-lg p-6 rounded-xl sm:rounded-xl bg-midnight border border-dark-slate-gray" isCloseIconVisible={false}>
        
        {/* Header */}
        <div className="flex items-center justify-center relative">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-white text-2xl font-medium">Send To</DialogTitle>
            {hasSavedRecipient && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-tealish-green/20 border border-tealish-green/40">
                <Bookmark className="w-3 h-3 text-tealish-green fill-tealish-green" />
                <span className="text-xs text-tealish-green font-medium">Saved</span>
              </div>
            )}
          </div>
          <DialogClose className="absolute self-center right-0">
            <X className="w-5 h-5 stroke-2 text-white" />
          </DialogClose>
        </div>

        <div className="bg-blackPearl border-dark-slate-gray rounded-2xl flex flex-col items-stretch p-6 overflow-hidden relative mt-4">
          
          {/* Section 1: Wallet Selection */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-sm font-normal">
              {customAddress 
                ? "Custom address selected"
                : isDifferentFromSender 
                  ? "Selected destination" 
                  : "Your connected wallet"}
            </p>
            {(isDifferentFromSender || customAddress) && (
              <button
                onClick={onResetToSender}
                className="text-xs text-burning-orange/70 hover:text-burning-orange flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Reset to sender
              </button>
            )}
          </div>
          
          {displayAccount ? (
            <div className="space-y-2">
              {/* Display account */}
              <div className="p-4 rounded-xl bg-black-wallet-fill border border-burning-orange/30 flex items-center gap-3">
                <Identicon
                  value={displayAccount.address}
                  size={40}
                  theme="polkadot"
                  className="rounded-full"
                />
                <div className="flex-1">
                  <div className="text-white font-medium">
                    {displayAccount.platform === "polkadot" && 'name' in displayAccount 
                      ? displayAccount.name 
                      : "Account"}
                  </div>
                  <div className="text-white/60 text-sm font-mono">
                    {shortenAddress(displayAccount.address)}
                  </div>
                  <div className="text-xs text-white/50">
                    {displayAccount.walletName}
                  </div>
                </div>
                <Check className="w-5 h-5 text-burning-orange" />
              </div>
              
              {/* Button to select different wallet */}
              <Button 
                variant="outline" 
                className="w-full text-sm border-burning-orange/30 hover:border-burning-orange/50 text-burning-orange/90 hover:text-burning-orange bg-transparent hover:bg-burning-orange/10 transition-all"
                onClick={onSelectDifferentWallet}
              >
                Connect Different Wallet
              </Button>
            </div>
          ) : customAddress ? (
            <div className="space-y-2">
              {/* Display custom address */}
              <div className="p-4 rounded-xl bg-black-wallet-fill border border-burning-orange/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-burning-orange/20 flex items-center justify-center">
                  <span className="text-burning-orange text-lg">📝</span>
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">Custom Address</div>
                  <div className="text-white/60 text-sm font-mono">
                    {shortenAddress(customAddress)}
                  </div>
                </div>
                <Check className="w-5 h-5 text-burning-orange" />
              </div>
              
              <Button 
                variant="outline" 
                className="w-full text-sm border-burning-orange/30 hover:border-burning-orange/50 text-burning-orange/90 hover:text-burning-orange bg-transparent hover:bg-burning-orange/10 transition-all"
                onClick={onSelectDifferentWallet}
              >
                Connect Different Wallet
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-white/60 text-sm text-center">No wallet connected</p>
              <Button 
                variant="primary" 
                className="text-base w-full"
                onClick={onSelectDifferentWallet}
              >
                Choose from Connected Wallets
              </Button>
            </div>
          )}

          {/* Divider */}
          <div className="my-8 relative flex justify-center">
            <div className="flex items-center absolute w-[120%] self-center">
              <div className="bg-dark-slate-gray h-px w-full"></div>
              <p className="uppercase text-base font-normal text-white/70 mx-1">OR</p>
              <div className="bg-dark-slate-gray h-px w-full"></div>
            </div>
          </div>

          {/* Section 2: Custom Address */}
          <p className="text-white text-sm font-normal">Enter destination address</p>
          <div className="flex items-center gap-x-2">
            <Input 
              className="border-black-eel bg-transparent rounded-2xl text-white/60 placeholder:text-white/30 placeholder:text-sm placeholder:font-normal h-12 mt-1" 
              placeholder="Paste destination address"
              type="text"
              value={customAddressInput}
              onChange={(e) => {
                setCustomAddressInput(e.target.value);
                setAddressError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCustomAddressSubmit();
                }
              }}
            />
            <button 
              className="rounded-full bg-blue-whale hover:bg-blue-whale/70 w-20 h-12 flex items-center justify-center disabled:opacity-50"
              onClick={handleCustomAddressSubmit}
              disabled={!customAddressInput.trim()}
            >
              <ArrowRight className="w-6 h-6 text-white" />
            </button>
          </div>
          
          {/* Error or Warning */}
          <div className="flex items-center text-white/80 gap-px mt-1">
            <CircleAlert className={`w-3 h-3 ${addressError ? 'text-red-400' : ''}`} />
            <p className={`text-xs font-light ${addressError ? 'text-red-400' : ''}`}>
              {addressError || 'Double check the address to avoid losing funds'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
