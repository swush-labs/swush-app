import { TypedApi, PolkadotClient, createClient } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { NETWORKS_SUPPORTED, CONNECTION_TIMEOUT } from '../constants';

export interface AssetHubConnection {
  api: TypedApi<typeof polkadot_asset_hub>;
  client: PolkadotClient;
}

// Callback type for connection events
export type ConnectionEventCallback = (network: string, event: 'connected' | 'disconnected' | 'error', error?: Error) => void;

// Validation timeout - more generous than the hardcoded 2s
const VALIDATION_TIMEOUT = Math.max(CONNECTION_TIMEOUT * 0.5, 5000); // 50% of connection timeout, minimum 5 seconds

export class ConnectionFactory {
  
  public static async createAssetHubConnection(
    endpoint: string, 
    onConnectionEvent?: ConnectionEventCallback
  ): Promise<AssetHubConnection> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT);
    });

    const connectionPromise = async (): Promise<AssetHubConnection> => {
      try {
        const wsProvider = getWsProvider(endpoint);
        const client = createClient(withPolkadotSdkCompat(wsProvider));
        const api = client.getTypedApi(polkadot_asset_hub);

        // Basic validation
        if (!api || !client) {
          throw new Error('Failed to create API or client');
        }

        // Set up connection event monitoring for PAPI
        if (onConnectionEvent) {
          // PAPI doesn't have direct connection events, but we can monitor the client
          // We'll rely on health checks and validation for PAPI connections
          onConnectionEvent(NETWORKS_SUPPORTED.ASSET_HUB, 'connected');
        }

        return { api, client };
      } catch (error) {
        if (onConnectionEvent) {
          onConnectionEvent(NETWORKS_SUPPORTED.ASSET_HUB, 'error', error instanceof Error ? error : new Error('Unknown error'));
        }
        throw new Error(`Failed to create Asset Hub connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    return Promise.race([connectionPromise(), timeoutPromise]);
  }

  public static async createHydradxConnection(
    endpoint: string,
    onConnectionEvent?: ConnectionEventCallback
  ): Promise<ApiPromise> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT);
    });

    const connectionPromise = async (): Promise<ApiPromise> => {
      try {
        // Create provider with stable settings
        const provider = new WsProvider(endpoint, 2000); // Back to 2000ms for stability
        
        // Enhanced connection state monitoring - set up BEFORE creating API
        let connectionLost = false;
        let eventHandlersAttached = false;

        const api = await ApiPromise.create({
          provider,
          throwOnConnect: true,
          noInitWarn: true,
        });

        await api.isReady;

        // Set up robust event handling
        if (onConnectionEvent) {
          const setupEventHandlers = () => {
            if (eventHandlersAttached) return;
            
            try {
              // Primary: API-level events (most reliable)
              api.on('connected', () => {
                connectionLost = false;
                console.log(`HydraDX connected to ${endpoint}`);
                onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'connected');
              });

              api.on('disconnected', () => {
                if (!connectionLost) {
                  connectionLost = true;
                  console.warn(`HydraDX disconnected from ${endpoint}`);
                  onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'disconnected');
                }
              });

              api.on('error', (error: Error) => {
                if (!connectionLost) {
                  connectionLost = true;
                  console.error(`HydraDX connection error on ${endpoint}:`, error);
                  onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'error', error);
                }
              });

              // Secondary: Provider-level events (backup detection)
              const wsProvider = provider as any;
              if (wsProvider.websocket) {
                wsProvider.websocket.on('close', (code: number, reason: string) => {
                  if (!connectionLost) {
                    connectionLost = true;
                    console.warn(`HydraDX WebSocket closed - Code: ${code}, Reason: ${reason}`);
                    onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'disconnected');
                  }
                });

                wsProvider.websocket.on('error', (error: Error) => {
                  if (!connectionLost) {
                    connectionLost = true;
                    console.error(`HydraDX WebSocket error:`, error);
                    onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'error', error);
                  }
                });
              }
              
              eventHandlersAttached = true;
            } catch (error) {
              console.warn('Error setting up event handlers:', error);
              // Continue without provider events, rely on API events
            }
          };

          // Set up events immediately
          setupEventHandlers();
          
          // Retry event setup after a short delay in case WebSocket wasn't ready
          setTimeout(setupEventHandlers, 100);

          // Initial connected event
          onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'connected');
        }

        // Shorter stability check to reduce window for issues
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify connection is still active
        if (!api.isConnected) {
          throw new Error('Connection lost during initial stability check');
        }

        return api;
      } catch (error) {
        if (onConnectionEvent) {
          onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'error', error instanceof Error ? error : new Error('Unknown error'));
        }
        throw new Error(`Failed to create HydraDX connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    return Promise.race([connectionPromise(), timeoutPromise]);
  }

  public static async validateConnection(connection: any, network: string): Promise<boolean> {
    try {
      if (network === NETWORKS_SUPPORTED.ASSET_HUB) {
        // For Asset Hub (PAPI), check if AssetConversionApi is accessible
        const assetHubConn = connection as AssetHubConnection;
        if (!assetHubConn?.api?.apis?.AssetConversionApi) {
          return false;
        }
        return true;
      } 
      
      if (network === NETWORKS_SUPPORTED.HYDRA_DX) {
        // For HydraDX (Polkadot.js), perform comprehensive validation
        const hydraApi = connection as ApiPromise;
        
        // Basic connection check
        if (!hydraApi?.isConnected) {
          return false;
        }

        // Enhanced validation: attempt an actual query to detect stale connections
        try {
          // Use a lightweight query with configurable timeout based on CONNECTION_TIMEOUT
          const validationPromise = hydraApi.rpc.system.chain();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Validation timeout')), VALIDATION_TIMEOUT)
          );
          
          await Promise.race([validationPromise, timeoutPromise]);
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Only log as warning if it's not a timeout (timeouts are expected during network issues)
          if (errorMessage.includes('Validation timeout')) {
            console.warn(`HydraDX connection validation timed out after ${VALIDATION_TIMEOUT}ms`);
          } else {
            console.warn(`HydraDX connection validation failed:`, errorMessage);
          }
          return false;
        }
      }

      return false;
    } catch (error) {
      console.warn(`Connection validation failed for ${network}:`, error);
      return false;
    }
  }

  public static async disconnectAssetHub(connection: AssetHubConnection): Promise<void> {
    try {
      await Promise.race([
        connection.client?.destroy(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000))
      ]);
    } catch (error) {
      console.warn('Error disconnecting Asset Hub connection:', error);
    }
  }

  public static async disconnectHydradx(connection: ApiPromise): Promise<void> {
    try {
      await Promise.race([
        connection?.disconnect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000))
      ]);
    } catch (error) {
      console.warn('Error disconnecting HydraDX connection:', error);
    }
  }
} 