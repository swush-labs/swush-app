import { motion } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TokenButton } from '../TokenButton';
import { AssetList } from './AssetList';
import { SwapFieldProps } from '../types';
import { Loader2 } from 'lucide-react';

// Helper function to format balance display
function formatBalance(balance: string | undefined, isLoading: boolean | undefined): string {
  if (isLoading === true) return '...';
  if (!balance || balance === '0') return '0';
  
  const numBalance = parseFloat(balance);
  if (numBalance < 0.0001 && numBalance > 0) return '< 0.0001';
  
  // For numbers less than 1, show more decimals
  if (numBalance < 1) {
    return numBalance.toFixed(4);
  }
  
  // For larger numbers, show fewer decimals
  if (numBalance > 1000000) {
    return `${(numBalance / 1000000).toFixed(2)}M`;
  }
  if (numBalance > 1000) {
    return `${(numBalance / 1000).toFixed(2)}K`;
  }
  
  return numBalance.toFixed(2);
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
  error
}: SwapFieldProps) {
  const isInput = type === 'input';
  const bgColor = isInput ? 'bg-pink-500' : 'bg-blue-500';
  const displayBalance = formatBalance(balance, isLoading);

  // Handle input change with validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow valid number inputs
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onAmountChange?.(value);
    }
  };

  return (
    <motion.div 
      className="p-6 rounded-2xl bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: isInput ? 0 : 0.1 }}
    >
      <div className="flex justify-between items-center mb-4">
        <span className="font-semibold text-slate-300">{isInput ? 'Pay' : 'Receive'}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Balance: </span>
          <div className="flex items-center gap-1">
            {isLoading && <Loader2 className="h-3 w-3 text-slate-400 animate-spin" />}
            <span className="text-sm font-medium text-slate-300">{displayBalance} {token?.symbol || ''}</span>
          </div>
        </div>
      </div>
      
      {isInput && percentageOptions && (
        <div className="flex gap-2 mb-4">
          {percentageOptions.map(({ label, value }) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              onClick={() => onPercentageSelect?.(value)}
              className="text-xs font-medium bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white transition-all duration-200"
              disabled={isLoading || !balance || parseFloat(balance) <= 0}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <div className="flex-shrink-0">
              <TokenButton
                token={token.name}
                symbol={token.symbol}
                icon={
                  <div className={`w-full h-full ${bgColor} rounded-full flex items-center justify-center`}>
                    <span className="text-white text-lg font-bold">{token.icon}</span>
                  </div>
                }
                onClick={() => {}}
              />
            </div>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
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
            className="border-0 bg-transparent text-2xl text-white focus-visible:ring-0 focus-visible:ring-offset-0 text-right appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            placeholder="0"
          />
          {/* TODO: loading not required for input field 
          {!isInput && isLoading && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
            </div>
          )}
          */}
        </div>
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-red-400">
          {error}
        </div>
      )}
    </motion.div>
  );
} 