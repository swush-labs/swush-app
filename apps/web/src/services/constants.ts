export const CACHE_KEYS = {
  ASSET_HUB_ASSETS: 'asset_hub_assets',
  MERGED_ASSETS: 'merged_assets',
  TOKEN_GRAPH: 'token_graph',
  ASSET_HUB_ROUTER: 'asset_hub_router'
};

export const NETWORKS_SUPPORTED = {
  ASSET_HUB: 'asset_hub',
  HYDRA_DX: 'hydra_dx',
  POLKADOT: 'polkadot'
} as const;

export const AH_RPC_URL = 'wss://asset-hub-polkadot.dotters.network';
//TEST_RPC
export const TEST_RPC = 'ws://localhost:8000'
// Dynamic chopsticks URLs based on environment
const CHOPSTICKS_HOST = process.env.NEXT_PUBLIC_CHOPSTICKS_HOST || 'localhost';
const USE_HTTPS = process.env.NEXT_PUBLIC_USE_HTTPS === 'true';
const WS_PROTOCOL = USE_HTTPS ? 'wss' : 'ws';

// Use nginx proxy paths for production (HTTPS) or direct ports for development
export const TEST_RPC_ASSET_HUB = USE_HTTPS 
  ? `${WS_PROTOCOL}://${CHOPSTICKS_HOST}/3421` 
  : `${WS_PROTOCOL}://${CHOPSTICKS_HOST}:3421`
export const TEST_RPC_HYDRATION = USE_HTTPS 
  ? `${WS_PROTOCOL}://${CHOPSTICKS_HOST}/3422` 
  : `${WS_PROTOCOL}://${CHOPSTICKS_HOST}:3422`
export const TEST_RPC_POLKADOT = 'ws://localhost:3420'
export const TEST_RPC_PARACHAIN_HYDRATION = 'ws://localhost:3422'
export const TEST_RPC_BIFROST = 'ws://localhost:3423'
//acala test rpc
export const TEST_RPC_ACALA = 'ws://localhost:3424'

export const NUMBER_FORMAT_OPTIONS = { round: 3, trim: true, commify: false };
export const ROUND_OPTION = 3;

// XCM Balance Polling Configuration
export const XCM_BALANCE_POLLING = {
  INTERVAL: 6000,           // Poll every 7 seconds (typical XCM delivery: ~20s = 3-4 polls)
  MAX_DURATION: 240000,     // Max 4 minutes (240 seconds)
  MAX_POLLS: 35,            // 35 polls * 7s ≈ 4 minutes
} as const;
