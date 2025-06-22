import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import type { AssetWithId } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import { toast } from 'react-hot-toast';
import { useFromTokenState, useToTokenState } from './utils/queryParams';

export function useSwapTokens() {
  const [assets, setAssets] = useState<AssetWithId[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Use centralized query params configuration
  const [fromSymbol, setFromSymbol] = useFromTokenState();
  const [toSymbol, setToSymbol] = useToTokenState();

  // Fetch assets only once during initialization
  useEffect(() => {
    if (isInitialized) return;
    
    const fetchAssets = async () => {
      try {
        const fetchedAssets = await api.assets.getAll();
        setAssets(fetchedAssets);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to fetch assets:', error);
        toast.error('Failed to load assets');
      }
    };

    fetchAssets();
  }, [isInitialized]);

  // Convert symbols to token objects
  const inputToken = useMemo(() => {
    if (!assets.length || !fromSymbol) return null;
    
    const asset = assets.find(asset => 
      asset.metadata.symbol.toUpperCase() === fromSymbol.toUpperCase()
    );
    
    if (!asset) return null;
    
    return {
      id: asset.id,
      name: asset.metadata.name,
      symbol: asset.metadata.symbol,
      icon: asset.metadata.symbol.charAt(0),
      decimals: asset.metadata.decimals
    };
  }, [assets, fromSymbol]);

  const outputToken = useMemo(() => {
    if (!assets.length || !toSymbol) return null;
    
    const asset = assets.find(asset => 
      asset.metadata.symbol.toUpperCase() === toSymbol.toUpperCase()
    );
    
    if (!asset) return null;
    
    return {
      id: asset.id,
      name: asset.metadata.name,
      symbol: asset.metadata.symbol,
      icon: asset.metadata.symbol.charAt(0),
      decimals: asset.metadata.decimals
    };
  }, [assets, toSymbol]);

  // Token selection handlers that update URL automatically
  const setInputToken = (token: TokenInfo) => {
    setFromSymbol(token.symbol);
  };

  const setOutputToken = (token: TokenInfo) => {
    setToSymbol(token.symbol);
  };

  // Convert assets to tokens for selection
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