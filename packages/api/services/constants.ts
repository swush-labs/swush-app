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

// Network endpoints configuration
export const NETWORK_ENDPOINTS = {
  [NETWORKS_SUPPORTED.ASSET_HUB]: [
    'wss://polkadot-asset-hub-rpc.polkadot.io',
    'wss://asset-hub-polkadot.dotters.network',
    'wss://sys.ibp.network/asset-hub-polkadot'
  ],
  [NETWORKS_SUPPORTED.HYDRA_DX]: [
    'wss://rpc.hydradx.cloud',
    'wss://rpc.helikon.io/hydradx',
    'wss://hydration.dotters.network'
  ]
} as const;

export const NUMBER_FORMAT_OPTIONS = { round: 2, trim: true, commify: false };

// Connection timeout for initial connection attempts
export const CONNECTION_TIMEOUT = 45000; // 45 seconds
export const CONNECTION_HEALTH_CHECK_INTERVAL = 60000; // 60 seconds
