import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import type { AssetWithId } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import { toast } from 'react-hot-toast';

export function useSwapTokens() {
  const [inputToken, setInputToken] = useState<TokenInfo | null>(null);
  const [outputToken, setOutputToken] = useState<TokenInfo | null>(null);
  const [assets, setAssets] = useState<AssetWithId[]>([]);

  // Fetch assets only once during initialization
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const fetchedAssets = await api.assets.getAll();
        setAssets(fetchedAssets);
        
        // Set default tokens only if both are not set
        if (!inputToken && !outputToken) {
          // Find default input token (DOT)
          const defaultInput = fetchedAssets.find(asset => 
            asset.metadata.symbol.toUpperCase() === 'DOT'
          );
          const inputTokenToSet = defaultInput || fetchedAssets[0];
          
          // Find default output token (ETH)
          const defaultOutput = fetchedAssets.find(asset => 
            asset.metadata.symbol.toUpperCase() === 'USDT'
          );
          const outputTokenToSet = defaultOutput || fetchedAssets[1];

          // Set both tokens at once to avoid multiple re-renders
          if (inputTokenToSet) {
            setInputToken({
              id: inputTokenToSet.id,
              name: inputTokenToSet.metadata.name,
              symbol: inputTokenToSet.metadata.symbol,
              icon: inputTokenToSet.metadata.symbol.charAt(0),
              decimals: inputTokenToSet.metadata.decimals
            });
          }
          
          if (outputTokenToSet) {
            setOutputToken({
              id: outputTokenToSet.id,
              name: outputTokenToSet.metadata.name,
              symbol: outputTokenToSet.metadata.symbol,
              icon: outputTokenToSet.metadata.symbol.charAt(0),
              decimals: outputTokenToSet.metadata.decimals
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch assets:', error);
        toast.error('Failed to load assets');
      }
    };

    fetchAssets();
  }, []); // Empty dependency array since we only want this to run once

  const tokens = useMemo(() => assets.map(asset => ({
    id: asset.id,
    name: asset.metadata.name,
    symbol: asset.metadata.symbol,
    icon: asset.metadata.symbol.charAt(0),
    decimals: asset.metadata.decimals
  })), [assets]);

  return {
    inputToken,
    setInputToken,
    outputToken,
    setOutputToken,
    tokens,
  };
} 