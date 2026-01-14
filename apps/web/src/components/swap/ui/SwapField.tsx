import React, { ButtonHTMLAttributes, ReactNode, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TokenButton } from '../button/TokenButton';
import { AssetList } from './AssetList';
import { SwapFieldProps, AssetGroup } from '../types';
import { Loader2, ChevronDown, Wallet, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, shortenAddress } from '@/lib/utils';
import { useSelectedAccount } from '@/components/wallet/use-selected-account';

const WalletButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => {
  return (
    <button
      className={cn("rounded-full py-1 px-3 flex items-center text-burning-orange bg-blue-whale hover:bg-blue-whale/70", className)}
      {...props}
    >
      <Wallet className="w-3 h-3" />
      <p className="text-xs font-normal ml-1" >{children}</p>
      <ChevronRight className="w-3 h-3 ml-5" />
    </button>
  )
}

export function SwapField({
  type,
  token,
  amount,
  balance,
  onTokenSelect,
  onAmountChange,
  openDialog,
  setOpenDialog,
  availableTokens,
  percentageOptions,
  onPercentageSelect,
  isLoading,
  balancesLoaded = true,
  isConnected = false,
  isProcessing = false,
  error,
  onConnectWalletClick,
  onSelectRecipientClick,
  recipientAddress,
  isCustomRecipient = false,
  formatUSD,
}: SwapFieldProps) {
  const isInput = type === 'input';

  // Get selected account for display
  const { selectedAccount } = useSelectedAccount();

  // Handle input change with validation
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Only allow valid number inputs
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onAmountChange?.(value);
    }
  }, [onAmountChange]);

  // Group available tokens by symbol to create cascading UI (symbol -> networks)
  const assetGroups = useMemo<AssetGroup[]>(() => {
    const map = new Map<string, AssetGroup>();
    availableTokens.forEach((t) => {
      const existing = map.get(t.symbol);
      // Preserve the actual network information instead of using token name
      const tokenWithNetwork = { ...t, network: t.network };
      if (existing) {
        existing.tokens.push(tokenWithNetwork);
      } else {
        map.set(t.symbol, {
          symbol: t.symbol,
          name: t.name,
          icon: t.icon,
          network: t.network || 'Unknown',
          tokens: [tokenWithNetwork]
        });
      }
    });
    return Array.from(map.values());
  }, [availableTokens]);

  return (
    <motion.div
      className={`group relative p-4 sm:p-6 rounded-2xl bg-blackPearl border-dark-slate-gray border backdrop-blur-md shadow-lg shadow-black/25`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: isInput ? 0 : 0.1 }}
    >
      {/* Subtle hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-flame-500/0 to-flame-400/0 group-hover:from-flame-500/8 group-hover:to-flame-400/8 rounded-2xl transition-all duration-300 pointer-events-none"></div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4 tall:mb-9">
          {/* Balance display */}
          <div className="flex items-center gap-2">
            {isConnected && token && balance && parseFloat(balance) > 0 ? (
              <>
                <Wallet className="w-4 h-4 text-white/60" />
                <span className="text-sm font-medium text-forest-300">
                  {balance} {token.symbol}
                </span>
              </>
            ) : null}
          </div>

          {/* Percentage options for input (Pay) field - on the right side */}
          {/*      <div className="flex gap-2">
              {percentageOptions && percentageOptions?.map(({ label, value }) => (
                <Button
                  key={label}
                  variant="default"
                  size="xss"
                  onClick={() => onPercentageSelect?.(value)}
                  className="text-[10px] font-medium bg-bluishCyan border-forest-600 text-white/50 hover:bg-creole hover:text-white transition-all duration-200"
                  disabled={isLoading || !balance || parseFloat(balance) <= 0}
                >
                  {label}
                </Button>
              ))}
            </div>
          */}

          {/* Wallet connection status / Send to button */}
          {isInput ? (
            isConnected && selectedAccount ? (
              // Show connected status with shortened address - clickable to change account
              <button
                onClick={onConnectWalletClick}
                className="rounded-full py-1 px-3 flex items-center text-white bg-blue-whale/50 border border-burning-orange/30 hover:bg-blue-whale/70 hover:border-burning-orange/50 transition-all cursor-pointer"
              >
                <Check className="w-3 h-3 text-burning-orange" />
                <p className="text-xs font-normal ml-1">{shortenAddress(selectedAccount.address)}</p>
              </button>
            ) : (
              // Show connect wallet button
              <WalletButton onClick={onConnectWalletClick}>Connect Wallet</WalletButton>
            )
          ) : (
            // Output field - show recipient or send to button
            recipientAddress ? (
              <button
                onClick={onSelectRecipientClick}
                className={cn(
                  "rounded-full py-1 px-3 flex items-center text-white transition-all cursor-pointer",
                  "bg-blue-whale/50 border border-burning-orange/30 hover:bg-blue-whale/70 hover:border-burning-orange/50"
                )}
              >
                <Check className="w-3 h-3 text-burning-orange" />
                <p className="text-xs font-normal ml-1">{shortenAddress(recipientAddress)}</p>
              </button>
            ) : (
              <WalletButton onClick={onSelectRecipientClick}>Send to</WalletButton>
            )
          )}
        </div>

        <div className="flex items-center">
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <div className="flex-shrink-0">
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-blue-whale border-forest-600 hover:border-flame-400 transition-all duration-200 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-flame-400 to-flame-500 flex items-center justify-center shadow-lg">
                    <span className="text-white text-lg font-bold">{token?.icon || '?'}</span>
                  </div>
                  <div className="flex flex-col items-start w-[60px] md:w-[80px]">
                    <span className="font-semibold text-white truncate w-full">{token?.symbol || 'Select Token'}</span>
                    <span className="text-sm text-forest-400 truncate w-full" title={token?.network}>{token?.network || 'Network'}</span>
                  </div>
                  <ChevronDown className="w-5 h-5 text-forest-400 flex-shrink-0" />
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="bg-blackPearl border-dark-slate-gray rounded-xl w-full max-w-[90%] sm:max-w-lg">
              <DialogHeader className="relative" >

                <div className="w-full flex items-center justify-center" >
                  <DialogTitle className="text-white text-lg font-medium">All Networks</DialogTitle>
                </div>
                {/* <div className="absolute w-full h-full" >
              <ChevronLeft className="size-5 text-white" />
              </div> */}

              </DialogHeader>
              <AssetList
                assetGroups={assetGroups}
                onSelect={onTokenSelect}
                currentAsset={token}
                onClose={() => setOpenDialog(false)}
              />
            </DialogContent>
          </Dialog>
          <div className="flex-1 relative">
            {!isInput && isProcessing ? (
              <Skeleton className="w-full max-w-24 sm:max-w-52 h-11 ml-auto" />
            ) : (
              <div className="flex flex-col items-end">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={handleInputChange}
                  readOnly={!isInput}
                  className="border-0 bg-transparent px-0 text-2xl md:text-3xl text-white focus-visible:ring-0 focus-visible:ring-offset-0 text-right appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="0"
                />
                {/* USD Value Display */}
                {token && amount && formatUSD && parseFloat(amount) > 0 && (
                  <div className="text-sm text-forest-400 mt-1">
                    ≈ {formatUSD(amount, token.symbol, token.decimals)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-2 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </motion.div>
  );
}