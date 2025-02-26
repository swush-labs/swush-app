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
export const TEST_RPC_ASSET_HUB = 'ws://localhost:3421'
export const TEST_RPC_POLKADOT = 'ws://localhost:3420'
export const TEST_RPC_PARACHAIN_HYDRATION = 'ws://localhost:3422'

export const NUMBER_FORMAT_OPTIONS = { round: 2, trim: true, commify: false };

// Time constants in milliseconds
export const HEALTH_CHECK = {
  INTERVAL: 4 * 60 * 1000,    // Check every 4 minutes if RPC endpoint is healthy
  TIMEOUT: 10 * 1000,         // 10 seconds timeout for health checks if RPC doesn't respond then we consider it unhealthy
  REACTIVATION: 10 * 60 * 1000 // Reactivate after 10 minutes, wait for time to recover
} as const;

export const RPC_ENDPOINTS =  {
  [NETWORKS_SUPPORTED.ASSET_HUB]: {
      endpoints: [
        // Primary endpoints (major providers)
  //      { url: 'wss://polkadot-asset-hub-rpc.polkadot.io', priority: 3, isActive: true }, // Parity (Official)
        
        // Secondary endpoints (reliable providers)
        { url: 'wss://asset-hub-polkadot.dotters.network', priority: 2, isActive: true }, // IBP2
        { url: 'wss://sys.ibp.network/asset-hub-polkadot', priority: 1, isActive: true }, // IBP1
  //      { url: 'wss://rpc-asset-hub-polkadot.luckyfriday.io', priority: 4, isActive: true }, // LuckyFriday
  
        // Tertiary endpoints (additional providers)
   //      { url: 'wss://asset-hub-polkadot-rpc.dwellir.com', priority: 5, isActive: true }, // Dwellir (Main)
      //   { url: 'wss://statemint-rpc-tn.dwellir.com', priority: 6, isActive: true },       // Dwellir Tunisia
      //   { url: 'wss://statemint.public.curie.radiumblock.co/ws', priority: 7, isActive: true } // RadiumBlock
      ],
      currentIndex: 0,
      healthCheck: {
        interval: HEALTH_CHECK.INTERVAL,
        timeout: HEALTH_CHECK.TIMEOUT,
      },
    },
    [NETWORKS_SUPPORTED.HYDRA_DX]: {
      endpoints: [
        // Primary endpoints (major providers)
        { url: 'wss://rpc.hydradx.cloud', priority: 1, isActive: true },          // Galactic Council (Official)
        { url: 'wss://hydradx-rpc.dwellir.com', priority: 2, isActive: true },    // Dwellir
        
        // Secondary endpoints (reliable providers)
        { url: 'wss://hydradx.paras.ibp.network', priority: 3, isActive: true },  // IBP1
        { url: 'wss://hydration.dotters.network', priority: 4, isActive: true },   // IBP2
        
        // Tertiary endpoint
        { url: 'wss://rpc.helikon.io/hydradx', priority: 5, isActive: true }      // Helikon
      ],
      currentIndex: 0,
      healthCheck: {
        interval: HEALTH_CHECK.INTERVAL,
        timeout: HEALTH_CHECK.TIMEOUT,
      },
    },
  }; 