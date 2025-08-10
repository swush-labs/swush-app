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
  const [fromId, setFromId] = useFromTokenState();
  const [toId, setToId] = useToTokenState();

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

  // Helper function to find asset by ID or symbol (for backward compatibility)
  const findAsset = (idOrSymbol: string): AssetWithId | null => {
    if (!assets.length || !idOrSymbol) return null;
    
    // First try to find by ID (exact match)
    let asset = assets.find(asset => asset.id === idOrSymbol);
    
    // If not found by ID, try symbol for backward compatibility
    if (!asset) {
      asset = assets.find(asset => 
        asset.metadata.symbol.toUpperCase() === idOrSymbol.toUpperCase()
      );
    }
    
    return asset || null;
  };

  // Set default tokens on first load if no IDs are set
  useEffect(() => {
    if (!isInitialized || !assets.length) return;
    
    // Set defaults only if both fromId and toId are empty
    if (!fromId && !toId) {
      const dotAsset = assets.find(asset => 
        asset.metadata.symbol.toUpperCase() === 'DOT'
      );
      const usdtAsset = assets.find(asset => 
        asset.metadata.symbol.toUpperCase() === 'USDT'
      );
      
      if (dotAsset) setFromId(dotAsset.id);
      if (usdtAsset) setToId(usdtAsset.id);
    }
  }, [isInitialized, assets, fromId, toId, setFromId, setToId]);

  // Convert IDs to token objects
  const inputToken = useMemo(() => {
    const asset = findAsset(fromId);
    if (!asset) return null;
    
    return {
      id: asset.id,
      name: asset.metadata.name,
      symbol: asset.metadata.symbol,
      icon: asset.metadata.symbol.charAt(0),
      decimals: asset.metadata.decimals
    };
  }, [assets, fromId]);

  const outputToken = useMemo(() => {
    const asset = findAsset(toId);
    if (!asset) return null;
    
    return {
      id: asset.id,
      name: asset.metadata.name,
      symbol: asset.metadata.symbol,
      icon: asset.metadata.symbol.charAt(0),
      decimals: asset.metadata.decimals
    };
  }, [assets, toId]);

  // Token selection handlers that update URL automatically
  const setInputToken = (token: TokenInfo) => {
    setFromId(token.id);
  };

  const setOutputToken = (token: TokenInfo) => {
    setToId(token.id);
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