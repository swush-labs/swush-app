import { motion } from 'framer-motion';
import { TokenInfo } from '../types';
import { FeeBreakdown } from '../hooks/types';
import { formatAmount } from '@/services/balances/utils';

interface SwapDetailsProps {
  minimumReceived: string;
  outputToken: TokenInfo;
  inputToken: TokenInfo;
  maxTransactionFee: string;
  feeBreakdown?: FeeBreakdown;
  route: string;
}

export const SwapDetails = ({
  minimumReceived,
  outputToken,
  inputToken,
  maxTransactionFee,
  feeBreakdown,
  route
}: SwapDetailsProps) => {
  // Format fees for display if available
  const formattedFees = feeBreakdown ? {
    transaction: formatAmount(feeBreakdown.transactionFee, inputToken.decimals, { trim: true, round: 6 }).decimal,
    xcm: formatAmount(feeBreakdown.xcmFee, inputToken.decimals, { trim: true, round: 6 }).decimal,
    trading: formatAmount(feeBreakdown.tradingFee, inputToken.decimals, { trim: true, round: 6 }).decimal,
    total: formatAmount(feeBreakdown.totalFee, inputToken.decimals, { trim: true, round: 6 }).decimal
  } : null;

  // Format max transaction fee as fallback
  const formattedMaxFee = formatAmount(BigInt(maxTransactionFee), inputToken.decimals, { trim: true, round: 6 }).decimal;

  return (
    <motion.div
      className="p-4 rounded-xl bg-slate-800/20 backdrop-blur-sm border border-slate-700/20 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="space-y-2">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Minimum Received</span>
            <span className="text-slate-300">
              {minimumReceived} {outputToken.symbol}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Max Transaction Fee</span>
            <span className="text-slate-300">
              {formattedMaxFee} {inputToken.symbol}
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
            <span className="text-slate-300">{route}</span>
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
}; 