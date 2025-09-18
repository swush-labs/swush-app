import { motion } from 'framer-motion';
import { WalletButton } from '../button/WalletButton';
import { Loader2 } from 'lucide-react';

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
    <div className="">
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
            className="w-full h-[60px] text-xl font-semibold bg-burningOrange hover:bg-burningOrange/80 text-white rounded-full transition-all duration-300"
            onWalletModalClose={() => {
              // Reset swapping state if wallet modal is closed without connecting
              if (isSwapping) {
                // This is passed as a prop to the SwapAction component, we can't directly set it
                // But if we access the parent component, it should have already reset this state
              }
            }}
          />
        ) : (
          <motion.button
            className={`
              relative w-full h-14 text-lg font-semibold rounded-2xl transition-all duration-300 overflow-hidden backdrop-blur-sm
              ${insufficientBalance 
                ? 'bg-gradient-to-r from-red-500/80 to-red-600/80 text-white border border-red-400/30 shadow-red-500/20' 
                : disabled
                ? 'bg-forest-700/50 text-forest-400 border border-forest-600/30'
                : 'bg-gradient-to-r from-flame-500 to-flame-400 hover:from-flame-400 hover:to-flame-300 text-white border border-flame-400/30 shadow-lg shadow-flame-500/25 hover:shadow-flame-400/40'
              }
            `}
            onClick={onSwap}
            disabled={disabled}
            whileHover={!disabled ? { 
              scale: 1.02,
              boxShadow: "0 10px 30px rgba(255, 107, 53, 0.3)"
            } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
          >
            {/* Animated flame-like background effect */}
            {!disabled && !insufficientBalance && (
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-flame-300/20 via-flame-200/10 to-transparent"
                animate={{ 
                  x: ['-100%', '100%']
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              />
            )}
            
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isSwapping && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-5 h-5" />
                </motion.div>
              )}
              {insufficientBalance ? 'Insufficient Balance' : isSwapping ? 'Swapping...' : 'Swap'}
            </span>
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}; 