import type { KheopskitConfig } from "@kheopskit/core";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { defineChain } from "@reown/appkit/networks";

// Define supported networks
export const polkadot = defineChain({
  id: "91b171bb158e2d3848fa23a9f1c25182",
  name: "Polkadot",
  nativeCurrency: { name: "Polkadot", symbol: "DOT", decimals: 10 },
  rpcUrls: {
    default: {
      http: ["https://rpc.ibp.network/polkadot"],
      webSocket: ["wss://rpc.ibp.network/polkadot"],
    },
  },
  blockExplorers: {
    default: {
      name: "Polkadot Explorer", 
      url: "https://polkadot.subscan.io/",
    },
  },
  chainNamespace: "polkadot",
  caipNetworkId: "polkadot:91b171bb158e2d3848fa23a9f1c25182",
});

export const polkadotAssetHub = defineChain({
  id: "68d56f15f85d3136970ec16946040bc1",
  name: "Polkadot Asset Hub",
  nativeCurrency: { name: "Polkadot", symbol: "DOT", decimals: 10 },
  rpcUrls: {
    default: {
      http: ["https://polkadot-asset-hub-rpc.polkadot.io"],
      webSocket: ["wss://polkadot-asset-hub-rpc.polkadot.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Polkadot Explorer",
      url: "https://assethub-polkadot.subscan.io/",
    },
  },
  chainNamespace: "polkadot",
  caipNetworkId: "polkadot:68d56f15f85d3136970ec16946040bc1",
});

export const paseo = defineChain({
  id: "67f9723393ef76214df0118c34bbbd3d", 
  name: "Paseo",
  nativeCurrency: { name: "Paseo", symbol: "PAS", decimals: 10 },
  rpcUrls: {
    default: {
      http: ["https://rpc.ibp.network/paseo"],
      webSocket: ["wss://rpc.ibp.network/paseo"],
    },
  },
  blockExplorers: {
    default: {
      name: "Paseo Explorer",
      url: "https://paseo.subscan.io/",
    },
  },
  chainNamespace: "polkadot",
  caipNetworkId: "polkadot:67f9723393ef76214df0118c34bbbd3d",
});

//add dummy for paseo_asset_hub
export const paseoAssetHub = defineChain({
  id: "d6eec26135305a8ad257a20d00335728", 
  name: "Paseo Asset Hub",
  nativeCurrency: { name: "Paseo", symbol: "PAS", decimals: 10 },
  rpcUrls: {
    default: {
      http: ["https://rpc.ibp.network/paseo"],
      webSocket: ["wss://rpc.ibp.network/paseo"],
    },
  },
  blockExplorers: {
    default: {
      name: "Paseo Asset Hub Explorer",
      url: "https://paseo-asset-hub.subscan.io/",
    },
  },
  chainNamespace: "polkadot",
  caipNetworkId: "polkadot:d6eec26135305a8ad257a20d00335728",
});

// Ethereum chains
export const sepolia = defineChain({
  id: "11155111",
  name: "Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://ethereum-sepolia.publicnode.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io",
    },
  },
  chainNamespace: "eip155",
  caipNetworkId: "eip155:11155111",
});

export const mainnet = defineChain({
  id: "1",
  name: "Ethereum", 
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.ankr.com/eth"],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://etherscan.io",
    },
  },
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1",
});

// Arbitrum for Chainflip integration
export const arbitrum = defineChain({
  id: "42161",
  name: "Arbitrum",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://arb1.arbitrum.io/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arbiscan",
      url: "https://arbiscan.io",
    },
  },
  chainNamespace: "eip155",
  caipNetworkId: "eip155:42161",
});

export const arbitrumSepolia = defineChain({
  id: "421614",
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://sepolia-rollup.arbitrum.io/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arbiscan Sepolia",
      url: "https://sepolia.arbiscan.io",
    },
  },
  chainNamespace: "eip155",
  caipNetworkId: "eip155:421614",
});

// Solana for Chainflip integration
export const solanaMainnet = defineChain({
  id: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  name: "Solana",
  nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
  rpcUrls: {
    default: {
      http: ["https://api.mainnet-beta.solana.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Solscan",
      url: "https://solscan.io",
    },
  },
  chainNamespace: "solana",
  caipNetworkId: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
});

export const solanaDevnet = defineChain({
  id: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  name: "Solana Devnet",
  nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
  rpcUrls: {
    default: {
      http: ["https://api.devnet.solana.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Solscan Devnet",
      url: "https://solscan.io?cluster=devnet",
    },
  },
  chainNamespace: "solana",
  caipNetworkId: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
});

// AssetHub Chainflip Testnet (Perseverance)
export const assetHubChainflipTestnet = defineChain({
  id: "assethub-perseverance-chainflip",
  name: "AssetHub Chainflip Testnet",
  nativeCurrency: { name: "Polkadot", symbol: "DOT", decimals: 10 },
  rpcUrls: {
    default: {
      http: [], // WebSocket only endpoint
      webSocket: ["wss://assethub.perseverance.chainflip.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Perseverance Explorer",
      url: "https://scan.perseverance.chainflip.io",
    },
  },
  chainNamespace: "polkadot",
  caipNetworkId: "polkadot:assethub-perseverance-chainflip",
});

// All supported networks - include both mainnet and testnet
export const APPKIT_CHAINS: [AppKitNetwork, ...AppKitNetwork[]] = [
  // Mainnet
  polkadot,
  polkadotAssetHub,
  mainnet,
  arbitrum,
  solanaMainnet,
  // Testnet
  paseo,
  paseoAssetHub,
  sepolia,
  arbitrumSepolia,
  solanaDevnet,
  assetHubChainflipTestnet,
];

// Kheopskit configuration
export const kheopskitConfig: KheopskitConfig = {
  autoReconnect: true,
  platforms: ["polkadot", "ethereum", "solana"], // Support all three platforms
  walletConnect: {
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "demo-project-id",
    metadata: {
      name: "Polkadot Next.js Starter",
      description: "A starter project for your next Polkadot dApp",
      url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
      icons: ["/polkadot-nextjs-starter.png"],
    },
    networks: APPKIT_CHAINS,
  },
  debug: process.env.NODE_ENV === "development",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Chain ID Utilities - Single Source of Truth
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get EVM chain ID by network name
 * Network names match those used throughout the app (assetRegistry, etc.)
 * 
 * @param network - Network name (e.g., "Ethereum", "Sepolia", "Arbitrum")
 * @returns Numeric chain ID or undefined if not found
 */
export const getEvmChainId = (network: string): number | undefined => {
  const chain = APPKIT_CHAINS.find(
    c => c.name === network && (c as { chainNamespace?: string }).chainNamespace === 'eip155'
  );
  
  if (!chain) return undefined;
  return typeof chain.id === 'string' ? parseInt(chain.id, 10) : chain.id;
};

/**
 * Get network name from EVM chain ID
 * Reverse lookup of getEvmChainId
 * 
 * @param chainId - Numeric chain ID (e.g., 1, 11155111, 42161)
 * @returns Network name or undefined if not found
 */
export const getNetworkNameFromChainId = (chainId: number): string | undefined => {
  const chain = APPKIT_CHAINS.find(c => {
    if ((c as { chainNamespace?: string }).chainNamespace !== 'eip155') return false;
    const id = typeof c.id === 'string' ? parseInt(c.id, 10) : c.id;
    return id === chainId;
  });
  
  return chain?.name;
};

