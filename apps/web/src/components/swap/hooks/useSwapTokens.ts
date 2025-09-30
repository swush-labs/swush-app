import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import type { AssetWithId } from '@/lib/api';
import type { TokenInfo } from '@/components/swap/types';
import { toast } from 'react-hot-toast';
import { useFromTokenState, useToTokenState } from './utils/queryParams';

// Optional dummy assets mode (set NEXT_PUBLIC_USE_DUMMY_ASSETS=true)
const USE_DUMMY_ASSETS = true; // TO DO: replace it with working api

// Comprehensive dummy assets representing Polkadot ecosystem networks and tokens
// Cast as AssetWithId[] to satisfy types without importing full backend Asset shape
const DUMMY_ASSETS = [
  // Polkadot Relay Chain
  {
    id: '0',
    metadata: { name: 'Polkadot', symbol: 'DOT', decimals: 10, network: 'Polkadot' }
  },
  // Kusama Relay Chain
  {
    id: '1',
    metadata: { name: 'Kusama', symbol: 'KSM', decimals: 12, network: 'Kusama' }
  },
  // Asset Hub (Polkadot)
  {
    id: '2',
    metadata: { name: 'USDT', symbol: 'USDT', decimals: 6, network: 'Asset Hub' }
  },
  {
    id: '3',
    metadata: { name: 'USDC', symbol: 'USDC', decimals: 6, network: 'Asset Hub' }
  },
  {
    id: '4',
    metadata: { name: 'WETH', symbol: 'WETH', decimals: 18, network: 'Asset Hub' }
  },
  {
    id: '5',
    metadata: { name: 'WBTC', symbol: 'WBTC', decimals: 8, network: 'Asset Hub' }
  },
  // Hydration (Liquid Staking)
  {
    id: '6',
    metadata: { name: 'USDT', symbol: 'USDT', decimals: 6, network: 'Hydration' }
  },
  {
    id: '7',
    metadata: { name: 'USDC', symbol: 'USDC', decimals: 6, network: 'Hydration' }
  },
  {
    id: '8',
    metadata: { name: 'hDOT', symbol: 'hDOT', decimals: 10, network: 'Hydration' }
  },
  // Bifrost (Liquid Staking)
  {
    id: '9',
    metadata: { name: 'USDT', symbol: 'USDT', decimals: 6, network: 'Bifrost' }
  },
  {
    id: '10',
    metadata: { name: 'USDC', symbol: 'USDC', decimals: 6, network: 'Bifrost' }
  },
  {
    id: '11',
    metadata: { name: 'vDOT', symbol: 'vDOT', decimals: 10, network: 'Bifrost' }
  },
  {
    id: '12',
    metadata: { name: 'vKSM', symbol: 'vKSM', decimals: 12, network: 'Bifrost' }
  },
  // Acala (DeFi Hub)
  {
    id: '13',
    metadata: { name: 'ACA', symbol: 'ACA', decimals: 12, network: 'Acala' }
  },
  {
    id: '14',
    metadata: { name: 'aUSD', symbol: 'aUSD', decimals: 12, network: 'Acala' }
  },
  {
    id: '15',
    metadata: { name: 'USDT', symbol: 'USDT', decimals: 6, network: 'Acala' }
  },
  // Moonbeam (EVM Compatible)
  {
    id: '16',
    metadata: { name: 'GLMR', symbol: 'GLMR', decimals: 18, network: 'Moonbeam' }
  },
  {
    id: '17',
    metadata: { name: 'USDT', symbol: 'USDT', decimals: 6, network: 'Moonbeam' }
  },
  {
    id: '18',
    metadata: { name: 'USDC', symbol: 'USDC', decimals: 6, network: 'Moonbeam' }
  },
  // Astar (Smart Contracts)
  {
    id: '19',
    metadata: { name: 'ASTR', symbol: 'ASTR', decimals: 18, network: 'Astar' }
  },
  {
    id: '20',
    metadata: { name: 'USDT', symbol: 'USDT', decimals: 6, network: 'Astar' }
  },
  // Parallel Finance (Lending)
  {
    id: '21',
    metadata: { name: 'PARA', symbol: 'PARA', decimals: 12, network: 'Parallel' }
  },
  {
    id: '22',
    metadata: { name: 'USDT', symbol: 'USDT', decimals: 6, network: 'Parallel' }
  }
] as unknown as AssetWithId[];

export function useSwapTokens() {
  const [assets, setAssets] = useState<AssetWithId[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Use centralized query params configuration - store token IDs to preserve network
  const [fromTokenId, setFromTokenId] = useFromTokenState();
  const [toTokenId, setToTokenId] = useToTokenState();

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
      } catch (error) {
        console.error('Failed to fetch assets:', error);
      }
    };

    fetchAssets();
  }, [isInitialized]);

  // Helper function to convert asset to TokenInfo
  const assetToToken = (asset: AssetWithId): TokenInfo => ({
    id: asset.id,
    name: asset.metadata.name,
    symbol: asset.metadata.symbol,
    icon: asset.metadata.symbol.charAt(0),
    decimals: asset.metadata.decimals,
    network: (asset.metadata as unknown as { network?: string }).network || 'Unknown'
  });

  // Convert token IDs to token objects
  const inputToken = useMemo(() => {
    if (!assets.length || !fromTokenId) return null;
    const asset = assets.find(a => a.id === fromTokenId);
    return asset ? assetToToken(asset) : null;
  }, [assets, fromTokenId]);

  const outputToken = useMemo(() => {
    if (!assets.length || !toTokenId) return null;
    const asset = assets.find(a => a.id === toTokenId);
    return asset ? assetToToken(asset) : null;
  }, [assets, toTokenId]);

  // Token selection handlers that update URL with token ID
  const setInputToken = (token: TokenInfo) => {
    setFromTokenId(token.id);
  };

  const setOutputToken = (token: TokenInfo) => {
    setToTokenId(token.id);
  };

  // Convert assets to tokens for selection
  const tokens = useMemo(() => assets.map(assetToToken), [assets]);

  return {
    inputToken,
    setInputToken,
    outputToken,
    setOutputToken,
    tokens,
  };
} 