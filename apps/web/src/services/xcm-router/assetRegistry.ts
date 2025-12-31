import type { TExchangeChain } from "@paraspell/xcm-router";

// ═══════════════════════════════════════════════════════════════════════════════
// Swap Provider Types - XCM (Polkadot ecosystem) vs Chainflip (cross-chain)
// ═══════════════════════════════════════════════════════════════════════════════

export type SwapProvider = 'xcm' | 'chainflip';

// Chainflip supported chains (from https://chainflip-broker.io)
// AssetHub = Polkadot Asset Hub (NOT relay chain Polkadot)
export const CHAINFLIP_CHAINS = [
  'Ethereum',
  'Arbitrum',
  'Solana',
  'AssetHub',  // Chainflip uses "AssetHub" for Polkadot Asset Hub
  'Bitcoin',
] as const;

export type ChainflipChain = typeof CHAINFLIP_CHAINS[number];

// Networks that are part of the Polkadot ecosystem (XCM-capable)
export const POLKADOT_ECOSYSTEM_NETWORKS = [
  'Polkadot',
  'AssetHubPolkadot',
  'Hydration',
  'Moonbeam',
  'Acala',
  'BifrostPolkadot',
  'Astar',
  'Interlay',
  'Centrifuge',
  'Unique',
  'Zeitgeist',
] as const;

// Networks that require Chainflip for cross-chain swaps (non-Polkadot ecosystem)
export const CHAINFLIP_ONLY_NETWORKS = [
  'Ethereum',
  'Arbitrum',
  'Solana',
  'Bitcoin',
] as const;

export type AssetRegistryEntry = {
  symbol: string;
  name: string;
  description?: string;
  category: "stablecoin" | "native" | "defi" | "wrapped";
  logo?: string;
  dexConfig?: {
    preferredExchange?: TExchangeChain;
  };
  // Map of keys from useCurrencyOptions to network info
  networkInstances: Record<string, {
    network: string;
    assetType: "Native" | "Asset ID" | "Multi-Location";
    displayName: string;
    verified?: boolean;
    // Chainflip-specific fields
    provider?: SwapProvider;          // 'xcm' (default) or 'chainflip'
    chainflipId?: string;             // Chainflip compound asset ID (e.g., "dot.hub", "usdc.arb")
    decimals?: number;                // Token decimals (required for Chainflip)
    contractAddress?: string;         // ERC20/SPL contract address
    assetId?: string;                 // Polkadot asset ID for Assets pallet (e.g., "1337" for USDC)
  }>;
};

/**
 * Determine which swap provider to use based on source and destination networks
 * @param sourceNetwork - Source chain/network name
 * @param destNetwork - Destination chain/network name
 * @returns 'chainflip' if cross-ecosystem swap, 'xcm' for Polkadot ecosystem
 */
export const getSwapProvider = (
  sourceNetwork: string | undefined,
  destNetwork: string | undefined
): SwapProvider => {
  if (!sourceNetwork || !destNetwork) return 'xcm';
  
  const isSourceChainflipOnly = CHAINFLIP_ONLY_NETWORKS.includes(sourceNetwork as typeof CHAINFLIP_ONLY_NETWORKS[number]);
  const isDestChainflipOnly = CHAINFLIP_ONLY_NETWORKS.includes(destNetwork as typeof CHAINFLIP_ONLY_NETWORKS[number]);
  
  // If either network is Chainflip-only (Ethereum, Arbitrum, Solana, Bitcoin), use Chainflip
  if (isSourceChainflipOnly || isDestChainflipOnly) {
    return 'chainflip';
  }
  
  // Both are Polkadot ecosystem, use XCM
  return 'xcm';
};

// Simple registry mapping keys from useCurrencyOptions.ts to asset info
export const ASSET_REGISTRY: Record<string, AssetRegistryEntry> = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // USDC - Available on XCM chains AND Chainflip chains
  // ═══════════════════════════════════════════════════════════════════════════════
  "USDC": {
    symbol: "USDC",
    name: "USD Coin",
    description: "USD-backed stablecoin by Circle",
    category: "stablecoin",
    networkInstances: {
      // ─── XCM Networks ───
      "USDC-1337-AssetHubPolkadot": {
        network: "AssetHubPolkadot",
        assetType: "Asset ID",
        displayName: "USDC (AssetHub)",
        verified: true,
        provider: 'xcm',
        chainflipId: 'usdc.hub',  // Available for Chainflip cross-ecosystem swaps
        decimals: 6,
        assetId: "1337",  // Asset ID for Assets.transfer call
      },
      "USDC-22-Hydration": {
        network: "Hydration",
        assetType: "Asset ID",
        displayName: "USDC (Hydration)",
        verified: true,
        provider: 'xcm',
      },
      "USDC-5-BifrostPolkadot": {
        network: "BifrostPolkadot",
        assetType: "Asset ID",
        displayName: "USDC (BifrostPolkadot)",
        verified: true,
        provider: 'xcm',
      },
      // ─── Chainflip Networks ───
      "USDC-Ethereum": {
        network: "Ethereum",
        assetType: "Native",
        displayName: "USDC (Ethereum)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdc.eth',
        decimals: 6,
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      "USDC-Arbitrum": {
        network: "Arbitrum",
        assetType: "Native",
        displayName: "USDC (Arbitrum)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdc.arb',
        decimals: 6,
        contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      },
      "USDC-Solana": {
        network: "Solana",
        assetType: "Native",
        displayName: "USDC (Solana)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdc.sol',
        decimals: 6,
      },
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // USDT - Available on XCM chains AND Chainflip (Ethereum)
  // ═══════════════════════════════════════════════════════════════════════════════
  "USDT": {
    symbol: "USDT",
    name: "Tether USD",
    description: "Tether USD stablecoin",
    category: "stablecoin",
    networkInstances: {
      // ─── XCM Networks ───
      "USDt-1984-AssetHubPolkadot": {
        network: "AssetHubPolkadot",
        assetType: "Asset ID",
        displayName: "USDt (AssetHubPolkadot)",
        verified: true,
        provider: 'xcm',
        chainflipId: 'usdt.hub',  // Available for Chainflip cross-ecosystem swaps
        decimals: 6,
        assetId: "1984",  // Asset ID for Assets.transfer call
      },
      "USDT-10-Hydration": {
        network: "Hydration",
        assetType: "Asset ID",
        displayName: "USDT (Hydration)",
        verified: true,
        provider: 'xcm',
      },
      "USDT-10-BifrostPolkadot": {
        network: "BifrostPolkadot",
        assetType: "Asset ID",
        displayName: "USDT (BifrostPolkadot)",
        verified: true,
        provider: 'xcm',
      },
      // ─── Chainflip Networks ───
      "USDT-Ethereum": {
        network: "Ethereum",
        assetType: "Native",
        displayName: "USDT (Ethereum)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdt.eth',
        decimals: 6,
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      },
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DOT - Available on XCM chains AND Chainflip
  // ═══════════════════════════════════════════════════════════════════════════════
  "DOT": {
    symbol: "DOT",
    name: "Polkadot",
    description: "Polkadot native token",
    category: "native",
    networkInstances: {
      // ─── XCM Networks ───
      "DOT-native-AssetHubPolkadot": {
        network: "AssetHubPolkadot",
        assetType: "Multi-Location",
        displayName: "DOT (Native)",
        verified: true,
        provider: 'xcm',
        chainflipId: 'dot.hub',  // Available for Chainflip cross-ecosystem swaps
        decimals: 10,
      },
      "DOT-5-Hydration": {
        network: "Hydration",
        assetType: "Asset ID",
        displayName: "DOT (HydraDx)",
        verified: true,
        provider: 'xcm',
      },
      "DOT-native-Acala": {
        network: "Acala",
        assetType: "Multi-Location",
        displayName: "DOT (Acala)",
        verified: true,
        provider: 'xcm',
      },
      "DOT-0-BifrostPolkadot": {
        network: "BifrostPolkadot",
        assetType: "Asset ID",
        displayName: "DOT (BifrostPolkadot)",
        verified: true,
        provider: 'xcm',
      },
    }
  },

  "ACA": {
    symbol: "ACA",
    name: "Acala",
    description: "Acala native token",
    category: "native",
    networkInstances: {
      "ACA-native-Acala": {
        network: "Acala",
        assetType: "Native",
        displayName: "ACA (Native)",
        verified: true,
        provider: 'xcm',
      },
    }
  },

  "GLMR": {
    symbol: "GLMR",
    name: "Moonbeam",
    description: "Moonbeam native token",
    category: "native",
    networkInstances: {
      "GLMR-native-Moonbeam": {
        network: "Moonbeam",
        assetType: "Native",
        displayName: "GLMR (Native)",
        verified: true,
        provider: 'xcm',
      },
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ETH - Chainflip only (Ethereum and Arbitrum)
  // ═══════════════════════════════════════════════════════════════════════════════
  "ETH": {
    symbol: "ETH",
    name: "Ethereum",
    description: "Native Ethereum token",
    category: "native",
    networkInstances: {
      "ETH-Ethereum": {
        network: "Ethereum",
        assetType: "Native",
        displayName: "ETH (Ethereum)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'eth.eth',
        decimals: 18,
      },
      "ETH-Arbitrum": {
        network: "Arbitrum",
        assetType: "Native",
        displayName: "ETH (Arbitrum)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'eth.arb',
        decimals: 18,
      },
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SOL - Chainflip only (Solana)
  // ═══════════════════════════════════════════════════════════════════════════════
  "SOL": {
    symbol: "SOL",
    name: "Solana",
    description: "Native Solana token",
    category: "native",
    networkInstances: {
      "SOL-Solana": {
        network: "Solana",
        assetType: "Native",
        displayName: "SOL (Solana)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'sol.sol',
        decimals: 9,
      },
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // BTC - Chainflip only (Bitcoin)
  // ═══════════════════════════════════════════════════════════════════════════════
  "BTC": {
    symbol: "BTC",
    name: "Bitcoin",
    description: "Native Bitcoin",
    category: "native",
    networkInstances: {
      "BTC-Bitcoin": {
        network: "Bitcoin",
        assetType: "Native",
        displayName: "BTC (Bitcoin)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'btc.btc',
        decimals: 8,
      },
    }
  }

 /*  "ASTR": {
    symbol: "ASTR",
    name: "Astar",
    description: "Astar native token",
    category: "native",
    networkInstances: {
      "ASTR-native-Astar": {
        network: "Astar",
        assetType: "Native",
        displayName: "ASTR (Native)",
        verified: true
      },
    }
  },

  "KSM": {
    symbol: "KSM",
    name: "Kusama",
    description: "Kusama native token",
    category: "native",
    networkInstances: {
      "KSM-native-Kusama": {
        network: "Kusama",
        assetType: "Native",
        displayName: "KSM (Native)",
        verified: true
      },
    }
  },

  "BNC": {
    symbol: "BNC",
    name: "Bifrost",
    description: "Bifrost native token",
    category: "native",
    networkInstances: {
      "BNC-native-BifrostPolkadot": {
        network: "BifrostPolkadot",
        assetType: "Native",
        displayName: "BNC (Native)",
        verified: true
      },
    }
  },

  "HDX": {
    symbol: "HDX",
    name: "HydraDX",
    description: "HydraDX native token",
    category: "native",
    networkInstances: {
      "HDX-native-Hydration": {
        network: "Hydration",
        assetType: "Native",
        displayName: "HDX (HydraDx)",
        verified: true
      },
    }
  },

  // Additional common assets
  "WETH": {
    symbol: "WETH",
    name: "Wrapped Ethereum",
    description: "Wrapped Ethereum token",
    category: "wrapped",
    networkInstances: {
      "WETH-native-Various": {
        network: "Various",
        assetType: "Multi-Location",
        displayName: "WETH (Cross-Chain)",
        verified: true
      },
    }
  },

  "WBTC": {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    description: "Wrapped Bitcoin token",
    category: "wrapped",
    networkInstances: {
      "WBTC-native-Various": {
        network: "Various",
        assetType: "Multi-Location",
        displayName: "WBTC (Cross-Chain)",
        verified: true
      },
    }
  },

 
 */
};


// DEX compatibility matrix based on your asset registry
export const DEX_CHAIN_COMPATIBILITY: Record<string, string[]> = {
  "HydrationDex": ["AssetHubPolkadot", "Hydration", "Moonbeam", "Acala", "BifrostPolkadot", "Moonbeam"],
  "AssetHubPolkadotDex": ["AssetHubPolkadot", "Hydration", "Acala", "BifrostPolkadot", "Moonbeam"],

  "AcalaDex": ["Acala", "Hydration", "AssetHubPolkadot"],
  "BifrostKusamaDex": ["BifrostKusama"],
  "BifrostPolkadotDex": ["BifrostPolkadot", "Hydration", "AssetHubPolkadot"],
};

