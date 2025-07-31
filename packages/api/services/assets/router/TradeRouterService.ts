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
    private connectionManager: ConnectionManager;
    private restorationTimeoutId: NodeJS.Timeout | null = null;

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

    public async initialize(): Promise<void> {
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
            
            // PoolService can manage its own registry - no external assets needed
            console.log("Initializing PoolService registry...");
            // Note: syncRegistry can be called with empty array or the SDK may handle it internally
            await this.poolService.syncRegistry([]);
            
            // Initialize TradeRouter
            this.tradeRouter = new TradeRouter(this.poolService);
            if (!this.tradeRouter) {
                throw new Error('Failed to create TradeRouter');
            }

            this.initialized = true;
            console.log('TradeRouterService initialized successfully');
        } catch (error) {
            this.fullCleanup(); // Reset state completely on initialization failure
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
        // Cancel any pending restoration timeout
        if (this.restorationTimeoutId) {
            clearTimeout(this.restorationTimeoutId);
            this.restorationTimeoutId = null;
        }
        
        this.tradeRouter = null;
        this.poolService = null;
        this.initialized = false;
    }

    private fullCleanup(): void {
        // Cancel any pending restoration timeout
        if (this.restorationTimeoutId) {
            clearTimeout(this.restorationTimeoutId);
            this.restorationTimeoutId = null;
        }
        
        this.tradeRouter = null;
        this.poolService = null;
        this.initialized = false;
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
        if (network === NETWORKS_SUPPORTED.HYDRA_DX) {
            console.log('🔄 TradeRouterService: HydraDX connection restored, reinitializing...');
            
            // Cancel any existing restoration timeout to prevent race conditions
            if (this.restorationTimeoutId) {
                clearTimeout(this.restorationTimeoutId);
                this.restorationTimeoutId = null;
            }
            
            // Schedule restoration with a longer delay to ensure API is fully ready
            // This allows the connection to stabilize before attempting complex operations
            this.restorationTimeoutId = setTimeout(async () => {
                try {
                    // Clear the timeout ID since it's now executing
                    this.restorationTimeoutId = null;
                    
                    console.log('🔄 Starting delayed TradeRouter restoration...');
                    await this.initialize(); // No assets needed - self-contained
                    console.log('✅ TradeRouterService restoration completed successfully');
                } catch (error) {
                    console.error('❌ Failed to reinitialize TradeRouterService after connection restoration:', error);
                    if (error instanceof Error && error.stack) {
                        console.error('Stack trace:', error.stack);
                    }
                    // Don't fail the entire process - cache refresh will work when API is ready
                }
            }, 5000); // 5 second delay to ensure API is fully ready
        }
    }
} 