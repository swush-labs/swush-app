import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { WalletButton } from '../WalletButton';

interface SubmitButtonProps {
  isConnected: boolean;
  setIsConnected: (value: boolean) => void;
  setWalletAddress: (value: string) => void;
  onSwap: () => void;
  isSwapping: boolean;
  insufficientBalance: boolean;
  disabled: boolean;
}

export const SubmitButtonAction = ({
  isConnected,
  setIsConnected,
  setWalletAddress,
  onSwap,
  isSwapping,
  insufficientBalance,
  disabled
}: SubmitButtonProps) => {
  return (
    <div className="pt-7">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        {!isConnected ? (
          <WalletButton
            isConnected={isConnected}
            setIsConnected={setIsConnected}
            setWalletAddress={setWalletAddress}
            className="w-full h-14 text-lg font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          />
        ) : (
          <Button
            className="w-full h-14 text-lg font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-rose-500/25"
            onClick={onSwap}
            disabled={disabled}
          >
            {insufficientBalance ? 'Insufficient Balance' : isSwapping ? 'Swapping...' : 'Swap'}
          </Button>
        )}
      </motion.div>
    </div>
  );
}; 