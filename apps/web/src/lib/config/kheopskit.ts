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
      http: ["https://rpc.sepolia.org"],
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

// All supported networks
export const APPKIT_CHAINS: [AppKitNetwork, ...AppKitNetwork[]] = [
  polkadot,
  polkadotAssetHub, 
  paseo,
  sepolia,
  mainnet,
];

// Kheopskit configuration
export const kheopskitConfig: KheopskitConfig = {
  autoReconnect: true,
  platforms: ["polkadot", "ethereum"], // Support both platforms
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

