import { useState, useCallback } from 'react';
import { RouterBuilder } from '@paraspell/xcm-router';
import type { TAssetInfo, TChain } from '@paraspell/sdk';
import type { 
  TExchangeChain,
  TRouterEvent,
  TRouterEventType
} from '@paraspell/xcm-router';
import type { PolkadotSigner } from 'polkadot-api';

// Our types
import type { TokenInfo } from '@/components/swap/types';
import type { SimulationResult } from '@/components/swap/ui/SwapConfirmSheet';
import { SwapToasts, TOAST_IDS } from '../utils/toastUtils';

// Import chopsticks endpoints for local development
import { 
  TEST_RPC_POLKADOT, 
  TEST_RPC_ASSET_HUB, 
  TEST_RPC_HYDRATION 
} from '@/services/constants';

/**
 * Convert user input (decimal string) to smallest unit (bigint)
 * Uses string manipulation to preserve precision for large decimals
 */
function toSmallestUnit(amount: string, decimals: number): bigint {
  const parsed = parseFloat(amount);
  
  if (parsed > Number.MAX_SAFE_INTEGER) {
    throw new Error('Amount too large');
  }

  if (isNaN(parsed) || parsed <= 0) return BigInt(0);

  // Handle decimal places with string manipulation to avoid precision loss
  const [whole = '0', fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;

  return BigInt(combined);
}

/**
 * Props for useXcmSwapExecution hook
 */
interface UseXcmSwapExecutionProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  inputAmount: string;
  slippageTolerance: number;
  walletAddress: string;
  polkadotSigner: PolkadotSigner | undefined;
  
  // Helpers from useXcmTokens
  getOptimalExchanges: (
    fromKey: string,
    toKey: string,
    fromChain: string,
    toChain: string
  ) => TExchangeChain[];
  
  determineCurrency: (asset: TAssetInfo) => any;
  
  getTAssetFromKey: (
    key: string,
    direction: 'from' | 'to'
  ) => TAssetInfo | undefined;
  
  // Callbacks
  onSimulationComplete?: (result: SimulationResult) => Promise<boolean>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Return type for useXcmSwapExecution hook
 */
interface UseXcmSwapExecutionReturn {
  executeSwap: () => Promise<void>;
  isSwapping: boolean;
  swapStatus: string | null;
  swapError: Error | null;
  currentTransactionType: TRouterEventType | null;
  currentStep: number;
  totalSteps: number;
}

/**
 * XCM Swap Execution Hook - Uses ParaSpell RouterBuilder for transaction execution
 * 
 * Features:
 * - Real cross-chain swap execution via RouterBuilder.buildAndSend()
 * - Kheopskit wallet signer integration
 * - Multi-step transaction progress tracking
 * - Comprehensive error handling
 * 
 * @param props - Hook configuration
 * @returns Swap execution state and control functions
 */
export function useXcmSwapExecution({
  inputToken,
  outputToken,
  inputAmount,
  slippageTolerance,
  walletAddress,
  polkadotSigner,
  getOptimalExchanges,
  determineCurrency,
  getTAssetFromKey,
  onSimulationComplete,
  onSuccess,
  onError,
}: UseXcmSwapExecutionProps): UseXcmSwapExecutionReturn {

  // State management
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<Error | null>(null);
  const [currentTransactionType, setCurrentTransactionType] = useState<TRouterEventType | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);

  /**
   * Execute the swap using ParaSpell RouterBuilder
   */
  const executeSwap = useCallback(async () => {
    // Validation
    if (!inputToken || !outputToken || !walletAddress || !polkadotSigner) {
      const error = new Error('Missing required parameters: token, wallet, or signer');
      setSwapError(error);
      if (onError) onError(error);
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      const error = new Error('Invalid swap amount');
      setSwapError(error);
      if (onError) onError(error);
      return;
    }

    // Ensure tokens have required XCM fields
    if (!inputToken.assetKey || !inputToken.networkChain) {
      const error = new Error('Input token missing assetKey or networkChain');
      console.error('❌ Input token configuration error:', inputToken);
      setSwapError(error);
      if (onError) onError(error);
      return;
    }

    if (!outputToken.assetKey || !outputToken.networkChain) {
      const error = new Error('Output token missing assetKey or networkChain');
      console.error('❌ Output token configuration error:', outputToken);
      setSwapError(error);
      if (onError) onError(error);
      return;
    }

    try {
      // Reset state
      // DON'T set isSwapping=true yet - wait for wallet signature
      setSwapError(null);
      setSwapStatus('Preparing swap transaction...');
      setCurrentTransactionType(null);
      setCurrentStep(0);
      setTotalSteps(0);

      // Show initial toast
      SwapToasts.confirmAndSign();

      console.log('🚀 Starting XCM swap execution:', {
        from: `${inputToken.symbol} (${inputToken.networkChain})`,
        to: `${outputToken.symbol} (${outputToken.networkChain})`,
        amount: inputAmount,
        walletAddress,
      });

      // Step 1: Get optimal DEX selection
      const exchangesToUse = getOptimalExchanges(
        inputToken.assetKey,
        outputToken.assetKey,
        inputToken.networkChain,
        outputToken.networkChain
      );

      // Use optimal exchanges or fallback to HydrationDex
      // const exchanges: TExchangeChain[] = exchangesToUse.length > 0
      //   ? exchangesToUse
      //   : ['HydrationDex'];

      //TODO: hardcode HydrationDex for now
      const exchanges: TExchangeChain[] = ['HydrationDex'];

      console.log('📊 Selected exchanges:', exchanges);

      // Step 2: Get TAssetInfo for both tokens
      const fromAsset = getTAssetFromKey(inputToken.assetKey, 'from');
      const toAsset = getTAssetFromKey(outputToken.assetKey, 'to');

      if (!fromAsset || !toAsset) {
        throw new Error(
          `Assets not found in registry: ${inputToken.assetKey} or ${outputToken.assetKey}`
        );
      }

      // Step 3: Convert amount to smallest unit (BigInt)
      const amountInSmallestUnit = toSmallestUnit(
        inputAmount,
        inputToken.decimals
      );

      console.log('💰 Amount in smallest unit:', amountInSmallestUnit.toString());

      // Step 4: Execute swap with RouterBuilder
      setSwapStatus('Waiting for wallet signature...');
      
      // Note: Don't set isSwapping=true yet - wait until after wallet signs
      // The onStatusChange callback will trigger when transaction actually starts

      // Configure RouterBuilder with local chopsticks endpoints for development
      const USE_LOCAL_ENDPOINTS = process.env.NEXT_PUBLIC_USE_HTTPS === 'false' || 
                                   process.env.NODE_ENV === 'development';
      
      const routerConfig = USE_LOCAL_ENDPOINTS ? {
        development: true, // Enforce overrides for all chains used
        abstractDecimals: false, // We handle decimals manually with toSmallestUnit
        apiOverrides: {
          AssetHubPolkadot: TEST_RPC_ASSET_HUB,  // ws://localhost:3421
          Hydration: TEST_RPC_HYDRATION,         // ws://localhost:3422
        }
      } : undefined;

      console.log('🔧 RouterBuilder config:', {
        useLocalEndpoints: USE_LOCAL_ENDPOINTS,
        config: routerConfig
      });

      //print RouterBuilder input data
      console.log('🔧 RouterBuilder input data:', {
        from: inputToken.networkChain,
        to: outputToken.networkChain,
        exchange: exchanges,
        currencyFrom: determineCurrency(fromAsset),
        currencyTo: determineCurrency(toAsset),
        amount: amountInSmallestUnit,
        slippagePct: slippageTolerance.toString(),
        senderAddress: walletAddress,
        recipientAddress: walletAddress,
      });
      
      await RouterBuilder(routerConfig)
        .from(inputToken.networkChain as any) // Type assertion for chain compatibility
        .to(outputToken.networkChain as any) // Type assertion for chain compatibility
        .exchange(exchanges as any) // Type assertion needed due to ParaSpell's strict tuple type
        .currencyFrom(determineCurrency(fromAsset))
        .currencyTo(determineCurrency(toAsset))
        .amount(amountInSmallestUnit)
        .slippagePct(slippageTolerance.toString())
        .senderAddress(walletAddress)
        .recipientAddress(walletAddress) // Same as sender for now
        .signer(polkadotSigner)
        .onStatusChange((status: TRouterEvent) => {
          // Update UI with current transaction status
          console.log(`📡 Transaction status update:`, {
            type: status.type,
            step: status.currentStep !== undefined ? status.currentStep + 1 : '?',
            totalSteps: status.routerPlan?.length || '?',
            chain: status.chain,
            destinationChain: status.destinationChain,
          });

          // Set isSwapping=true when transaction actually starts (after wallet signs)
          // This happens when we get the first real transaction event
          if (status.type !== 'SELECTING_EXCHANGE' && status.type !== 'COMPLETED') {
            setIsSwapping(true);
          }

          setCurrentTransactionType(status.type);
          setCurrentStep(status.currentStep || 0);
          setTotalSteps(status.routerPlan?.length || 0);

          // Update swap status message based on transaction type
          if (status.type === 'SELECTING_EXCHANGE') {
            setSwapStatus('Selecting best exchange...');
          } else if (status.type === 'TRANSFER') {
            setSwapStatus('Transferring assets to exchange...');
          } else if (status.type === 'SWAP') {
            setSwapStatus('Swapping on DEX...');
          } else if (status.type === 'SWAP_AND_TRANSFER') {
            setSwapStatus('Swapping and transferring back...');
          } else if (status.type === 'COMPLETED') {
            setSwapStatus('Swap completed successfully!');
          }
        })
        .build();

      // Success!
      console.log('✅ Swap completed successfully!');
      setSwapStatus('Swap completed!');
      
      // Keep isSwapping=true briefly to show completion, then trigger onSuccess
      setTimeout(() => {
        setIsSwapping(false);
        
        // Dismiss any active toasts and show success
        SwapToasts.dismiss(TOAST_IDS.SWAP_STATUS);
        SwapToasts.swapSuccess({
          inputAmount,
          inputToken: inputToken.symbol,
          outputToken: outputToken.symbol
        });

        if (onSuccess) onSuccess();
      }, 1000); // Brief delay to show "completed" state

    } catch (error: unknown) {
      console.error('❌ XCM swap execution error:', error);

      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to execute swap';

      const swapError = new Error(errorMessage);
      setSwapError(swapError);
      setSwapStatus(`Failed: ${errorMessage}`);
      setIsSwapping(false);

      // Dismiss any active toasts and show error
      SwapToasts.dismiss(TOAST_IDS.SWAP_STATUS);
      
      // User-friendly error messages
      if (errorMessage.includes('User rejected') || errorMessage.includes('Cancelled')) {
        SwapToasts.error('Transaction cancelled by user');
      } else if (errorMessage.includes('Insufficient')) {
        SwapToasts.error('Insufficient balance for swap');
      } else if (errorMessage.includes('Network')) {
        SwapToasts.error('Network error. Please try again.');
      } else {
        SwapToasts.error(`Swap failed: ${errorMessage}`);
      }

      if (onError) onError(swapError);
    }
  }, [
    inputToken,
    outputToken,
    inputAmount,
    slippageTolerance,
    walletAddress,
    polkadotSigner,
    getOptimalExchanges,
    determineCurrency,
    getTAssetFromKey,
    onSimulationComplete,
    onSuccess,
    onError,
  ]);

  return {
    executeSwap,
    isSwapping,
    swapStatus,
    swapError,
    currentTransactionType,
    currentStep,
    totalSteps,
  };
}

