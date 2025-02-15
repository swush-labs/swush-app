import { motion } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TokenButton } from '../TokenButton';
import { AssetList } from '../AssetList';
import { TokenInfo } from '../types';

interface SwapFieldProps {
  type: 'input' | 'output';
  token: TokenInfo;
  amount: string;
  balance: string;
  onTokenSelect: (token: TokenInfo) => void;
  onAmountChange?: (value: string) => void;
  openDialog: boolean;
  setOpenDialog: (open: boolean) => void;
  availableTokens: any[];
  percentageOptions?: Array<{ label: string; value: number; }>;
  onPercentageSelect?: (value: number) => void;
}

export const SwapField = ({
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
  onPercentageSelect
}: SwapFieldProps) => {
  const isInput = type === 'input';
  const bgColor = isInput ? 'bg-pink-500' : 'bg-blue-500';

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
          <span className="text-sm font-medium text-slate-300">{balance} {token.name}</span>
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
                icon={
                  <div className={`w-full h-full ${bgColor} rounded-full flex items-center justify-center`}>
                    <span className="text-white text-lg font-bold">{token.icon}</span>
                  </div>
                }
                price={token.price}
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
        <div className="flex-1">
          <Input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange?.(e.target.value)}
            readOnly={!isInput}
            className="border-0 bg-transparent text-2xl text-white focus-visible:ring-0 focus-visible:ring-offset-0 text-right appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            placeholder="0"
          />
        </div>
      </div>
    </motion.div>
  );
}; 