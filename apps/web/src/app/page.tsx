"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { History } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Toaster, toast } from 'react-hot-toast'
import type { TokenInfo } from '@/components/swap/types'
import {
  ArrowSymbolDown,
  WalletMenu,
  SwapProgress,
  SwapHeader,
  SwapField,
  SwapDetails,
  SubmitButtonAction,
  WalletButton,
  calculateMinimumReceived,
} from '@/components/swap'
import { useSwapTokens } from '@/components/swap/hooks/useSwapTokens'
import { useTokenBalances } from '@/components/swap/hooks/useTokenBalances'
import { useSwapRoute } from '@/components/swap/hooks/useSwapRoute'
import { useSwapSteps } from '@/components/swap/hooks/useSwapSteps'
import { useAssetConversionSwap } from '@/components/swap/hooks/useAssetConversionSwap'
import { LoadState } from '@/components/swap/ui/LoadState'

export default function SwapPage() {
  // Wallet state
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')

  // UI state
  const [inputAmount, setInputAmount] = useState('0')
  const [slippageTolerance, setSlippageTolerance] = useState(0.5)
  const [transactionDeadline, setTransactionDeadline] = useState(20)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [openInputDialog, setOpenInputDialog] = useState(false)
  const [openOutputDialog, setOpenOutputDialog] = useState(false)

  // Custom hooks
  const { inputToken, setInputToken, outputToken, setOutputToken, tokens } = useSwapTokens()
  const { inputBalance, outputBalance, isBalanceLoading, resetBalances } = useTokenBalances({
    isConnected,
    walletAddress,
    inputToken,
    outputToken
  })
  const { outputAmount, routeDex, routeState, debouncedFetchRoute } = useSwapRoute({
    inputToken,
    outputToken
  })
  const {
    swapSteps,
    isSwapping,
    setIsSwapping,
    showSwapProgress,
    handleSwap,
    handleSignStep,
    closeSwapProgress,
  } = useSwapSteps({
    inputToken: inputToken?.symbol || 'TOKEN',
    outputToken: outputToken?.symbol || 'TOKEN'
  })
  
  // Asset conversion swap hook
  const {
    executeSwap: executeAssetConversionSwap,
  } = useAssetConversionSwap({
    inputToken,
    outputToken,
    walletAddress,
    slippageTolerance,
    inputAmount,
    outputAmount,
    routeState,
    onSuccess: () => {
      // Reset states after successful swap
      setInputAmount('0');
      resetBalances();
      closeSwapProgress();
    },
    onError: (error) => {
      console.error('Swap execution error:', error);
      toast.error(`Swap failed: ${error.message}`);
      setIsSwapping(false);
      closeSwapProgress();
    }
  });

  // Updated handleSwap function that uses executeAssetConversionSwap
  const handleSwapExecution = useCallback(async (isUserConnected: boolean) => {
    if (!isUserConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!inputToken || !outputToken) {
      toast.error('Please select tokens for swap');
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error('Please enter a valid amount to swap');
      return;
    }

    if (insufficientBalance) {
      toast.error('Insufficient balance');
      return;
    }

    try {
      // Show the swap progress modal
      handleSwap(isUserConnected);
      
      // Execute the actual swap
      await executeAssetConversionSwap();
    } catch (error) {
      console.error('Error during swap execution:', error);
      toast.error(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSwapping(false);
      closeSwapProgress();
    }
  }, [
    inputToken, outputToken, inputAmount, insufficientBalance, 
    handleSwap, executeAssetConversionSwap, setIsSwapping, closeSwapProgress
  ]);

  // Effect to reset states when tokens change
  useEffect(() => {
    // Reset amounts and route state
    setInsufficientBalance(false);
    
    // If we have both tokens and an input amount, fetch new route
    if (inputToken && outputToken && parseFloat(inputAmount) > 0) {
      debouncedFetchRoute(inputAmount);
    }
  }, [inputToken, outputToken, inputAmount, debouncedFetchRoute]); // Added missing dependencies

  // Event handlers
  const handleInputChange = useCallback((value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setInputAmount(value);

      if (value && parseFloat(value) > 0) {
        debouncedFetchRoute(value);
      }

      setInsufficientBalance(value !== '' && parseFloat(value) > parseFloat(inputBalance));
    }
  }, [debouncedFetchRoute, inputBalance]);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setWalletAddress('');
    resetBalances();
    toast.success('Wallet disconnected', {
      icon: '👋',
      style: {
        borderLeft: '4px solid #64748b',
      },
    });
  }, [resetBalances]);

  const percentageOptions = useMemo(() => [
    { label: '25%', value: 0.25 },
    { label: '50%', value: 0.50 },
    { label: '75%', value: 0.75 },
    { label: 'MAX', value: 1 },
  ], []);

  if (!inputToken || !outputToken) {
     return <LoadState />
  }

  return (
    <>
      {/* Header Actions */}
      <div className="fixed top-4 right-4 hidden sm:flex items-center gap-4 z-50">
        <Button
          onClick={() => setShowHistory(true)}
          variant="outline"
          size="icon"
          className="bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-slate-300 transition-all duration-200"
        >
          <History className="w-4 h-4" />
        </Button>
        {!isConnected ? (
          <WalletButton
            isConnected={isConnected}
            setIsConnected={setIsConnected}
            setWalletAddress={setWalletAddress}
            variant="outline"
            className="flex items-center gap-2 bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-slate-300 transition-all duration-200"
          />
        ) : (
          <WalletMenu
            address={walletAddress}
            onDisconnect={handleDisconnect}
            className="bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-slate-300 transition-all duration-200"
          />
        )}
      </div>

      {/* Main Content */}
      <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex flex-col items-center justify-start pt-8">
        <div className="w-full max-w-md space-y-8">
          <SwapHeader
            slippageTolerance={slippageTolerance}
            setSlippageTolerance={setSlippageTolerance}
          />

          <div className="space-y-6">
            <SwapField
              type="input"
              token={inputToken}
              amount={inputAmount}
              balance={inputBalance}
              onTokenSelect={(token: TokenInfo) => setInputToken(token)}
              onAmountChange={handleInputChange}
              openDialog={openInputDialog}
              setOpenDialog={setOpenInputDialog}
              availableTokens={tokens}
              percentageOptions={percentageOptions}
              onPercentageSelect={(value) => handleInputChange((parseFloat(inputBalance) * value).toString())}
              isLoading={isConnected && isBalanceLoading}
            />

            <ArrowSymbolDown />

            <SwapField
              type="output"
              token={outputToken}
              amount={outputAmount}
              balance={outputBalance}
              onTokenSelect={(token: TokenInfo) => setOutputToken(token)}
              openDialog={openOutputDialog}
              setOpenDialog={setOpenOutputDialog}
              availableTokens={tokens}
              isLoading={routeState.isLoading || (isConnected && isBalanceLoading)}
              error={routeState.error}
            />
          </div>

          <SwapDetails
            minimumReceived={calculateMinimumReceived(outputAmount)}
            outputToken={outputToken}
            inputToken={inputToken}
            maxTransactionFee="0.004005"
            route={routeDex}
          />

          <SubmitButtonAction
            isConnected={isConnected}
            setIsConnected={setIsConnected}
            setWalletAddress={setWalletAddress}
            onSwap={() => handleSwapExecution(isConnected)}
            isSwapping={isSwapping}
            insufficientBalance={insufficientBalance}
            disabled={!inputAmount || parseFloat(inputAmount) <= 0 || insufficientBalance}
          />
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Swap History</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4 max-h-96 overflow-y-auto">
            <p className="text-slate-400">No swap history yet.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast Container */}
      <Toaster
        position="top-right"
        toastOptions={{
          className: "!bg-slate-900 !border !border-slate-800 !text-white",
          style: {
            background: 'rgb(15 23 42 / 0.9)',
            border: '1px solid rgb(51 65 85 / 0.5)',
            backdropFilter: 'blur(8px)',
          },
        }}
      />

      {/* Swap Progress Modal */}
{/*       {showSwapProgress && (
        <SwapProgress
          steps={swapSteps}
          onClose={closeSwapProgress}
          onSignStep={handleSignStep}
          inputAmount={inputAmount}
          inputToken={inputToken.symbol}
          outputAmount={outputAmount}
          outputToken={outputToken.symbol}
          isSwapping={isSwapping}
          setIsSwapping={setIsSwapping}
        />
      )} */}
    </>
  )
}