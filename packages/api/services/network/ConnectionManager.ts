import { TypedApi, PolkadotClient } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { ApiPromise } from '@polkadot/api';
import { connectPapi, connectPolkadotjs } from './types';
import { AH_RPC_URL } from '../constants';

type NetworkConnections = {
    assetHub: { api: TypedApi<typeof polkadot_asset_hub>; client: PolkadotClient } | null;
    hydradx: ApiPromise | null;
};

export class ConnectionManager {
    private static instance: ConnectionManager;
    private connections: NetworkConnections = {
        assetHub: null,
        hydradx: null
    };
    private initialized: boolean = false;

    private constructor() {}

    public static getInstance(): ConnectionManager {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Initialize Asset Hub connection
            this.connections.assetHub = await connectPapi(AH_RPC_URL, 'asset-hub');
            
            // Initialize HydraDX connection
            this.connections.hydradx = await connectPolkadotjs('wss://rpc.hydradx.cloud');
            
            this.initialized = true;
            console.log('All network connections initialized');
        } catch (error) {
            console.error('Failed to initialize connections:', error);
            throw error;
        }
    }

    public getAssetHubApi(): TypedApi<typeof polkadot_asset_hub> | null {
        return this.connections.assetHub?.api || null;
    }

    public getHydradxApi(): ApiPromise | null {
        return this.connections.hydradx;
    }

    public async disconnect(): Promise<void> {
        try {
            if (this.connections.assetHub) {
                await this.connections.assetHub.client.destroy();
                this.connections.assetHub = null;
            }
            if (this.connections.hydradx) {
                await this.connections.hydradx.disconnect();
                this.connections.hydradx = null;
            }
        } catch (error) {
            console.error('Error during disconnect:', error);
            throw error;
        }
    }
} 