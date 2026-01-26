import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { TokenInfo } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { SwapProvider } from '@/services/xcm-router/assetRegistry';

interface SubTextProps {
  className?: string
  children?: React.ReactNode | React.ReactNode[]
}
const SubText:React.FC<SubTextProps> = ({
  children,
  className,
}) => {
  return (
    <span className={cn("text-white/70 text-xs sm:text-sm font-normal",className)} >{children}</span>
  )
}

interface SwapDetailsProps {
  minimumReceived: string;
  outputToken?: TokenInfo | null;
  inputToken?: TokenInfo | null;
  maxTransactionFee: string; // Now just a formatted string (e.g., "0.001 DOT + 0.0005 USDC")
  feeBreakdown?: unknown; // Keeping for backward compatibility but not used
  route: string;
  isLoading?: boolean;
  isProcessing?: boolean;
  isLoadingQuote?: boolean; // Separate loading state for quote
  isLoadingFees?: boolean; // Separate loading state for fees
  estimatedDuration?: string; // Chainflip estimated swap duration
  provider?: SwapProvider; // Current swap provider (xcm or chainflip)
  formatUSD?: (amount: string, symbol: string, decimals: number) => string; // Function to format USD value
}

export const SwapDetails = memo(function SwapDetails({
  minimumReceived,
  outputToken,
  maxTransactionFee,
  route,
  isLoadingQuote = false,
  isLoadingFees = false,
  estimatedDuration,
  provider,
  formatUSD,
}: SwapDetailsProps) {
  // Helper function to display values with proper empty states
  const displayValue = (value: string, suffix = '', placeholder = '—') => {
    if (!value || value === '' || value === '0' || value === 'NaN') return placeholder;
    return suffix ? `${value} ${suffix}` : value;
  };

  return (
    <motion.div
      className="px-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="grid grid-cols-2 gap-y-3 sm:gap-y-3" >
        <SubText>Minimum Received</SubText>
        <div className="justify-self-end text-right">
          {isLoadingQuote ? (
            <Skeleton className="w-20 h-5 animate-pulse" />
          ) : (
            <>
              <SubText>
                {displayValue(minimumReceived, outputToken?.symbol || '')}
              </SubText>
              {outputToken && minimumReceived && formatUSD && 
               minimumReceived !== '—' && 
               minimumReceived !== '0' && 
               minimumReceived !== 'NaN' && 
               parseFloat(minimumReceived) > 0 && (
                <div className="text-xs text-forest-400 mt-0.5">
                  ≈ {formatUSD(minimumReceived, outputToken.symbol, outputToken.decimals)}
                </div>
              )}
            </>
          )}
        </div>
        <SubText>Transaction Fee</SubText>
        <div className="justify-self-end" >
          {isLoadingFees ? (
            <Skeleton className="w-24 h-5 animate-pulse" />
          ) : (
            <div className="text-right">
              {maxTransactionFee && maxTransactionFee !== '—' && maxTransactionFee !== '0' && maxTransactionFee !== 'NaN' ? (
                maxTransactionFee.split(' + ').map((fee, index) => (
                  <div key={index} className="text-white/70 text-xs sm:text-sm font-normal">
                     {fee.trim()}
                  </div>
                ))
              ) : (
                <SubText>—</SubText>
              )}
            </div>
          )}
        </div>
        {/* Show estimated duration for Chainflip swaps */}
        {provider === 'chainflip' && estimatedDuration && (
          <>
            <SubText>Est. Duration</SubText>
            <SubText className="justify-self-end">
              {isLoadingQuote ? (
                <Skeleton className="w-16 h-5 animate-pulse" />
              ) : (
                estimatedDuration
              )}
            </SubText>
          </>
        )}
        <SubText>Route</SubText>
        <SubText className="justify-self-end" >
          {isLoadingQuote ? (
            <Skeleton className="w-16 h-5 animate-pulse" />
          ) : (
            displayValue(route)
          )}
        </SubText>
      </div>
    </motion.div>
  );
}); 

