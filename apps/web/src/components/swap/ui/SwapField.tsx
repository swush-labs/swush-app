import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TokenButton } from '../TokenButton';
import { AssetList } from './AssetList';
import { SwapFieldProps } from '../types';
import { formatBalance } from '../utils';
import { Loader2, ChevronDown, Wallet } from 'lucide-react';

export const SwapField = memo(function SwapField({
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
  error
}: SwapFieldProps) {
  const isInput = type === 'input';
  const bgColor = isInput ? 'bg-pink-500' : 'bg-blue-500';
  const displayBalance = formatBalance(balance, balancesLoaded);

  // Handle input change with validation
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow valid number inputs
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onAmountChange?.(value);
    }
  }, [onAmountChange]);

  return (
    <motion.div 
      className="group relative p-6 rounded-2xl bg-forest-800/95 backdrop-blur-md border border-forest-600/60 shadow-xl hover:border-flame-400/50 hover:shadow-flame-500/20 transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: isInput ? 0 : 0.1 }}
    >
      {/* Subtle hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-flame-500/0 to-flame-400/0 group-hover:from-flame-500/5 group-hover:to-flame-400/5 rounded-2xl transition-all duration-300 pointer-events-none"></div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4">
          {/* Balance display - only show when connected */}
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-forest-400" />
            <span className="text-sm font-medium text-forest-200">
              {isConnected ? `${displayBalance} ${token?.symbol || ''}` : ''}
            </span>
          </div>
          
          {/* Percentage options for input (Pay) field - on the right side */}
          <div className="flex gap-2">
            {isInput && percentageOptions && percentageOptions.map(({ label, value }) => (
              <Button
                key={label}
                variant="default"
                size="sm"
                onClick={() => onPercentageSelect?.(value)}
                className="text-xs font-medium bg-forest-700/50 border-forest-600 text-forest-300 hover:bg-forest-600 hover:text-white transition-all duration-200"
                disabled={isLoading || !balance || parseFloat(balance) <= 0}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

      <div className="flex items-center gap-4">
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <div className="flex-shrink-0">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-forest-800 hover:bg-forest-700 border-forest-600 hover:border-flame-400 transition-all duration-200 cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-flame-400 to-flame-500 flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg font-bold">{token.icon}</span>
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-white">{token.symbol}</span>
                  <span className="text-sm text-forest-400">{token.name}</span>
                </div>
                <ChevronDown className="w-5 h-5 text-forest-400" />
              </div>
            </div>
          </DialogTrigger>
          <DialogContent className="bg-forest-900 border-forest-800">
            <DialogHeader>
              <DialogTitle className="text-white">Select a token</DialogTitle>
            </DialogHeader>
            <AssetList 
              assets={availableTokens} 
              onSelect={onTokenSelect}
              currentAsset={token}
              onClose={() => setOpenDialog(false)}
            />
          </DialogContent>
        </Dialog>
        <div className="flex-1 relative">
          <Input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={handleInputChange}
            readOnly={!isInput}
            className="border-0 bg-transparent text-3xl text-white focus-visible:ring-0 focus-visible:ring-offset-0 text-right appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            placeholder="0"
          />
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
});