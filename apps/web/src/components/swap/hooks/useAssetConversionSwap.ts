import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { AssetWithId, RouteQuote } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import { FrontendTransactionService } from '@/services/FrontendTransactionService';
import { toast } from 'react-hot-toast';
import { getPolkadotSignerFromPjs, SignPayload, SignRaw } from 'polkadot-api/pjs-signer';
import { getWalletBySource } from '@talismn/connect-wallets';
import type { Signer } from '@polkadot/api/types';
import { FrontendConnectionManager } from '@/services/FrontendConnectionManager';
import type { TransactionCallbacks, TransactionStatus } from '@/services/types';
import { safeParse } from '@/components/swap/utils';
import type { XcmV4Location } from '@swush/api';

interface UseAssetConversionSwapProps {
  inputToken: TokenInfo | null;
  outputToken: TokenInfo | null;
  walletAddress: string;
  slippageTolerance: number;
  inputAmount: string;
  outputAmount: string;
  routeState: {
    isLoading: boolean;
    error: string | null;
    data: RouteQuote | null;
  };
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useAssetConversionSwap({
  inputToken,
  outputToken,
  walletAddress,
  slippageTolerance,
  inputAmount,
  outputAmount,
  routeState,
  onSuccess,
  onError
}: UseAssetConversionSwapProps) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapHash, setSwapHash] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<any>(null);

  // Get assets with XCM location information
  const getAssetsWithXcmLocations = useCallback(async (): Promise<Map<string, AssetWithId>> => {
    try {
      const assets = await api.assets.getAll();
      // Create a map of id -> asset for quick lookup
      return new Map(
        assets.map(asset => [asset.id, asset])
      );
    } catch (error) {
      console.error('Failed to fetch assets with XCM locations:', error);
      throw new Error('Failed to prepare swap path. Please try again.');
    }
  }, []);

  // Calculate minimum output amount based on slippage tolerance
  const calculateMinimumOutput = useCallback((amount: string, slippagePercent: number, decimals: number): bigint => {
    if (!amount || parseFloat(amount) <= 0) return BigInt(0);
    
    // Convert to a number, apply slippage, then convert back to string
    const amountFloat = parseFloat(amount);
    const slippageFactor = 1 - (slippagePercent / 100);
    const minimumAmount = amountFloat * slippageFactor;
    
    // Convert to bigint with appropriate precision
    // We multiply by 10^decimals to get the planck format
    return BigInt(Math.floor(minimumAmount * 10 ** decimals));
  }, []);

  // Convert decimal amount to planck format
  const toAssetPlanckFormat = useCallback((amount: string, decimals: number): bigint => {
    if (!amount || parseFloat(amount) <= 0) return BigInt(0);
    
    const amountFloat = parseFloat(amount);
    const amountPlanck = amountFloat * 10 ** decimals;
    return BigInt(Math.floor(amountPlanck));
  }, []);

  // Parse XCM location safely
  const parseXcmLocation = useCallback((rawLocation: any): any => {
    try {
      // If it's already an object, parse its stringified form
      const locationStr = typeof rawLocation === 'string' 
        ? rawLocation 
        : JSON.stringify(rawLocation);
      
      // Parse the location while preserving the exact structure
      const parsed = safeParse<XcmV4Location>(locationStr);
      
      // Return the raw parsed structure without modification
      // This preserves the exact format expected by the pallet
      return parsed;
    } catch (error) {
      console.error('Failed to parse XCM location:', error);
      throw new Error('Invalid XCM location format');
    }
  }, []);

  // Helper function to format dispatch errors for better readability
  const formatDispatchError = useCallback((error: any): string => {
    if (!error) return 'Unknown error';
    
    // Log the raw error object for debugging
    console.log('Raw dispatch error:', JSON.stringify(error, null, 2));
    
    try {
      if (error.type === 'Module') {
        // Handle module-specific errors in a more detailed way
        const moduleError = error.value;
        const moduleName = moduleError.type || 'Unknown';
        const errorName = moduleError.name || moduleError.message || 'Unknown';
        
        // Format detailed error message
        return `${moduleName} Error: ${errorName}`;
      } else if (error.type === 'Token') {
        return `Token Error: ${error.value || 'Unknown token error'}`;
      } else if (error.type === 'Arithmetic') {
        return `Arithmetic Error: ${error.value || 'Calculation failed'}`;
      } else if (error.type === 'BadOrigin') {
        return 'Bad Origin: Transaction not permitted from this account';
      } else if (error.type === 'CannotLookup') {
        return 'Cannot Lookup: Referenced data not found';
      } else if (error.type === 'TooManyConsumers') {
        return 'Too Many Consumers';
      } else if (error.type === 'Other') {
        return `Other Error: ${error.value || 'Unknown'}`;
      } else {
        return `Unknown Error Type: ${error.type}`;
      }
    } catch (e) {
      console.error('Error parsing dispatch error:', e);
      return `Failed to parse error: ${JSON.stringify(error)}`;
    }
  }, []);
  
  // Execute the swap
  const executeSwap = useCallback(async () => {
    if (!inputToken || !outputToken || !walletAddress || !inputAmount || parseFloat(inputAmount) <= 0) {
      toast.error('Invalid swap parameters');
      return;
    }

    try {
      setIsSwapping(true);
      setSwapStatus('Preparing swap...');
      setDispatchError(null);
      
      // Get wallet source from localStorage
      const walletSource = localStorage.getItem('walletSource');
      if (!walletSource) {
        throw new Error('Wallet not connected');
      }
      
      // Get wallet and prepare signer
      const wallet = getWalletBySource(walletSource);
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Enable wallet if not already enabled
      if (!wallet.extension) {
        await wallet.enable('Swush');
      }
      
      // Get signer
      const signer = wallet.signer as Signer;
      const signPayload = signer.signPayload as SignPayload;
      const signRaw = signer.signRaw as SignRaw;
      const polkadotSigner = getPolkadotSignerFromPjs(walletAddress, signPayload, signRaw);
      
      if (!polkadotSigner) {
        throw new Error('Signer not available');
      }
      
      // Get connection
      const connectionManager = FrontendConnectionManager.getInstance();
      const networkId = localStorage.getItem('activeConnection') || 'asset_hub';
      const connection = await connectionManager.getConnection(networkId);
      
      if (!connection || !connection.api) {
        throw new Error('RPC connection is not active. Please reconnect your wallet.');
      }
      
      const polkadotApi = connection.api;
      
      // Fetch assets with XCM locations
      setSwapStatus('Fetching asset information...');
      const assetsMap = await getAssetsWithXcmLocations();
      
      let path: any[] = [];
      let outputAsset;
      
      if (routeState.data && routeState.data.path.length > 0) {
        // Using the route from routeState (which contains the path)
        setSwapStatus('Preparing optimal swap path...');
        console.log('Using path from route:', routeState.data.path);
        
        // Map each asset ID in the path to its XCM location
        for (const assetId of routeState.data.path) {
          const asset = assetsMap.get(assetId);
          if (!asset?.rawXcmLocation) {
            throw new Error(`Missing XCM location for asset in path: ${assetId}`);
          }
          
          // Parse and add the XCM location exactly as is
          path.push(parseXcmLocation(asset.rawXcmLocation));
        }
        
        // Get the last asset in the path for output amount calculation
        const lastAssetId = routeState.data.path[routeState.data.path.length - 1];
        outputAsset = assetsMap.get(lastAssetId);
        
        if (!outputAsset) {
          throw new Error(`Failed to find output asset information for ID: ${lastAssetId}`);
        }
      } else {
        // Fallback to direct path if no route data available
        setSwapStatus('Preparing direct swap path...');
        
        const inputAsset = assetsMap.get(inputToken.id);
        outputAsset = assetsMap.get(outputToken.id);
        
        if (!inputAsset?.rawXcmLocation || !outputAsset?.rawXcmLocation) {
          throw new Error('Missing XCM location information for assets');
        }
        
        path = [
          parseXcmLocation(inputAsset.rawXcmLocation),
          parseXcmLocation(outputAsset.rawXcmLocation)
        ];
      }
      
      // Calculate input amount in planck format
      const inputAsset = assetsMap.get(inputToken.id);
      if (!inputAsset) {
        throw new Error('Failed to find input asset information');
      }
      
      const inputAmountPlanck = toAssetPlanckFormat(inputAmount, inputAsset.metadata.decimals);
      
      // Calculate minimum output amount with slippage
      const minOutputAmountPlanck = calculateMinimumOutput(
        outputAmount,
        slippageTolerance,
        outputAsset.metadata.decimals
      );
      
      setSwapStatus('Creating transaction...');
      console.log('Swap path:', path);
      
      // Build the swap transaction with properly formatted parameters
      const transaction = await polkadotApi.tx.AssetConversion.swap_exact_tokens_for_tokens({
        amount_in: inputAmountPlanck,
        amount_out_min: minOutputAmountPlanck,
        path: path,
        keep_alive: true,
        send_to: walletAddress
      });
      
      setSwapStatus('Signing transaction...');
      
      // Define transaction callbacks
      const callbacks: TransactionCallbacks = {
        onStatusChange: (status: TransactionStatus) => {
          console.log('Swap transaction status:', status);
          
          switch (status.type) {
            case 'signed':
              if (status.txHash) {
                setSwapHash(status.txHash);
                setSwapStatus(`Transaction signed! Hash: ${status.txHash}`);
                toast.loading('Transaction signed, waiting for broadcast...', { id: 'swap-status' });
              }
              break;
              
            case 'broadcasted':
              setSwapStatus('Transaction broadcasted! Waiting for confirmation...');
              toast.loading('Transaction broadcasted, waiting for confirmation...', { id: 'swap-status' });
              break;
              
            case 'txBestBlocksState':
              if (status.blockNumber) {
                setSwapStatus(`Transaction included in block ${status.blockNumber}`);
                toast.loading(`Transaction included in block ${status.blockNumber}, waiting for finalization...`, { id: 'swap-status' });
                
                if (!status.success) {
                  // Store the dispatch error for detailed logging
                  if (status.error) {
                    console.error('Transaction failed with dispatch error:', status.error);
                    setDispatchError(status.error);
                    
                    // Format the error for user display
                    const errorMessage = formatDispatchError(status.error);
                    toast.error(`Transaction failed: ${errorMessage}`, { id: 'swap-status' });
                    setSwapStatus(`Transaction failed: ${errorMessage}`);
                  } else {
                    toast.error('Transaction failed in block', { id: 'swap-status' });
                    setSwapStatus(`Transaction failed: Unknown error`);
                  }
                }
              }
              break;
              
            case 'finalized':
              if (status.success) {
                const blockNum = status.blockNumber ? ` in block ${status.blockNumber}` : '';
                setSwapStatus(`Swap complete${blockNum}!`);
                toast.success('Swap completed successfully! 🎉', { 
                  id: 'swap-status',
                  duration: 5000,
                  icon: '✅'
                });
                
                // Log transaction events for debugging purposes
                if (status.events && status.events.length > 0) {
                  console.log('Transaction events:', status.events);
                }
              } else if (status.error) {
                // Handle finalized but failed transaction
                console.error('Transaction finalized but failed with error:', status.error);
                setDispatchError(status.error);
                const errorMessage = formatDispatchError(status.error);
                toast.error(`Swap failed: ${errorMessage}`, { id: 'swap-status' });
                setSwapStatus(`Failed: ${errorMessage}`);
              }
              break;
          }
        },
        onSuccess: (status: TransactionStatus) => {
          console.log('Swap transaction successful', status);
          setIsSwapping(false);
          if (onSuccess) onSuccess();
        },
        onError: (error: Error) => {
          console.error('Swap transaction error:', error);
          
          // Check if this is a dispatch error from the blockchain
          if (error.message && error.message.includes('dispatch error')) {
            console.error('Dispatch error details:', dispatchError);
          }
          
          setSwapStatus(`Failed: ${error.message}`);
          toast.error(`Swap failed: ${error.message}`, { id: 'swap-status' });
          setIsSwapping(false);
          if (onError) onError(error);
        }
      };
      
      // Execute the transaction
      await FrontendTransactionService.signSubmitAndWatch(
        transaction,
        polkadotSigner,
        callbacks
      );
      
    } catch (error) {
      console.error('Error executing swap:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSwapStatus(`Failed: ${errorMessage}`);
      toast.error(`Error executing swap: ${errorMessage}`, { id: 'swap-status' });
      setIsSwapping(false);
      if (onError) onError(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [
    inputToken, outputToken, walletAddress, inputAmount, outputAmount,
    slippageTolerance, routeState, getAssetsWithXcmLocations, 
    calculateMinimumOutput, toAssetPlanckFormat, parseXcmLocation,
    formatDispatchError, dispatchError, onSuccess, onError
  ]);

  return {
    isSwapping,
    swapHash,
    swapStatus,
    dispatchError,
    executeSwap
  };
} 