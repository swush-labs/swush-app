import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TokenInfo } from '../types';
import { FeeBreakdown } from '../hooks/types';
import { formatAmount } from '@/services/balances/utils';
import { NUMBER_FORMAT_OPTIONS } from '@/services/constants';

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
}

export const SwapDetails = memo(function SwapDetails({
  minimumReceived,
  outputToken,
  inputToken,
  maxTransactionFee,
  feeBreakdown,
  route,
  isLoading = false
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
      <div className="space-y-2">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Minimum Received</span>
            <span className="text-slate-300">
              {displayValue(minimumReceived, outputToken.symbol)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Max Transaction Fee</span>
            <span className="text-slate-300">
              {displayValue(formattedMaxFee, DOT_SYMBOL)}
            </span>
          </div>
          {/*           
          {feeBreakdown && formattedFees ? (
            <div className="space-y-1.5 pt-2 border-t border-slate-700/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Network Fee</span>
                <span className="text-slate-300">
                  {formattedFees.transaction} {inputToken.symbol}
                </span>
              </div>
              
              {feeBreakdown.xcmFee > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">XCM Fee</span>
                  <span className="text-slate-300">
                    {formattedFees.xcm} {inputToken.symbol}
                  </span>
                </div>
              )}
              
             <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Trading Fee</span>
                <span className="text-slate-300">
                  {formattedFees.trading} {inputToken.symbol}
                </span>
              </div> 
              
              <div className="flex items-center justify-between text-sm font-medium pt-1 border-t border-slate-700/50">
                <span className="text-slate-400">Total Fees</span>
                <span className="text-slate-300">
                  {formattedFees.total} {inputToken.symbol}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Max Transaction Fee</span>
              <span className="text-slate-300">
                {formattedMaxFee} {inputToken.symbol}
              </span>
            </div>
          )} */}

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Route</span>
            <span className="text-slate-300">{displayValue(route, '', '—')}</span>
          </div>
        </div>

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
      </div>
    </motion.div>
  );
}); 