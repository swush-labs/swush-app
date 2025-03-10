import { PoolService, TradeRouter } from '@galacticcouncil/sdk';
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
            // Wait for HydraDX API to be available
            const hydraApi = await ConnectionManager.getInstance().getHydradxApi();
            if (!hydraApi) {
                throw new Error('HydraDX API not initialized. Please ensure ConnectionManager is initialized first.');
            }

            // Initialize PoolService
            this.poolService = new PoolService(hydraApi);
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
            console.error('Failed to initialize TradeRouterService:', error);
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