"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Toaster } from 'react-hot-toast'
import { SubmitButtonAction, SwapHeader, SwapField, SwapDetails } from '@/components/swap'
import { HeaderActions } from '@/components/swap/ui/SwapHeader'
  
// Dynamic imports for non-critical components
const SwapConfirmSheet = dynamic(() => import('@/components/swap/ui/SwapConfirmSheet').then(mod => ({ default: mod.SwapConfirmSheet })), {
  ssr: false
})

const SwapHistoryDialog = dynamic(() => import('@/components/swap/ui/SwapHistoryDialog').then(mod => ({ default: mod.SwapHistoryDialog })), {
  ssr: false
})
import { useSwapTokens } from '@/components/swap/hooks/useSwapTokens'
import { useTokenBalances } from '@/components/swap/hooks/useTokenBalances'
import { useSwapRoute } from '@/components/swap/hooks/useSwapRoute'
import { useSwapSteps } from '@/components/swap/hooks/useSwapSteps'
import { useAssetConversionSwap } from '@/components/swap/hooks/useAssetConversionSwap'
import { useSwapConfirmation } from '@/components/swap/hooks/useSwapConfirmation'
import { useSwapExecution } from '@/components/swap/hooks/useSwapExecution'
import { useSwapHistory } from '@/components/swap/hooks/useSwapHistory'
import { LoadState } from '@/components/swap/ui/LoadState'
import { ArrowSymbolDown } from '@/components/swap'
import { calculateMinimumReceived } from '@/components/swap'

export function SwapContainer() {
  // UI state
  const [inputAmount, setInputAmount] = useState('')
  const [slippageTolerance, setSlippageTolerance] = useState(10)
  const [transactionDeadline, setTransactionDeadline] = useState(20)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [openInputDialog, setOpenInputDialog] = useState(false)
  const [openOutputDialog, setOpenOutputDialog] = useState(false)

  // Initialize wallet state first to avoid circular dependencies
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')

  // Custom hooks - Token and Balance handling (nuqs handles URL params automatically)
  const { inputToken, setInputToken, outputToken, setOutputToken, tokens } = useSwapTokens()

  // Token balances
  const {
    inputBalance,
    outputBalance,
    isBalanceLoading,
    balancesLoaded,
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
    estimatedFees,
    feeBreakdown,
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
      setInputAmount('');
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
      setInputAmount('');
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
    resetBalances();
    if (showConfirmation) {
      resetConfirmationState();
    }
    // Reset route state
    resetRoute();
    // Reset input amount
    setInputAmount('');
  }, [handleDisconnect, showConfirmation, resetConfirmationState, resetBalances, resetRoute]);

  // Effect to reset states when tokens change
  useEffect(() => {
    // Reset amounts and route state
    setInsufficientBalance(false);

    // If we have both tokens and an input amount, fetch new route
    if (inputToken && outputToken && inputAmount && parseFloat(inputAmount) > 0) {
      debouncedFetchRoute(inputAmount);
    }
  }, [inputToken, outputToken, inputAmount, debouncedFetchRoute]);

  // Event handlers
  const handleInputChange = useCallback((value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setInputAmount(value);

      if (value && parseFloat(value) > 0) {
        debouncedFetchRoute(value);
      } else {
        // Cancel any pending debounced calls and reset route when input is cleared or zero
        debouncedFetchRoute.cancel();
        resetRoute();
      }

      setInsufficientBalance(value !== '' && parseFloat(value) > parseFloat(inputBalance));
    }
  }, [debouncedFetchRoute, inputBalance, resetRoute]);

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
      <div className="min-h-screen w-full flex flex-col items-center justify-start px-6 py-4 md:px-4 md:py-4 relative z-10">
        <div className="w-full max-w-md space-y-4 md:space-y-4">
          <SwapHeader
            slippageTolerance={slippageTolerance}
            setSlippageTolerance={setSlippageTolerance}
          />

          <div className="space-y-8">
            <div className="">
              <SwapField
                type="input"
                token={inputToken}
                amount={inputAmount}
                balance={inputBalance}
                onTokenSelect={(token) => {
                  setInputToken(token)
                }}
                onAmountChange={handleInputChange}
                openDialog={openInputDialog}
                setOpenDialog={setOpenInputDialog}
                availableTokens={tokens}
                percentageOptions={percentageOptions}
                onPercentageSelect={(value) => handleInputChange((parseFloat(inputBalance) * value).toString())}
                isLoading={isConnected && isBalanceLoading}
                balancesLoaded={balancesLoaded}
                isConnected={isConnected}
              />

              <ArrowSymbolDown />

              <SwapField
                type="output"
                token={outputToken}
                amount={outputAmount}
                balance={outputBalance}
                onTokenSelect={(token) => {
                  setOutputToken(token)
                }}
                openDialog={openOutputDialog}
                setOpenDialog={setOpenOutputDialog}
                availableTokens={tokens}
                isLoading={routeState.isLoading || (isConnected && isBalanceLoading)}
                balancesLoaded={balancesLoaded}
                isConnected={isConnected}
                error={routeState.error}
              />
            </div>

            <SwapDetails
              minimumReceived={calculateMinimumReceived(outputAmount, slippageTolerance)}
              outputToken={outputToken}
              inputToken={inputToken}
              maxTransactionFee={estimatedFees || simulationResult?.estimatedFee || '0'}
              feeBreakdown={feeBreakdown || simulationResult?.feeBreakdown}
              route={routeDex || ''}
              isLoading={routeState.isLoading}
            />

            <SubmitButtonAction
              isConnected={isConnected}
              isSwapping={isSwapping}
              setIsConnected={setIsConnected}
              setWalletAddress={setWalletAddress}
              onSwap={() => handleSwapExecution(isConnected)}
              insufficientBalance={insufficientBalance}
              disabled={!inputAmount || inputAmount === '' || parseFloat(inputAmount) <= 0 || insufficientBalance}
            />
          </div>
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
          className: "!bg-forest-900/90 !border !border-forest-600/50 !text-forest-100",
          style: {
            background: 'rgba(15, 41, 34, 0.9)',
            border: '1px solid rgba(44, 95, 93, 0.5)',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(255, 107, 53, 0.1)',
          },
        }}
      />

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