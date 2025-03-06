import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import type { AssetWithId } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import { toast } from 'react-hot-toast';

export function useSwapTokens() {
  const [inputToken, setInputToken] = useState<TokenInfo | null>(null);
  const [outputToken, setOutputToken] = useState<TokenInfo | null>(null);
  const [assets, setAssets] = useState<AssetWithId[]>([]);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const fetchedAssets = await api.assets.getAll();
        setAssets(fetchedAssets);
        
        // Set default tokens if not already set
        if (!inputToken) {
          const defaultInput = fetchedAssets.find(asset => 
            asset.metadata.symbol.toUpperCase() === 'DOT'
          );
          if (defaultInput) {
            setInputToken({
              id: defaultInput.id,
              name: defaultInput.metadata.name,
              symbol: defaultInput.metadata.symbol,
              icon: defaultInput.metadata.symbol.charAt(0),
            });
          } else {
            const firstAsset = fetchedAssets[0];
            if (firstAsset) {
              setInputToken({
                id: firstAsset.id,
                name: firstAsset.metadata.name,
                symbol: firstAsset.metadata.symbol,
                icon: firstAsset.metadata.symbol.charAt(0),
              });
            }
          }
        }
        
        if (!outputToken) {
          const defaultOutput = fetchedAssets.find(asset => 
            asset.metadata.symbol.toUpperCase() === 'ETH'
          );
          if (defaultOutput) {
            setOutputToken({
              id: defaultOutput.id,
              name: defaultOutput.metadata.name,
              symbol: defaultOutput.metadata.symbol,
              icon: defaultOutput.metadata.symbol.charAt(0),
            });
          } else {
            const secondAsset = fetchedAssets[1];
            if (secondAsset) {
              setOutputToken({
                id: secondAsset.id,
                name: secondAsset.metadata.name,
                symbol: secondAsset.metadata.symbol,
                icon: secondAsset.metadata.symbol.charAt(0),
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch assets:', error);
        toast.error('Failed to load assets');
      }
    };

    fetchAssets();
  }, [inputToken, outputToken]);

  const tokens = useMemo(() => assets.map(asset => ({
    id: asset.id,
    name: asset.metadata.name,
    symbol: asset.metadata.symbol,
    icon: asset.metadata.symbol.charAt(0),
  })), [assets]);

  return {
    inputToken,
    setInputToken,
    outputToken,
    setOutputToken,
    tokens,
  };
} 