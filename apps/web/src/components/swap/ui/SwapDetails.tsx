import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TokenInfo } from '../types';
import { FeeBreakdown } from '../hooks/types';
import { formatAmount } from '@/services/balances/utils';
import { NUMBER_FORMAT_OPTIONS } from '@/services/constants';
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
    <p className={cn("text-white/70 text-xs sm:text-sm font-normal",className)} >{children}</p>
  )
}

// Define DOT token information for fee display
const DOT_DECIMALS = 10;
const DOT_SYMBOL = 'DOT';

interface SwapDetailsProps {
  minimumReceived: string;
  outputToken: TokenInfo;
  inputToken: TokenInfo;
  maxTransactionFee: string;
  feeBreakdown?: FeeBreakdown;
  route: string;
  isLoading?: boolean;
  isProcessing?: boolean;
}

export const SwapDetails = memo(function SwapDetails({
  minimumReceived,
  outputToken,
  inputToken,
  maxTransactionFee,
  feeBreakdown,
  route,
  isLoading = false,
  isProcessing = false,
}: SwapDetailsProps) {
  // Format fees for display if available - memoized for performance
  const formattedFees = useMemo(() => {
    if (!feeBreakdown) return null;
    
    return (() => {
    // Check if it's the standard FeeBreakdown interface
    if (feeBreakdown && typeof feeBreakdown === 'object' && 'transactionFee' in feeBreakdown && 'xcmFee' in feeBreakdown && 'tradingFee' in feeBreakdown && 'totalFee' in feeBreakdown) {
      const standardFees = feeBreakdown as {
        transactionFee?: bigint;
        xcmFee?: bigint;
        tradingFee?: bigint;
        totalFee?: bigint;
      };
      return {
        transaction: standardFees.transactionFee !== undefined ? formatAmount(standardFees.transactionFee, inputToken.decimals, NUMBER_FORMAT_OPTIONS).decimal : '0',
        xcm: standardFees.xcmFee !== undefined ? formatAmount(standardFees.xcmFee, inputToken.decimals, NUMBER_FORMAT_OPTIONS).decimal : '0',
        trading: standardFees.tradingFee !== undefined ? formatAmount(standardFees.tradingFee, inputToken.decimals, NUMBER_FORMAT_OPTIONS).decimal : '0',
        total: standardFees.totalFee !== undefined ? formatAmount(standardFees.totalFee, inputToken.decimals, NUMBER_FORMAT_OPTIONS).decimal : '0'
      };
    }
    // Handle custom fee breakdown from enhanced simulation
    else if (feeBreakdown && typeof feeBreakdown === 'object' && 'total' in feeBreakdown) {
      const customFees = feeBreakdown as { total?: string };
      return {
        transaction: '0',
        xcm: '0',
        trading: '0',
        total: customFees.total || '0'
      };
    }
    // Fallback for unknown structure
    else {
      return {
        transaction: '0',
        xcm: '0',
        trading: '0',
        total: '0'
      };
    }
    })();
  }, [feeBreakdown, inputToken.decimals]);

  // Format max transaction fee always using DOT decimals - ensure it's never undefined
  const formattedMaxFee = useMemo(() => {
    if (!maxTransactionFee || maxTransactionFee === '0') return '';
    return formatAmount(BigInt(maxTransactionFee), DOT_DECIMALS, NUMBER_FORMAT_OPTIONS).decimal;
  }, [maxTransactionFee]);

  // Helper function to display values with proper empty states
  const displayValue = (value: string, symbol: string, placeholder = '—') => {
    if (isLoading) return '...';
    if (!value || value === '' || value === 'NaN') return placeholder;
    return `${value} ${symbol}`;
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
          {
            isProcessing ? <Skeleton className="w-20 h-5" /> : displayValue(minimumReceived, outputToken.symbol)
          }
        </SubText>
        <SubText>Max Transaction Fee</SubText>
        <SubText className="justify-self-end" >
          {
            isProcessing ? <Skeleton className="w-16 h-5" /> : displayValue(formattedMaxFee, DOT_SYMBOL)
          }
        </SubText>
        <SubText>Route</SubText>
        <SubText className="justify-self-end" >
          {
            isProcessing ? <Skeleton className="w-16 h-5" /> : displayValue(route, '', '—')
          }
        </SubText>
      </div>
    </motion.div>
  );
}); 


{/* TODO: figure out path for asset hub and hydra dx, also is this necessary? 
    <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
              <span>Show more details</span>
              <Search className="w-4 h-4" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 pt-3 border-t border-slate-700/50">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Routing Path</span>
                </div>
                <div className="">
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {`${inputToken.symbol} → ${outputToken.symbol}`}
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible> */}