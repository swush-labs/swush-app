import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { AnimatedGlowBorder } from './AnimatedGlowBorder';

interface SubmitButtonProps {
  isConnected: boolean;
  onSwap: () => void;
  isSwapping: boolean;
  insufficientBalance: boolean;
  disabled: boolean;
  isLoadingQuote?: boolean;
}

export const SubmitButtonAction = ({
  isConnected,
  onSwap,
  isSwapping,
  insufficientBalance,
  disabled,
  isLoadingQuote = false
}: SubmitButtonProps) => {
  return (
    <div className="">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <AnimatedGlowBorder isActive={isLoadingQuote}>
          <motion.button
            className={`
              relative w-full h-14 text-lg font-semibold rounded-full transition-all duration-300 overflow-hidden backdrop-blur-sm
              ${insufficientBalance 
                ? 'bg-gradient-to-r from-red-500/80 to-red-600/80 text-white border border-red-400/30 shadow-red-500/20' 
                : isLoadingQuote
                ? 'bg-blackPearl/90 text-forest-200 border border-flame-400/30'
                : disabled || !isConnected
                ? 'bg-forest-700/50 text-forest-400 border border-forest-600/30'
                : 'bg-burning-orange hover:from-flame-400 hover:to-flame-300 text-white border border-flame-400/30'
              }
            `}
            onClick={onSwap}
            disabled={disabled || isLoadingQuote || !isConnected}
          >
            {/* Animated flame-like background effect - only for enabled state */}
            {!disabled && !insufficientBalance && !isLoadingQuote && isConnected && (
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

            {/* Shimmer effect when loading quote */}
            {isLoadingQuote && (
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-flame-400/15 to-transparent"
                animate={{ 
                  x: ['-200%', '200%']
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  repeatDelay: 0.3
                }}
              />
            )}
            
            <span className="relative z-10 flex items-center justify-center gap-2">
              {(isSwapping || isLoadingQuote) && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-5 h-5" />
                </motion.div>
              )}
              {insufficientBalance 
                ? 'Insufficient Balance' 
                : isLoadingQuote 
                ? 'Finding the best price' 
                : isSwapping 
                ? 'Swapping...' 
                : 'Swap'}
            </span>
          </motion.button>
        </AnimatedGlowBorder>
      </motion.div>
    </div>
  );
}; 