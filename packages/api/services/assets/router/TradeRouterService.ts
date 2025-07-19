import { EvmClient, PoolService, TradeRouter } from '@galacticcouncil/sdk';
import { ConnectionManager, ConnectionObserver } from '../../network/ConnectionManager';
import { AssetHubConnection } from '../../network/ConnectionFactory';
import { NETWORKS_SUPPORTED } from '../../constants';
import { ApiPromise } from '@polkadot/api';

export class TradeRouterService implements ConnectionObserver {
    private static instance: TradeRouterService;
    private tradeRouter: TradeRouter | null = null;
    private poolService: PoolService | null = null;
    private initialized = false;
    private lastInitializedAssets: any[] = [];
    private connectionManager: ConnectionManager;

    private constructor() {
        this.connectionManager = ConnectionManager.getInstance();
        // Register as observer for HydraDX connections
        this.connectionManager.registerConnectionObserver(NETWORKS_SUPPORTED.HYDRA_DX, this);
    }

    public static getInstance(): TradeRouterService {
        if (!TradeRouterService.instance) {
            TradeRouterService.instance = new TradeRouterService();
        }
        return TradeRouterService.instance;
    }

    public async initialize(externalAssets: any[]): Promise<void> {
        if (this.initialized) {
            console.log('TradeRouterService already initialized');
            return;
        }

        try {
            // Wait for HydraDX API to be available with retry logic
            const connectionManager = ConnectionManager.getInstance();
            console.log('Waiting for HydraDX connection...');
            
            let hydraApi = await connectionManager.getHydradxApiWithRetry(30000); // Wait up to 30 seconds
            
            // If still not available, try to wait for connection to be established
            if (!hydraApi) {
                console.log('HydraDX not immediately available, waiting for connection...');
                const isConnected = await connectionManager.waitForConnection('hydra_dx', 45000); // Wait up to 45 seconds
                if (isConnected) {
                    hydraApi = connectionManager.getHydradxApi();
                }
            }
            
            if (!hydraApi) {
                const status = connectionManager.getConnectionStatus();
                console.error('HydraDX API not available after waiting. Connection status:', status.hydra_dx);
                throw new Error('HydraDX API connection not available after extended wait. TradeRouter will be unavailable.');
            }

            console.log('HydraDX API available, initializing PoolService...');

            // Initialize PoolService
            const evmClient = new EvmClient(hydraApi);
            this.poolService = new PoolService(hydraApi, evmClient);
            if (!this.poolService) {
                throw new Error('Failed to create PoolService');
            }
            
            // Sync registry with assets
            console.log("Syncing registry with", externalAssets.length, "assets");
            await this.poolService.syncRegistry(externalAssets);
            
            // Initialize TradeRouter
            this.tradeRouter = new TradeRouter(this.poolService);
            if (!this.tradeRouter) {
                throw new Error('Failed to create TradeRouter');
            }

            this.initialized = true;
            this.lastInitializedAssets = externalAssets; // Store for potential reinitializaton
            console.log('TradeRouterService initialized successfully');
        } catch (error) {
            this.cleanup(); // Reset state on failure
            console.error('❌ Failed to initialize TradeRouterService:', error instanceof Error ? error.message : error);
            if (error instanceof Error && error.stack) {
                console.error('Stack trace:', error.stack);
            }
            throw error;
        }
    }



    public async getTradeRouter(): Promise<TradeRouter> {
        if (!this.initialized || !this.tradeRouter) {
            throw new Error('TradeRouter not available. Ensure TradeRouterService is initialized and HydraDX connection is active.');
        }
        
        return this.tradeRouter;
    }

    public async getPoolService(): Promise<PoolService> {
        if (!this.initialized || !this.poolService) {
            throw new Error('PoolService not available. Ensure TradeRouterService is initialized and HydraDX connection is active.');
        }
        
        return this.poolService;
    }

    public cleanup(): void {
        this.tradeRouter = null;
        this.poolService = null;
        this.initialized = false;
        this.lastInitializedAssets = [];
    }

    // ConnectionObserver implementation
    public async onConnectionChanged(network: string, newConnection: AssetHubConnection | ApiPromise | null): Promise<void> {
        if (network === NETWORKS_SUPPORTED.HYDRA_DX) {
            console.log('🔄 TradeRouterService: HydraDX connection changed, resetting...');
            // Clear current services since connection changed
            this.cleanup();
        }
    }

    public async onConnectionRestored(network: string, connection: AssetHubConnection | ApiPromise): Promise<void> {
        if (network === NETWORKS_SUPPORTED.HYDRA_DX && this.lastInitializedAssets.length > 0) {
            console.log('🔄 TradeRouterService: HydraDX connection restored, reinitializing...');
            try {
                // Reinitialize with the same assets when connection is restored
                await this.initialize(this.lastInitializedAssets);
            } catch (error) {
                console.error('Failed to reinitialize TradeRouterService after connection restoration:', error);
            }
        }
    }
} 