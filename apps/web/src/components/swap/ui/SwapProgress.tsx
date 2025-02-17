import { motion } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { SigningStep } from '../types';

interface SwapProgressProps {
  steps: SigningStep[];
  onClose: () => void;
  onSignStep: (stepId: number) => Promise<void>;
  inputAmount: string;
  inputToken: string;
  outputAmount: string;
  outputToken: string;
  isSwapping: boolean;
  setIsSwapping: (value: boolean) => void;
}

export const SwapProgress = ({
  steps,
  onClose,
  onSignStep,
  inputAmount,
  inputToken,
  outputAmount,
  outputToken,
  isSwapping,
  setIsSwapping
}: SwapProgressProps) => {
  return (
    <motion.div 
      className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="w-full max-w-md space-y-8 relative"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">
              {steps.every(step => step.status === 'completed') 
                ? '🎉 Swap Complete'
                : steps.some(step => step.status === 'failed')
                ? '❌ Swap Failed'
                : '🔄 Confirming Swap'
              }
            </h2>
            <p className="text-slate-400">
              {inputAmount} {inputToken} → {outputAmount} {outputToken}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!steps.some(step => step.status === 'loading')) {
                onClose();
                setIsSwapping(false);
              }
            }}
            disabled={steps.some(step => step.status === 'loading')}
            className="text-slate-400 hover:text-white hover:bg-slate-800/50"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <motion.div 
              key={step.id}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`p-6 rounded-xl border backdrop-blur-sm transition-all duration-300
                ${step.status === 'completed' ? 'bg-green-500/10 border-green-500/20 shadow-lg shadow-green-500/10' :
                  step.status === 'loading' ? 'bg-blue-500/10 border-blue-500/20 shadow-lg shadow-blue-500/10' :
                  step.status === 'pending' ? 'bg-yellow-500/10 border-yellow-500/20' :
                  step.status === 'failed' ? 'bg-red-500/10 border-red-500/20 shadow-lg shadow-red-500/10' :
                  'bg-slate-800/50 border-slate-700/50'}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                  ${step.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                    step.status === 'loading' ? 'bg-blue-500/20 text-blue-500' :
                    step.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                    step.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                    'bg-slate-700/50 text-slate-400'}`}
                >
                  {step.status === 'completed' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 10 }}
                    >
                      <Check className="w-6 h-6" />
                    </motion.div>
                  ) : step.status === 'loading' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : step.status === 'failed' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 10 }}
                    >
                      <X className="w-6 h-6" />
                    </motion.div>
                  ) : (
                    <span className="text-lg font-semibold">{step.id}</span>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                    <p className="text-sm text-slate-400">{step.description}</p>
                  </div>
                  {step.needsSignature && step.status === 'pending' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Button
                        onClick={() => onSignStep(step.id)}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-5 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200"
                      >
                        Sign Transaction
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {steps.every(step => step.status === 'completed') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <Button
              onClick={() => {
                onClose();
                setIsSwapping(false);
              }}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-6 text-lg font-semibold rounded-xl shadow-lg shadow-green-500/25 transition-all duration-200"
            >
              Return to Swap
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}; 