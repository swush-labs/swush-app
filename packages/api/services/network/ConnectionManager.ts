import { TypedApi, PolkadotClient } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { ApiPromise } from '@polkadot/api';
import { connectPapi, connectPolkadotjs } from './types';
import { RpcEndpointManager } from './Rpc/RpcEndpointManager';
import { NETWORKS_SUPPORTED, CONNECTION_CONFIG } from 'services/constants';

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
    private rpcManager: RpcEndpointManager;
    private reconnectAttempts: Record<string, number> = {};
    private reconnectTimeouts: Record<string, NodeJS.Timeout> = {};

    private constructor() {
        this.rpcManager = RpcEndpointManager.getInstance();
        this.initializeReconnectAttempts();
        
        // Listen for RPC endpoint events
        this.rpcManager.on('endpointError', async (event) => {
            console.warn(`RPC endpoint error for ${event.network}: ${event.error}`);
            if (this.initialized) {
                await this.handleConnectionError(event.network, new Error(event.error));
            }
        });
    }

    private initializeReconnectAttempts(): void {
        Object.values(NETWORKS_SUPPORTED).forEach(network => {
            this.reconnectAttempts[network] = 0;
        });
    }

    private calculateReconnectDelay(network: string): number {
        const attempts = this.reconnectAttempts[network];
        // Exponential backoff with jitter
        return Math.min(
            CONNECTION_CONFIG.BASE_RECONNECT_DELAY * Math.pow(2, attempts) * (0.5 + Math.random()),
            CONNECTION_CONFIG.MAX_RECONNECT_DELAY
        );
    }

    private async handleConnectionError(network: string, error: Error): Promise<void> {
        console.error(`Connection error for ${network}:`, error);
        
        // Mark the current endpoint as having an error
        const currentEndpoint = this.rpcManager.getEndpoint(network);
        this.rpcManager.markEndpointError(network, currentEndpoint, error);
        
        this.reconnectAttempts[network]++;

        // Clear any existing reconnection timeout
        if (this.reconnectTimeouts[network]) {
            clearTimeout(this.reconnectTimeouts[network]);
        }

        // If we haven't exceeded max attempts, schedule reconnection
        if (this.reconnectAttempts[network] <= CONNECTION_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            const delay = this.calculateReconnectDelay(network);
            console.log(`Scheduling reconnection for ${network} in ${delay}ms (attempt ${this.reconnectAttempts[network]}/${CONNECTION_CONFIG.MAX_RECONNECT_ATTEMPTS})`);
            
            this.reconnectTimeouts[network] = setTimeout(async () => {
                try {
                    await this.reconnectNetwork(network);
                } catch (reconnectError) {
                    console.error(`Reconnection attempt failed for ${network}:`, reconnectError);
                    // If reconnection fails, try the next endpoint
                    if (reconnectError instanceof Error) {
                        await this.handleConnectionError(network, reconnectError);
                    }
                }
            }, delay);
        } else {
            console.error(`Max reconnection attempts reached for ${network}`);
            // Reset attempts after a longer timeout
            setTimeout(() => {
                this.reconnectAttempts[network] = 0;
                // Try one more time after resetting
                this.reconnectNetwork(network).catch(error => {
                    console.error(`Failed to reconnect to ${network} after reset:`, error);
                });
            }, CONNECTION_CONFIG.ATTEMPT_RESET_TIMEOUT);
        }
    }

    private async reconnectNetwork(network: string): Promise<void> {
        try {
            // Get a new endpoint, potentially different from the failed one
            const endpoint = this.rpcManager.getEndpoint(network);
            console.log(`Attempting to reconnect to ${network} using endpoint ${endpoint}`);
            
            // Cleanup existing connection
            await this.cleanupConnection(network);
            
            switch (network) {
                case NETWORKS_SUPPORTED.ASSET_HUB:
                    this.connections.assetHub = await connectPapi(endpoint, NETWORKS_SUPPORTED.ASSET_HUB);
                    break;
                case NETWORKS_SUPPORTED.HYDRA_DX:
                    this.connections.hydradx = await connectPolkadotjs(endpoint);
                    break;
            }
            
            // Reset reconnect attempts on successful connection
            this.reconnectAttempts[network] = 0;
            console.log(`Successfully reconnected to ${network} using endpoint ${endpoint}`);
        } catch (error) {
            if (error instanceof Error) {
                console.error(`Failed to reconnect to ${network}:`, error);
                throw error; // Propagate the error to be handled by handleConnectionError
            }
        }
    }

    private async cleanupConnection(network: string): Promise<void> {
        try {
            switch (network) {
                case NETWORKS_SUPPORTED.ASSET_HUB:
                    if (this.connections.assetHub?.client) {
                        await this.connections.assetHub.client.destroy();
                        this.connections.assetHub = null;
                    }
                    break;
                case NETWORKS_SUPPORTED.HYDRA_DX:
                    if (this.connections.hydradx) {
                        await this.connections.hydradx.disconnect();
                        this.connections.hydradx = null;
                    }
                    break;
            }
        } catch (error) {
            console.warn(`Error during connection cleanup for ${network}:`, error);
        }
    }

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
            const assetHubEndpoint = this.rpcManager.getEndpoint(NETWORKS_SUPPORTED.ASSET_HUB);
            try {
                this.connections.assetHub = await connectPapi(assetHubEndpoint, NETWORKS_SUPPORTED.ASSET_HUB);
            } catch (error) {
                if (error instanceof Error) {
                    this.rpcManager.markEndpointError('assetHub', assetHubEndpoint, error);
                }
                // Try next endpoint
                const nextAssetHubEndpoint = this.rpcManager.getEndpoint(NETWORKS_SUPPORTED.ASSET_HUB);
                this.connections.assetHub = await connectPapi(nextAssetHubEndpoint, NETWORKS_SUPPORTED.ASSET_HUB);
            }
            
            // Initialize HydraDX connection
            const hydradxEndpoint = this.rpcManager.getEndpoint(NETWORKS_SUPPORTED.HYDRA_DX);
            try {
                this.connections.hydradx = await connectPolkadotjs(hydradxEndpoint);
            } catch (error) {
                if (error instanceof Error) {
                    this.rpcManager.markEndpointError(NETWORKS_SUPPORTED.HYDRA_DX, hydradxEndpoint, error);
                }
                // Try next endpoint
                const nextHydradxEndpoint = this.rpcManager.getEndpoint(NETWORKS_SUPPORTED.HYDRA_DX);
                this.connections.hydradx = await connectPolkadotjs(nextHydradxEndpoint);
            }
            
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
            // Clear all reconnection timeouts
            Object.values(this.reconnectTimeouts).forEach(timeout => clearTimeout(timeout));
            this.reconnectTimeouts = {};

            // Cleanup all connections
            await Promise.all(
                Object.values(NETWORKS_SUPPORTED).map(network => this.cleanupConnection(network))
            );
            
            this.rpcManager.cleanup();
            this.initialized = false;
            this.initializeReconnectAttempts();
        } catch (error) {
            console.error('Error during disconnect:', error);
            throw error;
        }
    }
} 