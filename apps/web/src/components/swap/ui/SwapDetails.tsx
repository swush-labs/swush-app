import { motion } from 'framer-motion';
import { TokenInfo } from '../types';

interface SwapDetailsProps {
  minimumReceived: string;
  outputToken: TokenInfo;
  inputToken: TokenInfo;
  maxTransactionFee: string;
  route: string;
}

export const SwapDetails = ({
  minimumReceived,
  outputToken,
  inputToken,
  maxTransactionFee,
  route
}: SwapDetailsProps) => {
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
              {minimumReceived} {outputToken.name}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Max Transaction Fee</span>
            <span className="text-slate-300">{maxTransactionFee}</span>
          </div>
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