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
  'Sepolia',
  'Arbitrum',
  'Arbitrum Sepolia',
  'Solana',
  'Bitcoin',
  'AssetHubPerseverance',
  'SolanaDevnet',
] as const;

export type AssetRegistryEntry = {
  symbol: string;
  name: string;
  description?: string;
  category: "stablecoin" | "native" | "defi" | "wrapped";
  logo?: string;
  coingeckoId?: string;  // CoinGecko API ID for price lookup
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
    // Note: EVM chain ID is derived from network name via getEvmChainId() in kheopskit.ts
  }>;
};

/**
 * Check if a network is Chainflip-only (non-Polkadot ecosystem)
 * @param network - Network name to check
 * @returns true if network requires Chainflip (Ethereum, Arbitrum, Solana, Bitcoin)
 */
export const isChainflipOnlyNetwork = (network: string | undefined): boolean => {
  if (!network) return false;
  return CHAINFLIP_ONLY_NETWORKS.includes(network as typeof CHAINFLIP_ONLY_NETWORKS[number]);
};

/**
 * Determine which swap provider to use based on source and destination networks
 *
 * Chainflip is used ONLY when:
 * 1. BOTH tokens have valid chainflipId (checked separately in useSwapRouter)
 * 2. At least ONE network is Chainflip-only (Ethereum, Arbitrum, Solana, Bitcoin)
 *
 * For Polkadot ecosystem swaps (AssetHub ↔ Hydration, etc.), always use XCM
 * even if tokens have chainflipId configured.
 *
 * @param sourceNetwork - Source chain/network name
 * @param destNetwork - Destination chain/network name
 * @returns 'chainflip' if cross-ecosystem swap, 'xcm' for Polkadot ecosystem
 */
export const getSwapProvider = (
  sourceNetwork: string | undefined,
  destNetwork: string | undefined
): SwapProvider => {
  if (!sourceNetwork || !destNetwork) return 'xcm';

  const isSourceChainflipOnly = isChainflipOnlyNetwork(sourceNetwork);
  const isDestChainflipOnly = isChainflipOnlyNetwork(destNetwork);

  // If either network is Chainflip-only (Ethereum, Arbitrum, Solana, Bitcoin), use Chainflip
  // Note: This requires both tokens to have chainflipId (validated in useSwapRouter)
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
    logo: "/tokens/usdc.png",
    coingeckoId: "usd-coin",
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
      "USDC-1337-AssetHubPerseverance": {
        network: "AssetHubPerseverance",
        assetType: "Asset ID",
        displayName: "USDC (AssetHub Perseverance)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdc.hub',
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
      "USDC-Sepolia": {
        network: "Sepolia",
        assetType: "Native",
        displayName: "USDC (Sepolia)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdc.eth',
        decimals: 6,
        contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
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
      "USDC-ArbitrumSepolia": {
        network: "Arbitrum Sepolia",
        assetType: "Native",
        displayName: "USDC (Arbitrum Sepolia)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdc.arb',
        decimals: 6,
        contractAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',  // USDC on Arbitrum Sepolia
      },
      "USDC-Solana": {
        network: "Solana",
        assetType: "Native",
        displayName: "USDC (Solana)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdc.sol',
        decimals: 6,
        // Solana uses different chain identification, not EVM chainId
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
    logo: "/tokens/usdt.png",
    coingeckoId: "tether",
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
      "USDt-1984-AssetHubPerseverance": {
        network: "AssetHubPerseverance",
        assetType: "Asset ID",
        displayName: "USDt (AssetHub Perseverance)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdt.hub',
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
      "USDT-Sepolia": {
        network: "Sepolia",
        assetType: "Native",
        displayName: "USDT (Sepolia)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'usdt.eth',
        decimals: 6,
        // Note: Add testnet USDT contract address when available
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
    logo: "/tokens/dot.jpg",
    coingeckoId: "polkadot",
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
      // ─── Chainflip Testnet ───
      "DOT-native-AssetHubPerseverance": {
        network: "AssetHubPerseverance",
        assetType: "Multi-Location",
        displayName: "DOT (AssetHub Perseverance)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'dot.hub',
        decimals: 10,
      },
    }
  },

  "ACA": {
    symbol: "ACA",
    name: "Acala",
    description: "Acala native token",
    category: "native",
    logo: "/tokens/aca.jpg",
    coingeckoId: "acala",
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
    logo: "/tokens/glmr.png",
    coingeckoId: "moonbeam",
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
    logo: "/tokens/eth.png",
    coingeckoId: "ethereum",
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
      "ETH-Sepolia": {
        network: "Sepolia",
        assetType: "Native",
        displayName: "ETH (Sepolia)",
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
      "ETH-ArbitrumSepolia": {
        network: "Arbitrum Sepolia",
        assetType: "Native",
        displayName: "ETH (Arbitrum Sepolia)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'eth.arb',
        decimals: 18,
      },
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SOL - Chainflip only (Solana Mainnet and Devnet)
  // ═══════════════════════════════════════════════════════════════════════════════
  "SOL": {
    symbol: "SOL",
    name: "Solana",
    description: "Native Solana token",
    category: "native",
    logo: "/tokens/sol.png",
    coingeckoId: "solana",
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
      "SOL-SolanaDevnet": {
        network: "SolanaDevnet",
        assetType: "Native",
        displayName: "SOL (Solana Devnet)",
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
    logo: "/tokens/btc.png",
    coingeckoId: "bitcoin",
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
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLIP - Chainflip native token (Ethereum/Sepolia)
  // ═══════════════════════════════════════════════════════════════════════════════
  "FLIP": {
    symbol: "FLIP",
    name: "Chainflip",
    description: "Chainflip native token",
    category: "native",
    logo: "/tokens/flip.png",
    coingeckoId: "chainflip",
    networkInstances: {
      "FLIP-Ethereum": {
        network: "Ethereum",
        assetType: "Native",
        displayName: "FLIP (Ethereum)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'flip.eth',
        decimals: 18,
        contractAddress: '0x826180541412D574cf1336d22c0C0a287822678A',
      },
      "FLIP-Sepolia": {
        network: "Sepolia",
        assetType: "Native",
        displayName: "FLIP (Sepolia)",
        verified: true,
        provider: 'chainflip',
        chainflipId: 'flip.eth',
        decimals: 18,
        contractAddress: '0xdC27c60956cB065D19F08bb69a707E37b36d8086', // tFLIP on Sepolia
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

