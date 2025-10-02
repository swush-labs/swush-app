import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { TokenInfo } from '../types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
}

export const SwapDetails = memo(function SwapDetails({
  minimumReceived,
  outputToken,
  maxTransactionFee,
  route,
  isLoadingQuote = false,
  isLoadingFees = false,
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
        <SubText className="justify-self-end" >
          {isLoadingQuote ? (
            <Skeleton className="w-20 h-5 animate-pulse" />
          ) : (
            displayValue(minimumReceived, outputToken?.symbol || '')
          )}
        </SubText>
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

