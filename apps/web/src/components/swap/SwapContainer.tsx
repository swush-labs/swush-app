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
import { useTokenPrices } from '@/components/swap/hooks/useTokenPrices'
import { useWalletPlatformValidation } from '@/components/swap/hooks/useWalletPlatformValidation'

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
  const { selectedAccount, clearSelection } = useSelectedAccount()

  // Get recipient account from hook (with localStorage persistence)
  // Note: recipientAccount/recipientAddress are now independent from sender
  const {
    recipientAccount,
    recipientAddress,
    setRecipientAccount,
    setCustomRecipient,
    resetToSender,
    isCustomAddress,
    hasSavedRecipient,
  } = useRecipientAccount()

  // Extract signers from accounts (simplified with hook)
  const {
    isConnected,
    walletAddress,
    senderPolkadotSigner,
    evmSigner,
    solanaSigner,
    recipientPolkadotSigner,
  } = useSwapSigners(selectedAccount, recipientAccount)

  // Derive effective recipient address for transactions
  // Falls back to sender address when no explicit recipient is set (self-transfer)
  const effectiveRecipientAddress = recipientAddress || walletAddress

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

  // Fetch prices for all visible tokens
  const { formatUSD } = useTokenPrices({ fromTokens, toTokens });

  // Auto-clear wallets when switching to incompatible networks
  useWalletPlatformValidation(
    selectedAccount,
    inputToken?.network,
    recipientAccount,
    outputToken?.network,
    clearSelection,
    resetToSender
  );

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
    recipientAddress: effectiveRecipientAddress, // Use effective recipient (falls back to sender)
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
    recipientAddress: effectiveRecipientAddress, // Use effective recipient (falls back to sender)
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
    inputToken,
    outputToken,
    inputAmount,
    walletAddress,
    exchange: xcmRouteDex,
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
    recipientAddress: effectiveRecipientAddress, // Use effective recipient (falls back to sender)
    senderPolkadotSigner,
    recipientPolkadotSigner,
    evmSigner,
    solanaSigner,
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
  const { swapHistory, isLoadingHistory, totalPoints } = useSwapHistory({
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
                recipientAddress={hasSavedRecipient ? recipientAddress : undefined}
                isCustomRecipient={isCustomAddress || hasSavedRecipient}
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
        totalPoints={totalPoints}
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
        outputToken={flowState.success?.outputToken || outputToken?.symbol || ''}
        outputNetwork={outputToken?.network}
        duration={flowState.success?.duration || 4000}
        pointsEarned={flowState.success?.pointsEarned}
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
        selectedRecipient={hasSavedRecipient && !isCustomAddress ? recipientAccount : null}
        customAddress={isCustomAddress ? recipientAddress : ''}
        onCustomAddressSubmit={handleCustomAddressSubmit}
        onResetToSender={resetToSender}
      />
    </>
  )
} 