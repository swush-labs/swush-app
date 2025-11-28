import type { TExchangeChain } from "@paraspell/xcm-router";

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
  }>;
};

// Simple registry mapping keys from useCurrencyOptions.ts to asset info
export const ASSET_REGISTRY: Record<string, AssetRegistryEntry> = {
  // USDC variants (different asset keys from useCurrencyOptions)
  "USDC": {
    symbol: "USDC",
    name: "USD Coin",
    description: "USD-backed stablecoin by Circle",
    category: "stablecoin",
    networkInstances: {
      "USDC-1337-AssetHubPolkadot": {
        network: "AssetHubPolkadot",
        assetType: "Asset ID",
        displayName: "USDC (AssetHub)",
        verified: true
      },
      // "USDC-native-Moonbeam": {
      //   network: "Moonbeam",
      //   assetType: "Multi-Location",
      //   displayName: "USDC (Moonbeam)",
      //   verified: true
      // },
      "USDC-22-Hydration": {
        network: "Hydration",
        assetType: "Asset ID",
        displayName: "USDC (Hydration)",
        verified: true
      },
      // "USDC-14-Acala": {
      //   network: "Acala",
      //   assetType: "Asset ID",
      //   displayName: "USDC (Acala)",
      //   verified: true
      // },
      "USDC-5-BifrostPolkadot": {
        network: "BifrostPolkadot",
        assetType: "Asset ID",
        displayName: "USDC (BifrostPolkadot)",
        verified: true
      },
    }
  },

  // USDT variants
  "USDT": {
    symbol: "USDT",
    name: "Tether USD",
    description: "Tether USD stablecoin",
    category: "stablecoin",
    networkInstances: {
      // "USDT-10-Moonbeam": {
      //   network: "Moonbeam",
      //   assetType: "Asset ID",
      //   displayName: "USDT (Moonbeam)",
      //   verified: false
      // },
      "USDt-1984-AssetHubPolkadot": {
        network: "AssetHubPolkadot",
        assetType: "Asset ID",
        displayName: "USDt (AssetHubPolkadot)",
        verified: true
      },
      "USDT-10-Hydration": {
        network: "Hydration",
        assetType: "Asset ID",
        displayName: "USDT (Hydration)",
        verified: true
      },
      // "USDT-1000767-Moonbeam": {
      //   network: "Moonbeam",
      //   assetType: "Asset ID",
      //   displayName: "USDT (Moonbeam)",
      //   verified: false
      // }
      "USDT-10-BifrostPolkadot": {
        network: "BifrostPolkadot",
        assetType: "Asset ID",
        displayName: "USDT (BifrostPolkadot)",
        verified: true
      },
      // "USDT-12-Acala": {
      //   network: "Acala",
      //   assetType: "Asset ID",
      //   displayName: "USDT (Acala)",
      //   verified: true
      // },
    }
  },

  // Native tokens
  "DOT": {
    symbol: "DOT",
    name: "Polkadot",
    description: "Polkadot native token",
    category: "native",
    networkInstances: {
      "DOT-native-AssetHubPolkadot": {
        network: "AssetHubPolkadot",
        assetType: "Multi-Location",
        displayName: "DOT (Native)",
        verified: true
      },
      "DOT-5-Hydration": {
        network: "Hydration",
        assetType: "Asset ID",
        displayName: "DOT (HydraDx)",
        verified: true
      },
      // "xcDOT-42259045809535163221576417993425387648-Moonbeam": {
      //   network: "Moonbeam",
      //   assetType: "Asset ID",
      //   displayName: "xcDOT (Moonbeam)",
      //   verified: false
      // },
      "DOT-native-Acala": {
        network: "Acala",
        assetType: "Multi-Location",
        displayName: "DOT (Acala)",
        verified: true
      },
      "DOT-0-BifrostPolkadot": {
        network: "BifrostPolkadot",
        assetType: "Asset ID",
        displayName: "DOT (BifrostPolkadot)",
        verified: true
      }
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
        verified: true
      },
    }
  },

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

