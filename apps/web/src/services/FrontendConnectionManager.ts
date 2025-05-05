import { createClient, TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { getWsProvider } from 'polkadot-api/ws-provider/web';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { RPC_ENDPOINTS } from './constants';
import { SupportedChains } from '@swush/api/network/types';

type Client = ReturnType<typeof createClient>;

export type PapiConnection = {
    api: TypedApi<SupportedChains>;
    client: Client;
};

export class FrontendConnectionManager {
    private static instance: FrontendConnectionManager;
    private connections: Map<string, PapiConnection> = new Map();
    private isConnecting: boolean = false;
    
    private constructor() {}

    static getInstance(): FrontendConnectionManager {
        if (!this.instance) {
            this.instance = new FrontendConnectionManager();
        }
        return this.instance;
    }

    async getConnection(network: string): Promise<PapiConnection> {
        // Return existing connection if active
        const existing = this.connections.get(network);
        if (existing) {
            try {
                // Quick health check
                const health = await existing.client._request('system_health', []);
                if (!health) throw new Error('Health check failed');
                return existing;
            } catch (e) {
                // Connection dead, remove it
                await this.disconnect(network);
            }
        }

        // Create new connection
        const endpoint = this.getPreferredEndpoint(network);
        console.log('Connecting to endpoint:', endpoint);
        const connection = await this.connect(endpoint);
        this.connections.set(network, connection);
        return connection;
    }

    private getPreferredEndpoint(network: string): string {
        const networkConfig = RPC_ENDPOINTS[network as keyof typeof RPC_ENDPOINTS];
        if (!networkConfig) {
            throw new Error(`No endpoints configured for network: ${network}`);
        }
        
        const activeEndpoint = networkConfig.endpoints.find((e: { isActive: boolean }) => e.isActive);
        return activeEndpoint?.url || networkConfig.endpoints[0].url;
    }

    private async connect(endpoint: string): Promise<PapiConnection> {
        if (this.isConnecting) {
            throw new Error('Connection attempt already in progress');
        }

        try {
            this.isConnecting = true;
            const wsProvider = getWsProvider(endpoint);
            const client = createClient(withPolkadotSdkCompat(wsProvider));
            
            // Create typed API instance
            const api = client.getTypedApi(polkadot_asset_hub);

            // Basic check to verify we have a working connection
            const health = await client._request('system_health', []);
            if (!health) throw new Error('Health check failed');

            return { api, client };
        } catch (error) {
            console.error('Connection failed:', error);
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    async disconnect(network?: string): Promise<void> {
        if (network) {
            const connection = this.connections.get(network);
            if (connection) {
                await connection.client.destroy();
                this.connections.delete(network);
            }
        } else {
            // Disconnect all
            this.connections.forEach(async (connection, network) => {
                await connection.client.destroy();
                this.connections.delete(network);
            });
        }
    }
} 