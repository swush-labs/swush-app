"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Toaster } from 'react-hot-toast'
import { SwapHeader } from '@/components/swap'
import { HeaderActions } from '@/components/swap/ui/SwapHeader'
import { SwapProgress, SwapConfirmSheet } from '@/components/swap'
import { useSwapTokens } from '@/components/swap/hooks/useSwapTokens'
import { useTokenBalances } from '@/components/swap/hooks/useTokenBalances'
import { useSwapRoute } from '@/components/swap/hooks/useSwapRoute'
import { useSwapSteps } from '@/components/swap/hooks/useSwapSteps'
import { useAssetConversionSwap } from '@/components/swap/hooks/useAssetConversionSwap'
import { useSwapConfirmation } from '@/components/swap/hooks/useSwapConfirmation'
import { useSwapExecution } from '@/components/swap/hooks/useSwapExecution'
import { useSwapHistory } from '@/components/swap/hooks/useSwapHistory'
import { LoadState } from '@/components/swap/ui/LoadState'
import { SwapForm } from '@/components/swap/ui/SwapForm'
import { SwapHistoryDialog } from '@/components/swap/ui/SwapHistoryDialog'

export default function SwapPage() {
  // UI state
  const [inputAmount, setInputAmount] = useState('0')
  const [slippageTolerance, setSlippageTolerance] = useState(10)
  const [transactionDeadline, setTransactionDeadline] = useState(20)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [openInputDialog, setOpenInputDialog] = useState(false)
  const [openOutputDialog, setOpenOutputDialog] = useState(false)

  // Initialize wallet state first to avoid circular dependencies
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')

  // Custom hooks - Token and Balance handling
  const { inputToken, setInputToken, outputToken, setOutputToken, tokens } = useSwapTokens()
  
  // Token balances
  const { 
    inputBalance, 
    outputBalance, 
    isBalanceLoading, 
    resetBalances, 
    refreshBalances 
  } = useTokenBalances({
    isConnected,
    walletAddress,
    inputToken,
    outputToken
  })
  
  // Handle wallet disconnect
  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setWalletAddress('');
    resetBalances();
  }, [resetBalances]);
  
  // Swap route
  const {
    outputAmount,
    routeDex,
    routeState,
    debouncedFetchRoute,
    resetRoute
  } = useSwapRoute({
    inputToken,
    outputToken
  })
  
  // Swap steps
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

  // Swap confirmation
  const {
    showConfirmation,
    simulationResult,
    isConfirmingSwap,
    handleSimulationComplete,
    handleConfirmSwap,
    handleCancelSwap,
    resetConfirmationState
  } = useSwapConfirmation({
    setIsSwapping
  });

  // Handle balance updates after swap
  const handleBalanceUpdateNeeded = useCallback((txHash?: string) => {
    // Use the simplified refresh approach
    refreshBalances(true, txHash);
  }, [refreshBalances]);

  // Asset conversion swap hook with simulation callback
  const {
    executeSwap: executeAssetConversionSwap,
    isFinalized
  } = useAssetConversionSwap({
    inputToken,
    outputToken,
    walletAddress,
    slippageTolerance,
    inputAmount,
    outputAmount,
    routeState,
    onSuccess: () => {
      // Reset all swap-related states
      setInputAmount('0');
      resetRoute(); // This will reset the output amount and route state
      
      // Slight delay before closing the progress modal to show success state
      setTimeout(() => {
        closeSwapProgress();
      }, 1500);
      
      // Reset confirmation UI state
      resetConfirmationState();
    },
    onError: (error) => {
      // Reset all swap-related states
      setInputAmount('0');
      resetRoute();
      setIsSwapping(false);
      resetConfirmationState();
      closeSwapProgress();
    },
    onSimulationComplete: handleSimulationComplete,
    onBalanceUpdateNeeded: handleBalanceUpdateNeeded
  });

  // Swap execution handling
  const { handleSwapExecution } = useSwapExecution({
    inputToken,
    outputToken,
    inputAmount,
    insufficientBalance,
    executeAssetConversionSwap,
    handleSwap,
    setIsSwapping,
    setIsConfirmingSwap: resetConfirmationState,
    closeSwapProgress
  });

  // Handle wallet disconnect with confirmation state cleanup
  const handleWalletDisconnect = useCallback(() => {
    handleDisconnect();
    if (showConfirmation) {
      resetConfirmationState();
    }
  }, [handleDisconnect, showConfirmation, resetConfirmationState]);

  // Effect to reset states when tokens change
  useEffect(() => {
    // Reset amounts and route state
    setInsufficientBalance(false);

    // If we have both tokens and an input amount, fetch new route
    if (inputToken && outputToken && parseFloat(inputAmount) > 0) {
      debouncedFetchRoute(inputAmount);
    }
  }, [inputToken, outputToken, inputAmount, debouncedFetchRoute]);

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

  const percentageOptions = useMemo(() => [
    { label: '25%', value: 0.25 },
    { label: '50%', value: 0.50 },
    { label: '75%', value: 0.75 },
    { label: 'MAX', value: 1 },
  ], []);

  // Swap history hook
  const { swapHistory, isLoadingHistory } = useSwapHistory({
    walletAddress,
    showHistory
  });

  if (!inputToken || !outputToken) {
    return <LoadState />
  }

  return (
    <>
      {/* Header Actions */}
      <HeaderActions
        isConnected={isConnected}
        setIsConnected={setIsConnected}
        setWalletAddress={setWalletAddress}
        walletAddress={walletAddress}
        onDisconnect={handleWalletDisconnect}
        onHistoryClick={() => setShowHistory(true)}
        isSwapping={isSwapping}
        setIsSwapping={setIsSwapping}
      />

      {/* Main Content */}
      <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex flex-col items-center justify-start pt-8">
        <div className="w-full max-w-md space-y-8">
          <SwapHeader
            slippageTolerance={slippageTolerance}
            setSlippageTolerance={setSlippageTolerance}
          />

          <SwapForm
            inputToken={inputToken}
            outputToken={outputToken}
            inputAmount={inputAmount}
            outputAmount={outputAmount}
            inputBalance={inputBalance}
            outputBalance={outputBalance}
            routeDex={routeDex}
            routeState={routeState}
            insufficientBalance={insufficientBalance}
            isConnected={isConnected}
            isBalanceLoading={isBalanceLoading}
            onInputTokenSelect={setInputToken}
            onOutputTokenSelect={setOutputToken}
            handleInputChange={handleInputChange}
            handlePercentageSelect={(value) => handleInputChange((parseFloat(inputBalance) * value).toString())}
            handleSwapExecution={handleSwapExecution}
            openInputDialog={openInputDialog}
            setOpenInputDialog={setOpenInputDialog}
            openOutputDialog={openOutputDialog}
            setOpenOutputDialog={setOpenOutputDialog}
            isSwapping={isSwapping}
            setIsConnected={setIsConnected}
            setWalletAddress={setWalletAddress}
            tokens={tokens}
            percentageOptions={percentageOptions}
          />
        </div>
      </div>

      {/* History Dialog */}
      <SwapHistoryDialog
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        swapHistory={swapHistory}
        isLoadingHistory={isLoadingHistory}
      />

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
      )}

      {/* Swap Confirmation Bottom Sheet */}
      <SwapConfirmSheet
        isOpen={showConfirmation}
        onClose={handleCancelSwap}
        onConfirm={handleConfirmSwap}
        inputAmount={inputAmount}
        inputToken={inputToken.symbol}
        outputAmount={outputAmount}
        outputToken={outputToken.symbol}
        slippageTolerance={slippageTolerance}
        simulationResult={simulationResult}
        isConfirming={isConfirmingSwap}
      />
    </>
  )
}