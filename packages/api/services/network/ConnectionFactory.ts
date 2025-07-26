import { TypedApi, PolkadotClient, createClient } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { NETWORKS_SUPPORTED, CONNECTION_TIMEOUT, VALIDATION_CACHE_TTL } from '../constants';

export interface AssetHubConnection {
  api: TypedApi<typeof polkadot_asset_hub>;
  client: PolkadotClient;
}

// Callback type for connection events
export type ConnectionEventCallback = (network: string, event: 'connected' | 'disconnected' | 'error', error?: Error) => void;

// Validation cache for performance
const validationCache = new Map<string, { isValid: boolean; timestamp: number }>();

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

        // Simple connection event notification for PAPI
        if (onConnectionEvent) {
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
        // Create provider with reasonable timeout
        const provider = new WsProvider(endpoint, 1500);
        
        const api = await ApiPromise.create({
          provider,
          throwOnConnect: true,
          noInitWarn: true,
        });

        await api.isReady;

        // Simplified event handling
        if (onConnectionEvent) {
          api.on('connected', () => {
            console.log(`HydraDX connected to ${endpoint}`);
            onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'connected');
          });

          api.on('disconnected', () => {
            console.warn(`HydraDX disconnected from ${endpoint}`);
            onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'disconnected');
          });

          api.on('error', (error: Error) => {
            console.error(`HydraDX connection error on ${endpoint}:`, error);
            onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'error', error);
          });

          // Initial connected event
          onConnectionEvent(NETWORKS_SUPPORTED.HYDRA_DX, 'connected');
        }

        // Basic connection test - no extended stability delays
        try {
          await Promise.race([
            api.rpc.system.chain(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connection test timeout')), 2000))
          ]);
        } catch (error) {
          throw new Error(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      // Check cache first for performance
      const cacheKey = `${network}_${Date.now()}`;
      const cached = validationCache.get(network);
      if (cached && Date.now() - cached.timestamp < VALIDATION_CACHE_TTL) {
        return cached.isValid;
      }

      let isValid = false;

      if (network === NETWORKS_SUPPORTED.ASSET_HUB) {
        // For Asset Hub (PAPI), check if AssetConversionApi is accessible
        const assetHubConn = connection as AssetHubConnection;
        isValid = !!(assetHubConn?.api?.apis?.AssetConversionApi);
      } else if (network === NETWORKS_SUPPORTED.HYDRA_DX) {
        // For HydraDX (Polkadot.js), perform basic validation
        const hydraApi = connection as ApiPromise;
        
        // Basic connection check
        if (!hydraApi?.isConnected) {
          isValid = false;
        } else {
          // Lightweight query with timeout
          try {
            const validationPromise = hydraApi.rpc.system.chain();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Validation timeout')), 3000)
            );
            
            await Promise.race([validationPromise, timeoutPromise]);
            isValid = true;
          } catch (error) {
            console.warn(`HydraDX connection validation failed:`, error);
            isValid = false;
          }
        }
      }

      // Cache the result
      validationCache.set(network, { isValid, timestamp: Date.now() });
      
      // Clean up old cache entries
      if (validationCache.size > 10) {
        const now = Date.now();
        for (const [key, value] of validationCache.entries()) {
          if (now - value.timestamp > VALIDATION_CACHE_TTL) {
            validationCache.delete(key);
          }
        }
      }

      return isValid;
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
      if (!connection) return;
      
      await Promise.race([
        connection.disconnect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000))
      ]);
    } catch (error) {
      console.warn('Error disconnecting HydraDX connection:', error);
    }
  }
} 