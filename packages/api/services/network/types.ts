import { TypedApi, PolkadotClient, ChainDefinition } from 'polkadot-api';
import { 
    polkadot_asset_hub,
    polkadot,
    hydration 
} from '@polkadot-api/descriptors';
import { NETWORKS_SUPPORTED } from '../constants';
import RpcConnection from './Rpc/RpcConnection';
import { ApiPromise } from '@polkadot/api';

// Define chain descriptors mapping
export const CHAIN_DESCRIPTORS: {
    [NETWORKS_SUPPORTED.ASSET_HUB]: typeof polkadot_asset_hub,
    [NETWORKS_SUPPORTED.POLKADOT]: typeof polkadot,
    [NETWORKS_SUPPORTED.HYDRA_DX]: typeof hydration
} = {
    [NETWORKS_SUPPORTED.ASSET_HUB]: polkadot_asset_hub,
    [NETWORKS_SUPPORTED.POLKADOT]: polkadot,
    [NETWORKS_SUPPORTED.HYDRA_DX]: hydration,
} as const;

// Define supported chains type from descriptors
export type SupportedChains = typeof CHAIN_DESCRIPTORS[keyof typeof CHAIN_DESCRIPTORS];

// Define network type from NETWORKS_SUPPORTED
export type NetworkType = typeof NETWORKS_SUPPORTED[keyof typeof NETWORKS_SUPPORTED];

export interface PapiConnection<T extends ChainDefinition = SupportedChains> {
    api: TypedApi<T>;
    client: PolkadotClient;
}

// Type guard
export function isPapiConnection(result: unknown): result is PapiConnection {
    return Boolean(result && typeof result === 'object' && 'api' in result && 'client' in result);
}

// Generic connection creator
export function createConnection<T extends NetworkType>(
    connection: { api: TypedApi<any>; client: PolkadotClient }
): PapiConnection<typeof CHAIN_DESCRIPTORS[T]> {
    return {
        api: connection.api as TypedApi<typeof CHAIN_DESCRIPTORS[T]>,
        client: connection.client
    };
}

// Chain-specific connect function with proper return types
export async function connectPapi<T extends NetworkType>(
    rpcUrl: string, 
    chainType: T
): Promise<PapiConnection<typeof CHAIN_DESCRIPTORS[T]>> {
    const papiConn = RpcConnection.getInstance('papi');
    const result = await papiConn.connect(rpcUrl, chainType);
    
    if (!isPapiConnection(result)) {
        throw new Error('Invalid connection type');
    }
    
    return createConnection(result);
}

//write a connection for polkadotjs using below example
export async function connectPolkadotjs(rpcUrl: string): Promise<ApiPromise> {
    const rpcConnection = RpcConnection.getInstance('polkadotjs');
    const api = await rpcConnection.connect(rpcUrl) as ApiPromise;
    return api;
}


