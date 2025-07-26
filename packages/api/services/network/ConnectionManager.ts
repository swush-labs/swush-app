import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { ApiPromise } from '@polkadot/api';
import { EndpointProvider } from './EndpointProvider';
import { ConnectionFactory, AssetHubConnection, ConnectionEventCallback } from './ConnectionFactory';
import { CONNECTION_HEALTH_CHECK_INTERVAL, NETWORKS_SUPPORTED } from '../constants';

interface NetworkConnection {
    connection: AssetHubConnection | ApiPromise | null;
    isReady: boolean;
    isConnecting: boolean;
    lastConnected: Date | null;
    consecutiveFailures: number;
    lastError: Error | null;
    currentEndpoint: string | null;
}

interface ConnectionHealth {
    isHealthy: boolean;
    lastCheck: Date;
    responseTime: number;
}

// Observer interface for services that depend on connections
export interface ConnectionObserver {
    onConnectionChanged(network: string, newConnection: AssetHubConnection | ApiPromise | null): Promise<void>;
    onConnectionRestored(network: string, connection: AssetHubConnection | ApiPromise): Promise<void>;
}

export class ConnectionManager {
    private static instance: ConnectionManager;
    private connections: Map<string, NetworkConnection> = new Map();
    private connectionHealth: Map<string, ConnectionHealth> = new Map();
    private endpointProvider: EndpointProvider;
    private initialized: boolean = false;
    private isShuttingDown: boolean = false;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private reconnectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
    
    // Observer pattern for services that depend on connections
    private connectionObservers: Map<string, Set<ConnectionObserver>> = new Map();

    private constructor() {
        this.endpointProvider = EndpointProvider.getInstance();
        this.initializeConnections();
        this.setupHealthChecking();
    }

    private initializeConnections(): void {
        Object.values(NETWORKS_SUPPORTED).forEach(network => {
            this.connections.set(network, {
                connection: null,
                isReady: false,
                isConnecting: false,
                lastConnected: null,
                consecutiveFailures: 0,
                lastError: null,
                currentEndpoint: null
            });
            
            this.connectionHealth.set(network, {
                isHealthy: false,
                lastCheck: new Date(0),
                responseTime: 0
            });
        });
    }

    private setupHealthChecking(): void {
        this.healthCheckInterval = setInterval(async () => {
            if (!this.isShuttingDown && this.initialized) {
                try {
                    await this.performHealthChecks();
                } catch (error) {
                    console.error('Health check error (non-fatal):', error);
                }
            }
        }, CONNECTION_HEALTH_CHECK_INTERVAL);
    }

    // Observer pattern methods
    public registerConnectionObserver(network: string, observer: ConnectionObserver): void {
        if (!this.connectionObservers.has(network)) {
            this.connectionObservers.set(network, new Set());
        }
        this.connectionObservers.get(network)!.add(observer);
        console.log(`🔔 Registered observer for ${network} connections`);
    }

    public unregisterConnectionObserver(network: string, observer: ConnectionObserver): void {
        const observers = this.connectionObservers.get(network);
        if (observers) {
            observers.delete(observer);
            if (observers.size === 0) {
                this.connectionObservers.delete(network);
            }
        }
    }

    private async notifyConnectionObservers(network: string, connection: AssetHubConnection | ApiPromise | null, isRestoration: boolean = false): Promise<void> {
        const observers = this.connectionObservers.get(network);
        if (!observers || observers.size === 0) return;

        console.log(`🔔 Notifying ${observers.size} observers of ${network} connection ${isRestoration ? 'restoration' : 'change'}`);
        
        const notificationPromises = Array.from(observers).map(async (observer) => {
            try {
                if (isRestoration && connection) {
                    await observer.onConnectionRestored(network, connection);
                } else {
                    await observer.onConnectionChanged(network, connection);
                }
            } catch (error) {
                console.error(`Error notifying connection observer for ${network}:`, error);
            }
        });

        await Promise.allSettled(notificationPromises);
    }

    private async performHealthChecks(): Promise<void> {
        const promises = Array.from(this.connections.keys()).map(async (network) => {
            const connection = this.connections.get(network);
            if (!connection?.isReady || !connection.connection) return;

            try {
                const startTime = Date.now();
                // Simplified validation - uses cached results from ConnectionFactory
                const isValid = await ConnectionFactory.validateConnection(connection.connection, network);
                
                if (!isValid) {
                    throw new Error('Connection validation failed');
                }
                
                const responseTime = Date.now() - startTime;
                
                this.connectionHealth.set(network, {
                    isHealthy: true,
                    lastCheck: new Date(),
                    responseTime
                });
            } catch (error) {
                console.warn(`Health check failed for ${network}:`, error);
                this.connectionHealth.set(network, {
                    isHealthy: false,
                    lastCheck: new Date(),
                    responseTime: 0
                });
                
                connection.isReady = false;
                this.scheduleReconnection(network);
            }
        });

        await Promise.allSettled(promises);
    }

    // Simplified connection event handler
    private handleConnectionEvent: ConnectionEventCallback = (network, event, error) => {
        const connection = this.connections.get(network);
        if (!connection) return;

        switch (event) {
            case 'connected':
                console.log(`✅ ${network} connection established`);
                connection.consecutiveFailures = 0;
                connection.lastError = null;
                connection.isReady = true;
                connection.lastConnected = new Date();
                this.connectionHealth.set(network, {
                    isHealthy: true,
                    lastCheck: new Date(),
                    responseTime: 0
                });
                this.notifyConnectionObservers(network, connection.connection, true).catch(console.error);
                break;

            case 'disconnected':
                console.warn(`⚠️ ${network} connection lost`);
                connection.isReady = false;
                this.connectionHealth.set(network, {
                    isHealthy: false,
                    lastCheck: new Date(),
                    responseTime: 0
                });
                this.notifyConnectionObservers(network, null).catch(console.error);
                if (connection.currentEndpoint) {
                    this.endpointProvider.markEndpointFailed(network, connection.currentEndpoint);
                }
                this.scheduleReconnection(network, 2000); // 2 second delay
                break;

            case 'error':
                console.error(`❌ ${network} connection error:`, error);
                connection.lastError = error || new Error('Unknown connection error');
                connection.isReady = false;
                this.connectionHealth.set(network, {
                    isHealthy: false,
                    lastCheck: new Date(),
                    responseTime: 0
                });
                this.notifyConnectionObservers(network, null).catch(console.error);
                if (connection.currentEndpoint) {
                    this.endpointProvider.markEndpointFailed(network, connection.currentEndpoint);
                }
                this.scheduleReconnection(network);
                break;
        }
    };

    private scheduleReconnection(network: string, customDelay?: number): void {
        // Clear any existing reconnection timeout
        const existingTimeout = this.reconnectionTimeouts.get(network);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            this.reconnectionTimeouts.delete(network);
        }

        const connectionState = this.connections.get(network);
        if (!connectionState || connectionState.isConnecting || this.isShuttingDown) {
            return;
        }

        // Simplified exponential backoff: 2s, 4s, 8s, 16s, max 30s
        const delay = customDelay || Math.min(
            2000 * Math.pow(2, connectionState.consecutiveFailures),
            30000
        );

        console.log(`🔄 Scheduling reconnection for ${network} in ${delay}ms (attempt ${connectionState.consecutiveFailures + 1})`);
        
        const timeout = setTimeout(async () => {
            this.reconnectionTimeouts.delete(network);
            if (this.isShuttingDown) return;
            
            try {
                await this.connectToNetwork(network);
            } catch (error) {
                console.error(`Reconnection failed for ${network}:`, error);
                connectionState.consecutiveFailures++;
                
                // Limit reconnection attempts
                if (connectionState.consecutiveFailures < 8) {
                    this.scheduleReconnection(network);
                } else {
                    console.error(`Max reconnection attempts reached for ${network}`);
                }
            }
        }, delay);

        this.reconnectionTimeouts.set(network, timeout);
    }

    private async connectToNetwork(network: string): Promise<void> {
        const connectionState = this.connections.get(network);
        if (!connectionState || connectionState.isConnecting) return;

        connectionState.isConnecting = true;
        connectionState.isReady = false;

        let selectedEndpoint: string | null = null;

        try {
            // Clean up existing connection first
            await this.cleanupConnection(network);

            selectedEndpoint = this.endpointProvider.getEndpoint(network);
            connectionState.currentEndpoint = selectedEndpoint;
            console.log(`🔌 Connecting to ${network} via ${selectedEndpoint}`);

            let connection: AssetHubConnection | ApiPromise;
            
            switch (network) {
                case NETWORKS_SUPPORTED.ASSET_HUB:
                    connection = await ConnectionFactory.createAssetHubConnection(selectedEndpoint, this.handleConnectionEvent);
                    break;
                case NETWORKS_SUPPORTED.HYDRA_DX:
                    connection = await ConnectionFactory.createHydradxConnection(selectedEndpoint, this.handleConnectionEvent);
                    break;
                default:
                    throw new Error(`Unsupported network: ${network}`);
            }

            // Basic validation
            const isValid = await ConnectionFactory.validateConnection(connection, network);
            if (!isValid) {
                throw new Error('Connection validation failed');
            }

            connectionState.connection = connection;
            connectionState.isReady = true;
            connectionState.lastConnected = new Date();
            connectionState.consecutiveFailures = 0;
            connectionState.lastError = null;

            this.connectionHealth.set(network, {
                isHealthy: true,
                lastCheck: new Date(),
                responseTime: 0
            });

            console.log(`✅ Successfully connected to ${network}`);
            await this.notifyConnectionObservers(network, connection, true);
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown connection error');
            connectionState.consecutiveFailures++;
            connectionState.lastError = err;
            
            if (selectedEndpoint) {
                this.endpointProvider.markEndpointFailed(network, selectedEndpoint);
            }
            
            console.error(`❌ Failed to connect to ${network}:`, err.message);
            throw err;
        } finally {
            connectionState.isConnecting = false;
        }
    }

    private async cleanupConnection(network: string): Promise<void> {
        const connectionState = this.connections.get(network);
        if (!connectionState?.connection) return;

        try {
            connectionState.isReady = false;
            
            if (network === NETWORKS_SUPPORTED.ASSET_HUB) {
                const connection = connectionState.connection as AssetHubConnection;
                await ConnectionFactory.disconnectAssetHub(connection);
            } else if (network === NETWORKS_SUPPORTED.HYDRA_DX) {
                const api = connectionState.connection as ApiPromise;
                await ConnectionFactory.disconnectHydradx(api);
            }
        } catch (error) {
            console.warn(`Error cleaning up ${network} connection:`, error);
        } finally {
            connectionState.connection = null;
            connectionState.isReady = false;
            connectionState.currentEndpoint = null;
            connectionState.isConnecting = false;
            
            this.connectionHealth.set(network, {
                isHealthy: false,
                lastCheck: new Date(),
                responseTime: 0
            });
        }
    }

    public static getInstance(): ConnectionManager {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('Initializing ConnectionManager...');
        
        try {
            const connectionPromises = Object.values(NETWORKS_SUPPORTED).map(network => 
                this.connectToNetwork(network).catch(error => {
                    console.warn(`Failed to initialize ${network}:`, error instanceof Error ? error.message : error);
                    return null;
                })
            );

            await Promise.allSettled(connectionPromises);
            
            this.initialized = true;
            console.log('✅ ConnectionManager initialization completed');
        } catch (error) {
            console.error('Error during ConnectionManager initialization:', error);
            this.initialized = true;
        }
    }

    public async waitForConnection(network: string, timeoutMs: number = 10000): Promise<boolean> {
        const connectionState = this.connections.get(network);
        if (!connectionState) return false;

        if (connectionState.isReady && connectionState.connection) {
            return true;
        }

        if (!connectionState.isConnecting) {
            this.connectToNetwork(network).catch(console.error);
        }

        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            if (connectionState.isReady && connectionState.connection) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return false;
    }

    public getAssetHubApi(): TypedApi<typeof polkadot_asset_hub> | null {
        const connection = this.connections.get(NETWORKS_SUPPORTED.ASSET_HUB);
        if (!connection?.isReady || !connection.connection) {
            return null;
        }
        
        const assetHubConnection = connection.connection as AssetHubConnection;
        return assetHubConnection.api;
    }

    public getHydradxApi(): ApiPromise | null {
        const connection = this.connections.get(NETWORKS_SUPPORTED.HYDRA_DX);
        if (!connection?.isReady || !connection.connection) {
            return null;
        }
        
        const api = connection.connection as ApiPromise;
        
        // Quick connection check
        try {
            if (!api.isConnected) {
                console.warn('HydraDX API connection is stale, marking as not ready');
                connection.isReady = false;
                this.scheduleReconnection(NETWORKS_SUPPORTED.HYDRA_DX, 1000);
                return null;
            }
        } catch (error) {
            console.warn('Error checking HydraDX API connection state:', error);
            connection.isReady = false;
            this.scheduleReconnection(NETWORKS_SUPPORTED.HYDRA_DX, 1000);
            return null;
        }
        
        return api;
    }

    public async getAssetHubApiWithRetry(timeoutMs: number = 5000): Promise<TypedApi<typeof polkadot_asset_hub> | null> {
        const api = this.getAssetHubApi();
        if (api) return api;

        const isReady = await this.waitForConnection(NETWORKS_SUPPORTED.ASSET_HUB, timeoutMs);
        return isReady ? this.getAssetHubApi() : null;
    }

    public async getHydradxApiWithRetry(timeoutMs: number = 5000): Promise<ApiPromise | null> {
        try {
            let api = this.getHydradxApi();
            if (api) {
                // Quick validation for active connections
                try {
                    const isValid = await ConnectionFactory.validateConnection(api, NETWORKS_SUPPORTED.HYDRA_DX);
                    if (isValid) {
                        return api;
                    } else {
                        const connection = this.connections.get(NETWORKS_SUPPORTED.HYDRA_DX);
                        if (connection) {
                            connection.isReady = false;
                        }
                    }
                } catch (error) {
                    console.warn('HydraDX API validation error:', error);
                    const connection = this.connections.get(NETWORKS_SUPPORTED.HYDRA_DX);
                    if (connection) {
                        connection.isReady = false;
                    }
                }
            }

            const isReady = await this.waitForConnection(NETWORKS_SUPPORTED.HYDRA_DX, timeoutMs);
            return isReady ? this.getHydradxApi() : null;
        } catch (error) {
            console.error('Error in getHydradxApiWithRetry (non-fatal):', error);
            return null;
        }
    }

    public getConnectionStatus(): Record<string, { 
        isReady: boolean; 
        isHealthy: boolean; 
        lastError: string | null; 
        endpointStatus?: any; 
        consecutiveFailures?: number;
        currentEndpoint?: string | null;
        isConnecting?: boolean;
    }> {
        const status: Record<string, { 
            isReady: boolean; 
            isHealthy: boolean; 
            lastError: string | null; 
            endpointStatus?: any; 
            consecutiveFailures?: number;
            currentEndpoint?: string | null;
            isConnecting?: boolean;
        }> = {};
        
        for (const [network, connection] of this.connections) {
            const health = this.connectionHealth.get(network);
            const endpointStatus = this.endpointProvider.getEndpointStatus(network);
            
            status[network] = {
                isReady: connection.isReady,
                isHealthy: health?.isHealthy || false,
                lastError: connection.lastError?.message || null,
                endpointStatus,
                consecutiveFailures: connection.consecutiveFailures,
                currentEndpoint: connection.currentEndpoint,
                isConnecting: connection.isConnecting
            };
        }
        
        return status;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public async disconnect(): Promise<void> {
        this.isShuttingDown = true;
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        for (const timeout of this.reconnectionTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.reconnectionTimeouts.clear();

        try {
            const cleanupPromises = Array.from(this.connections.keys()).map(network => 
                this.cleanupConnection(network)
            );
            await Promise.all(cleanupPromises);
            
            this.initialized = false;
            console.log('ConnectionManager disconnected successfully');
        } catch (error) {
            console.error('Error during ConnectionManager disconnect:', error);
            throw error;
        } finally {
            this.isShuttingDown = false;
        }
    }
} 