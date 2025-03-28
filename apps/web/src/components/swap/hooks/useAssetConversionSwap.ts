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
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';
import type { TransactionCallbacks } from '@/services/types';
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

  // Format XCM location for the extrinsic
  const formatXcmLocation = useCallback((rawLocation: any): any => {
    try {
      console.log('Raw XCM location input:', rawLocation);
      
      // The rawXcmLocation from the API has already been processed by safeStringify
      // We just need to ensure it's in the correct format for the extrinsic
      const formatted = {
        parents: Number(rawLocation.parents || 0),
        interior: rawLocation.interior || { here: null }
      };
      
      // Handle any bigint strings that might be in the interior
      if (formatted.interior && typeof formatted.interior === 'object') {
        const processValue = (value: any): any => {
          if (typeof value === 'string' && value.startsWith('bigint:')) {
            return BigInt(value.slice(7));
          }
          if (Array.isArray(value)) {
            return value.map(processValue);
          }
          if (typeof value === 'object' && value !== null) {
            return Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, processValue(v)])
            );
          }
          return value;
        };
        
        formatted.interior = processValue(formatted.interior);
      }
      
      console.log('Formatted XCM location:', formatted);
      return formatted;
    } catch (error) {
      console.error('Failed to format XCM location:', error);
      throw new Error('Invalid XCM location format');
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
          
          // Format the XCM location for the extrinsic
          path.push(formatXcmLocation(asset.rawXcmLocation));
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
          formatXcmLocation(inputAsset.rawXcmLocation),
          formatXcmLocation(outputAsset.rawXcmLocation)
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
        onStatusChange: (status) => {
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
                  toast.error('Transaction failed in block', { id: 'swap-status' });
                  setSwapStatus(`Transaction failed: ${status.error || 'Unknown error'}`);
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
              }
              break;
          }
        },
        onSuccess: () => {
          console.log('Swap transaction successful');
          setIsSwapping(false);
          if (onSuccess) onSuccess();
        },
        onError: (error) => {
          console.error('Swap transaction error:', error);
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
    calculateMinimumOutput, toAssetPlanckFormat, formatXcmLocation,
    onSuccess, onError
  ]);

  return {
    isSwapping,
    swapHash,
    swapStatus,
    executeSwap
  };
} 