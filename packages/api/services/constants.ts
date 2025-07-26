export const CACHE_KEYS = {
  ASSET_HUB_ASSETS: 'asset_hub_assets',
  MERGED_ASSETS: 'merged_assets',
  TOKEN_GRAPH: 'token_graph',
  ASSET_HUB_ROUTER: 'asset_hub_router'
};

export const NETWORKS_SUPPORTED = {
  ASSET_HUB: 'asset_hub',
  HYDRA_DX: 'hydra_dx'
} as const;

// Network endpoints configuration - keep all for production redundancy
export const NETWORK_ENDPOINTS = {
  [NETWORKS_SUPPORTED.ASSET_HUB]: [
    'wss://polkadot-asset-hub-rpc.polkadot.io',
    'wss://asset-hub-polkadot.dotters.network',
    'wss://sys.ibp.network/asset-hub-polkadot'
  ],
/*   [NETWORKS_SUPPORTED.HYDRA_DX]: [
    'wss://hydration-rpc.n.dwellir.com',
    'wss://rpc.cay.hydration.cloud',
    'wss://rpc2.cay.hydration.cloud'
  ] */
  [NETWORKS_SUPPORTED.HYDRA_DX]: [
    'wss://hydration-rpc.n.dwellir.com',
    'wss://hydration.dotters.network',
    'wss://rpc.helikon.io/hydradx',
    'wss://hydration.ibp.network',
    'wss://rpc.cay.hydration.cloud',
    'wss://rpc.parm.hydration.cloud',
    'wss://rpc.roach.hydration.cloud',
    'wss://rpc.zipp.hydration.cloud',
    'wss://rpc.sin.hydration.cloud',
    'wss://rpc.coke.hydration.cloud'
  ]
} as const;

export const NUMBER_FORMAT_OPTIONS = { round: 2, trim: true, commify: false };

// Production timeouts optimized for lower user volume
export const CONNECTION_TIMEOUT = 12000; // 12 seconds - reasonable for production
export const CONNECTION_HEALTH_CHECK_INTERVAL = 60000; // 1 minute - less aggressive than 30s
export const VALIDATION_CACHE_TTL = 30000; // 30 seconds - cache validation results
