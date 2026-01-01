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
import { useXcmSwapExecution } from '@/components/swap/hooks/useXcmSwapExecution'
import { useChainflipExecution } from '@/components/swap/hooks/useChainflipExecution'
import { useSwapFlow } from '@/components/swap/hooks/useSwapFlow'
import { useSwapHistory } from '@/components/swap/hooks/useSwapHistory'
import { useParaSpellBalances } from '@/components/swap/hooks/useParaSpellBalances'
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
import { isSubstrateEvmChain } from '@/services/xcm-router/substrateEvmChains'

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
  const isConnected = !!selectedAccount
  const walletAddress = selectedAccount?.address || ''
  
  // Get polkadotSigner from sender - only available for Polkadot accounts
  const senderPolkadotSigner = selectedAccount && 'polkadotSigner' in selectedAccount 
    ? selectedAccount.polkadotSigner 
    : undefined
  
  // Get EVM signer (client) - only available for Ethereum accounts
  const evmSigner = selectedAccount && 'client' in selectedAccount 
    ? selectedAccount.client 
    : undefined

  // Get recipient account from hook (with localStorage persistence)
  const {
    recipientAccount,
    recipientAddress,
    setRecipientAccount,
    setCustomRecipient,
    resetToSender,
    isDifferentFromSender,
    isCustomAddress,
    hasSavedRecipient,
  } = useRecipientAccount()

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

  // Get polkadotSigner from recipient - used for cross-platform swaps (EVM → Substrate)
  const recipientPolkadotSigner = recipientAccount && 'polkadotSigner' in recipientAccount
    ? recipientAccount.polkadotSigner
    : undefined

  // Signer validation
  useEffect(() => {
    if (selectedAccount && !senderPolkadotSigner && selectedAccount.platform === 'polkadot') {
      console.warn('Missing Polkadot signer for Polkadot account');
    }
  }, [selectedAccount, senderPolkadotSigner]);

  // Balance fetching using ParaSpell SDK
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
  } = useParaSpellBalances({
    isConnected,
    walletAddress,
    recipientAddress, // Pass recipient address for output balance
    inputToken,
    outputToken,
    determineCurrency,
    getTAssetFromKey,
  });

  // Handle wallet disconnect - account management is now handled by the wallet dialog
  const handleDisconnect = useCallback(() => {
    // Wallet disconnect cleanup
  }, []);

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

  // Success handler shared between XCM and Chainflip
  const handleSwapSuccess = useCallback((success: {
    duration: number;
    inputAmount: string;
    inputToken: string;
    outputAmount: string;
    outputToken: string
  }) => {
    // For Chainflip swaps, complete immediately since Chainflip handles the full swap
    // For XCM swaps, wait for balance polling to confirm delivery
    if (provider === 'chainflip') {
      // Chainflip swap is already complete - mark it as successful immediately
      completeSwap(success);

      // Clear input and route immediately (but don't close dialog)
      setInputAmount('');
      resetRoute();

      // Reset recipient to sender after successful swap (for safety)
      resetToSender();

      // Refresh input balance to show deduction
      refreshBalances(true);
    } else {
      // XCM: Wait for destination balance to update before marking as successful
      // Start polling destination balance to confirm delivery
      startBalancePolling(() => {
        // Mark swap as successful when balance increases
        completeSwap(success);

        // Clear input and route immediately (but don't close dialog)
        setInputAmount('');
        resetRoute();

        // Reset recipient to sender after successful swap (for safety)
        resetToSender();

        // Refresh input balance to show deduction
        refreshBalances(true);
      });
    }

    // Update UI to show "waiting for delivery" state (only for XCM)
    updateExecution({
      statusMessage: provider === 'chainflip' 
        ? 'Chainflip is processing your swap...' 
        : 'Waiting for cross-chain delivery...',
    });
  }, [completeSwap, provider, refreshBalances, resetRoute, resetToSender, startBalancePolling, updateExecution]);

  // Error handler shared between XCM and Chainflip
  const handleSwapError = useCallback((error: { message: string; code?: string; userCancelled?: boolean }) => {
    failSwap(error);
    // Stop any ongoing balance polling
    stopBalancePolling();
    // Refresh balances after failed transaction
    resetBalances(true);
    // Auto-reset after showing error state
    setTimeout(() => {
      setInputAmount('');
      resetRoute();
      resetSwapFlow();
    }, 5000);
  }, [failSwap, resetBalances, resetRoute, resetSwapFlow, stopBalancePolling]);

  // XCM Swap execution hook with ParaSpell RouterBuilder
  const { executeSwap: executeXcmSwap } = useXcmSwapExecution({
    inputToken: provider === 'xcm' ? inputToken : null,
    outputToken: provider === 'xcm' ? outputToken : null,
    inputAmount,
    outputAmount,
    slippageTolerance,
    walletAddress,
    recipientAddress,
    senderPolkadotSigner,
    recipientPolkadotSigner,
    selectedExchange: xcmRouteState?.data?.exchange,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    onExecutionStart: startExecution,
    onExecutionUpdate: updateExecution,
    onSuccess: handleSwapSuccess,
    onError: handleSwapError,
    enableXcmTracking: process.env.NEXT_PUBLIC_USE_LOCAL_ENDPOINTS === 'false',
    ocelloidsApiKey: process.env.NEXT_PUBLIC_OCELLOIDS_API_KEY,
  });

  // Chainflip Swap execution hook
  const { 
    executeSwap: executeChainflipSwap,
    depositAddress: chainflipDepositAddress,
    stage: chainflipStage,
  } = useChainflipExecution({
    inputToken: provider === 'chainflip' ? inputToken : null,
    outputToken: provider === 'chainflip' ? outputToken : null,
    inputAmount,
    outputAmount,
    quote: chainflipQuote || null,
    walletAddress,
    recipientAddress,
    slippageTolerance,
    evmSigner,
    polkadotSigner: senderPolkadotSigner,
    onExecutionStart: (execution) => {
      startExecution({
        currentStep: 0,
        totalSteps: 1, // Chainflip: user signs deposit once, then Chainflip handles everything
        transactionType: null,
        statusMessage: execution.statusMessage,
      });
    },
    onExecutionUpdate: (execution) => {
      updateExecution({
        statusMessage: execution.statusMessage,
      });
    },
    onSuccess: (success) => handleSwapSuccess({
      duration: success.duration,
      inputAmount: success.inputAmount,
      inputToken: success.inputToken,
      outputAmount: success.outputAmount,
      outputToken: success.outputToken,
    }),
    onError: handleSwapError,
  });

  // Unified executeSwap function that routes to the correct provider
  const executeSwap = useCallback(() => {
    if (provider === 'chainflip') {
      return executeChainflipSwap();
    }
    return executeXcmSwap();
  }, [provider, executeChainflipSwap, executeXcmSwap]);

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

  // Handle wallet disconnect with confirmation state cleanup
  const handleWalletDisconnect = useCallback(() => {
    handleDisconnect();
    if (isActive) {
      resetSwapFlow();
    }
    // Reset route state
    resetRoute();
    // Reset input amount
    setInputAmount('');
  }, [handleDisconnect, isActive, resetSwapFlow, resetRoute]);

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
              />
            </div>

            {/* Cross-platform swap warning */}
            {inputToken?.networkChain && outputToken?.networkChain && (
              (() => {
                const isSubstrateEvmOrigin = isSubstrateEvmChain(inputToken.networkChain);
                const isSubstrateDestination = !isSubstrateEvmChain(outputToken.networkChain);
                const isCrossPlatformSwap = isSubstrateEvmOrigin && isSubstrateDestination;

                if (!isCrossPlatformSwap) return null;

                const hasRecipientPolkadotWallet = recipientAccount?.platform === 'polkadot';
                const isUsingCustomAddress = isCustomAddress;

                return (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="font-medium text-amber-500 mb-1">Cross-chain Swap</p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {!hasRecipientPolkadotWallet && !isUsingCustomAddress ? (
                            <>Swapping from {inputToken.networkChain} to {outputToken.networkChain} requires a Polkadot wallet. Please select a Polkadot wallet as the recipient.</>
                          ) : isUsingCustomAddress ? (
                            <>Custom addresses are not supported for cross-chain swaps. Please select a connected Polkadot wallet as the recipient.</>
                          ) : (
                            <>This swap will use your recipient's Polkadot wallet to construct the cross-chain message.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

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