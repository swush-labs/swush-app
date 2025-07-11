import { EvmClient, PoolService, TradeRouter } from '@galacticcouncil/sdk';
import { ConnectionManager } from '../../network/ConnectionManager';

export class TradeRouterService {
    private static instance: TradeRouterService;
    private tradeRouter: TradeRouter | null = null;
    private poolService: PoolService | null = null;
    private initialized = false;

    private constructor() {}

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

    public getTradeRouter(): TradeRouter {
        if (!this.initialized || !this.tradeRouter) {
            throw new Error('TradeRouter not initialized. Call initialize() first');
        }
        return this.tradeRouter;
    }

    public getPoolService(): PoolService {
        if (!this.initialized || !this.poolService) {
            throw new Error('PoolService not initialized. Call initialize() first');
        }
        return this.poolService;
    }

    public cleanup(): void {
        this.tradeRouter = null;
        this.poolService = null;
        this.initialized = false;
    }
} 