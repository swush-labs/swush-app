"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { SwapHeader } from '@/components/swap/ui/SwapHeader'
import { SwapField } from '@/components/swap/ui/SwapField'
import { SwapDetails } from '@/components/swap/ui/SwapDetails'
import { SubmitButtonAction } from '@/components/swap/ui/SwapAction'
import { SwapConfirmSheet } from '@/components/swap/ui/SwapConfirmSheet'
import { SwapHistoryDialog } from '@/components/swap/ui/SwapHistoryDialog'
import { useXcmTokens } from '@/components/swap/hooks/useXcmTokens'
import { useSwapRouter } from '@/components/swap/hooks/useSwapRouter'
import { useUnifiedSwapExecution } from '@/components/swap/hooks/useUnifiedSwapExecution'
import { useSwapFlow } from '@/components/swap/hooks/useSwapFlow'
import { useSwapHistory } from '@/components/swap/hooks/useSwapHistory'
import { useUnifiedBalances } from '@/components/swap/hooks/useUnifiedBalances'
import { useSwapCallbacks } from '@/components/swap/hooks/useSwapCallbacks'
import { useSwapSigners } from '@/components/swap/hooks/useSwapSigners'
import { LoadState } from '@/components/swap/ui/LoadState'
import { ArrowSymbolDown } from '@/components/swap/ui/ArrowSymbolDown'
import { calculateMinimumReceived } from '@/components/swap/utils'
import { loadSlippageFromStorage, saveSlippageToStorage } from '@/components/swap/utils/slippageStorage'
import { SwapCompleteDialog } from './ui/SwapCompleteDialog'
import ConnectWalletDialog from './ui/ConnectWalletDialog'
import SelectRecipientDialog from './ui/SelectRecipientDialog'
import SelectRecipientWalletDialog from './ui/SelectRecipientWalletDialog'
import { useSelectedAccount } from '@/components/wallet/use-selected-account'
import { useRecipientAccount } from '@/components/wallet/use-recipient-account'
import { usePriceAggregator } from '@/services/prices'

export function SwapContainer() {
  // UI state
  const [inputAmount, setInputAmount] = useState('')
  // Initialize slippage from localStorage or use default
  const [slippageTolerance, setSlippageTolerance] = useState(() => loadSlippageFromStorage())
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [openInputDialog, setOpenInputDialog] = useState(false)
  const [openOutputDialog, setOpenOutputDialog] = useState(false)
  const [isConnectWalletOpen, setIsConnectWalletOpen] = useState(false)
  const [isSelectRecipientOpen, setIsSelectRecipientOpen] = useState(false)
  const [isRecipientWalletDialogOpen, setIsRecipientWalletDialogOpen] = useState(false)

  // Wrapper function to update slippage and persist to localStorage
  const handleSlippageChange = useCallback((value: number) => {
    setSlippageTolerance(value);
    saveSlippageToStorage(value);
  }, []);

  // Get selected account from global hook
  const { selectedAccount } = useSelectedAccount()

  // Get recipient account from hook (with localStorage persistence)
  const {
    recipientAccount,
    recipientAddress,
    setRecipientAccount,
    setCustomRecipient,
    resetToSender,
    isDifferentFromSender,
    isCustomAddress,
  } = useRecipientAccount()

  // Extract signers from accounts (simplified with hook)
  const {
    isConnected,
    walletAddress,
    senderPolkadotSigner,
    evmSigner,
    recipientPolkadotSigner,
  } = useSwapSigners(selectedAccount, recipientAccount)

  // Custom hooks - Token and Balance handling (nuqs handles URL params automatically)
  const { 
    inputToken, 
    setInputToken, 
    outputToken, 
    setOutputToken, 
    // ✅ Separate token lists for input/output fields
    fromTokens,
    toTokens,
    // ✅ Loading state
    isInitialLoad,
    // Expose helpers for Phase 2 (routing)
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    // For debugging/inspection (can be removed later)
    unifiedFromAssets,
    unifiedToAssets,
  } = useXcmTokens()

  // Extract unique symbols from fromTokens and toTokens for price fetching
  const allSymbols = useMemo(() => {
    const symbols = new Set<string>();
    fromTokens.forEach(t => symbols.add(t.symbol));
    toTokens.forEach(t => symbols.add(t.symbol));
    return Array.from(symbols);
  }, [fromTokens, toTokens]);

  // Fetch prices for all visible tokens
  const { formatUSD } = usePriceAggregator(allSymbols);


  // Unified balance fetching - automatically routes to EVM (wagmi) or XCM (ParaSpell)
  const {
    inputBalance,
    outputBalance,
    inputBalanceRaw,
    outputBalanceRaw,
    isBalanceLoading,
    balancesLoaded,
    resetBalances,
    refreshBalances,
    startBalancePolling,
    stopBalancePolling,
  } = useUnifiedBalances({
    isConnected,
    walletAddress,
    recipientAddress, // Pass recipient address for output balance
    inputToken,
    outputToken,
    determineCurrency,
    getTAssetFromKey,
  });


  // Unified swap router - automatically routes to XCM or Chainflip based on tokens
  const {
    provider,
    providerLabel,
    outputAmount,
    estimatedFees,
    estimatedDuration,
    routeState,
    isLoadingQuote,
    isProcessing,
    // Provider-specific data for execution
    xcmRouteState,
    xcmRouteDex,
    xcmFeeBreakdown,
    chainflipQuote,
    // Actions
    debouncedFetchRoute,
    resetRoute,
  } = useSwapRouter({
    inputToken,
    outputToken,
    walletAddress,
    recipientAddress,
    slippageTolerance,
    // Pass helpers from useXcmTokens (required for XCM routes)
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
  })

  // Backward compatibility aliases
  const routeDex = xcmRouteDex || '';
  const feeBreakdown = xcmFeeBreakdown;
  const isLoadingFees = isLoadingQuote; // Chainflip gets fees with quote

  // Unified swap flow state management
  const {
    flowState,
    startConfirmation,
    confirmSwap,
    cancelSwap,
    startExecution,
    updateExecution,
    completeSwap,
    failSwap,
    reset: resetSwapFlow,
    isConfirming,
    isExecuting,
    isSuccess,
    isActive
  } = useSwapFlow();

  // Swap success/error handlers (extracted to custom hook)
  const { handleSwapSuccess, handleSwapError } = useSwapCallbacks({
    provider,
    setInputAmount,
    resetRoute,
    resetToSender,
    refreshBalances,
    startBalancePolling,
    stopBalancePolling,
    resetBalances,
    resetSwapFlow,
    completeSwap,
    failSwap,
    updateExecution,
  });

  // Unified swap execution - handles both XCM and Chainflip
  const { 
    executeSwap,
    chainflipDepositAddress,
    chainflipStage,
  } = useUnifiedSwapExecution({
    provider,
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    walletAddress,
    recipientAddress,
    senderPolkadotSigner,
    recipientPolkadotSigner,
    evmSigner,
    slippageTolerance,
    xcmRouteExchange: xcmRouteState?.data?.exchange,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    chainflipQuote,
    onExecutionStart: startExecution,
    onExecutionUpdate: updateExecution,
    onSuccess: handleSwapSuccess,
    onError: handleSwapError,
    enableXcmTracking: process.env.NEXT_PUBLIC_USE_LOCAL_ENDPOINTS === 'false',
    ocelloidsApiKey: process.env.NEXT_PUBLIC_OCELLOIDS_API_KEY,
  });

  // Handle swap button click - show confirmation sheet
  const handleSwapClick = useCallback(() => {
    // Create simulation result from current route data
    const simulationResult = {
      success: true,
      estimatedFee: estimatedFees || '0',
      feeBreakdown: feeBreakdown as any, // Type cast to match SimulationResult interface
      willSucceed: !routeState.error,
      error: routeState.error || undefined
    };
    startConfirmation(simulationResult);
  }, [estimatedFees, feeBreakdown, routeState.error, startConfirmation]);

  // Handle confirm swap - user confirmed in sheet
  const handleConfirmSwap = useCallback(() => {
    confirmSwap(); // Transitions to 'awaiting_signature'
    executeSwap(); // Starts execution
  }, [confirmSwap, executeSwap]);

  // Handle cancel swap - user cancelled
  const handleCancelSwap = useCallback(() => {
    cancelSwap(); // Resets to 'idle'
  }, [cancelSwap]);


  // Recipient management handlers (simplified with hook)
  const handleSelectDifferentWallet = useCallback(() => {
    setIsSelectRecipientOpen(false);
    setIsRecipientWalletDialogOpen(true);
  }, []);

  const handleRecipientWalletSelect = useCallback((account: any) => {
    setRecipientAccount(account);
    setIsRecipientWalletDialogOpen(false);
  }, [setRecipientAccount]);

  const handleCustomAddressSubmit = useCallback((address: string) => {
    setCustomRecipient(address);
  }, [setCustomRecipient]);

  // Effect to reset states when tokens change
  useEffect(() => {
    // Reset amounts and route state
    setInsufficientBalance(false);

    // Only fetch route if we have an input amount (not just token selection)
    if (inputToken && outputToken && inputAmount && parseFloat(inputAmount) > 0) {
      debouncedFetchRoute(inputAmount);
    } else {
      // Clear route when tokens change but no amount - prevents loading state on token selection
      resetRoute();
    }
  }, [inputToken, outputToken, inputAmount, debouncedFetchRoute, resetRoute]);

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

      // Check for insufficient balance
      if (value && inputBalance && parseFloat(value) > parseFloat(inputBalance)) {
        setInsufficientBalance(true);
      } else {
        setInsufficientBalance(false);
      }
    }
  }, [debouncedFetchRoute, resetRoute, inputBalance]);

  const percentageOptions = useMemo(() => [
    { label: '25%', value: 0.25 },
    { label: '50%', value: 0.50 },
    // { label: '75%', value: 0.75 },
    { label: 'MAX', value: 1 },
  ], []);

  // Swap history hook
  const { swapHistory, isLoadingHistory } = useSwapHistory({
    walletAddress,
    showHistory
  });

  // Show loading state only during initial asset loading
  // Once assets load once, show the UI even if they become empty later
  if (isInitialLoad) {
    return <LoadState />
  }

  return (
    <>

      {/* Main Content */}
      <div className="w-full h-full flex flex-col items-center pt-16 sm:-top-10 sm:justify-center px-4 md:px-4 relative z-10 overflow-y-scroll no-scrollbar">
        <div className="w-full max-w-md space-y-5 md:space-y-4">
          <SwapHeader
            slippageTolerance={slippageTolerance}
            setSlippageTolerance={handleSlippageChange}
            onHistoryClick={() => setShowHistory(true)}
          />

          <div className="space-y-4">
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
                availableTokens={fromTokens}
                percentageOptions={percentageOptions}
                onPercentageSelect={(value) => {
                  const balanceNum = parseFloat(inputBalance || '0');
                  const calculatedAmount = (balanceNum * value).toString();
                  handleInputChange(calculatedAmount);
                }}
                isLoading={isBalanceLoading}
                balancesLoaded={balancesLoaded}
                isConnected={isConnected}
                onConnectWalletClick={() => setIsConnectWalletOpen(true)}
                formatUSD={formatUSD}
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
                availableTokens={toTokens}
                isLoading={isLoadingQuote}
                balancesLoaded={balancesLoaded}
                isConnected={isConnected}
                isProcessing={isLoadingQuote}
                error={routeState.error}
                onConnectWalletClick={() => setIsConnectWalletOpen(true)}
                onSelectRecipientClick={() => setIsSelectRecipientOpen(true)}
                recipientAddress={isDifferentFromSender ? recipientAddress : undefined}
                isCustomRecipient={isCustomAddress || isDifferentFromSender}
                formatUSD={formatUSD}
              />
            </div>


            <SwapDetails
              minimumReceived={calculateMinimumReceived(outputAmount, slippageTolerance)}
              outputToken={outputToken}
              inputToken={inputToken}
              maxTransactionFee={estimatedFees || flowState.simulationResult?.estimatedFee || '0'}
              feeBreakdown={feeBreakdown || flowState.simulationResult?.feeBreakdown}
              route={providerLabel || routeDex || ''}
              isLoading={routeState.isLoading}
              isProcessing={isProcessing}
              isLoadingQuote={isLoadingQuote}
              isLoadingFees={isLoadingFees}
              estimatedDuration={estimatedDuration}
              provider={provider}
              formatUSD={formatUSD}
            />

            <SubmitButtonAction
              isConnected={isConnected}
              isSwapping={isActive}
              onSwap={handleSwapClick}
              insufficientBalance={insufficientBalance}
              disabled={!inputAmount || inputAmount === '' || parseFloat(inputAmount) <= 0 || insufficientBalance}
              isLoadingQuote={isLoadingQuote}
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

      {/* Swap Confirmation Bottom Sheet */}
      <SwapConfirmSheet
        isOpen={isConfirming}
        onClose={handleCancelSwap}
        onConfirm={handleConfirmSwap}
        inputAmount={inputAmount}
        inputToken={inputToken?.symbol || ''}
        outputAmount={outputAmount}
        outputToken={outputToken?.symbol || ''}
        slippageTolerance={slippageTolerance}
        simulationResult={flowState.simulationResult || null}
        isConfirming={false}
      />

      <SwapCompleteDialog 
        isOpen={isExecuting || isSuccess}
        isSwappingInProgress={isExecuting}
        isSwapComplete={isSuccess}
        inputAmount={flowState.success?.inputAmount || inputAmount}
        inputToken={flowState.success?.inputToken || inputToken?.symbol || ''}
        outputAmount={flowState.success?.outputAmount || outputAmount}
        outputToken={flowState.success?.outputToken || outputToken?.name || ''}
        duration={flowState.success?.duration || 4000}
        onClose={() => {
          stopBalancePolling(); // Clean up polling on dialog close
          resetSwapFlow();
        }}
        currentStep={flowState.execution?.currentStep}
        totalSteps={flowState.execution?.totalSteps}
        currentTransactionType={flowState.execution?.transactionType}
        xcmDeliveryStatus={flowState.execution?.xcmDeliveryStatus}
        xcmStatusMessage={flowState.execution?.xcmStatusMessage}
      />

      {/* Sender Wallet Dialog */}
      <ConnectWalletDialog 
        isOpen={isConnectWalletOpen} 
        onOpenChange={setIsConnectWalletOpen}
      />

      {/* Recipient Wallet Selection Dialog - Dedicated component */}
      <SelectRecipientWalletDialog 
        isOpen={isRecipientWalletDialogOpen}
        onOpenChange={setIsRecipientWalletDialogOpen}
        onAccountSelect={handleRecipientWalletSelect}
        currentRecipient={recipientAccount}
      />

      {/* Recipient Selection Dialog */}
      <SelectRecipientDialog 
        isOpen={isSelectRecipientOpen} 
        onOpenChange={setIsSelectRecipientOpen}
        onSelectDifferentWallet={handleSelectDifferentWallet}
        selectedRecipient={isDifferentFromSender && !isCustomAddress ? recipientAccount : null}
        customAddress={isCustomAddress ? recipientAddress : ''}
        onCustomAddressSubmit={handleCustomAddressSubmit}
        onResetToSender={resetToSender}
      />
    </>
  )
} 