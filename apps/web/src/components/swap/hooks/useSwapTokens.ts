import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import type { AssetWithId } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import { toast } from 'react-hot-toast';
import { useFromTokenState, useToTokenState } from './utils/queryParams';

// Optional dummy assets mode (set NEXT_PUBLIC_USE_DUMMY_ASSETS=true)
const USE_DUMMY_ASSETS = true; // TO DO: replace it with working api

// Minimal dummy assets to keep app functional without backend
// Cast as AssetWithId[] to satisfy types without importing full backend Asset shape
const DUMMY_ASSETS = [
  {
    id: '0',
    metadata: { name: 'Polkadot', symbol: 'DOT', decimals: 10 }
  },
  {
    id: '1',
    metadata: { name: 'Kusama', symbol: 'KSM', decimals: 12 }
  },
  {
    id: '2',
    metadata: { name: 'USDT', symbol: 'USDT', decimals: 6 }
  }
] as unknown as AssetWithId[];

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
        // Allow bypassing API with dummy data when flag is enabled
        if (USE_DUMMY_ASSETS) {
          setAssets(DUMMY_ASSETS);
          setIsInitialized(true);
          return;
        }

        const fetchedAssets = await api.assets.getAll();
        setAssets(fetchedAssets);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to fetch assets:', error);
        // Fallback to dummy assets on failure to keep the app usable
        setAssets(DUMMY_ASSETS);
        setIsInitialized(true);
        toast.error('Failed to load assets from API. Using dummy data.');
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