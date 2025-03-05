// services/RpcConnection.ts
import { ApiPromise, WsProvider } from '@polkadot/api';
import { createClient, PolkadotClient, TypedApi } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { NETWORKS_SUPPORTED } from '../../constants';
import { CHAIN_DESCRIPTORS, NetworkType, PapiConnection, SupportedChains } from '../types';
import { CONNECTION_CONFIG } from '../../constants';

/**
 * Example usage:
 * 
 * // Using Polkadot API
const polkadotConn = RpcConnection.getInstance('polkadotjs');
await polkadotConn.connect('wss://your-endpoint');
const polkadotApi = polkadotConn.getApi();

// Using PAPI
const papiConn = RpcConnection.getInstance('papi');
await papiConn.connect('wss://your-endpoint');
const papiApi = papiConn.getApi();
 * 
 */

type ApiType = 'polkadotjs' | 'papi';

type ApiReturnType = ApiPromise | PapiConnection;

interface IApiWrapper {
  connect(rpcUrl: string, chainType?: NetworkType): Promise<ApiReturnType>;
  getApi(): ApiPromise | TypedApi<SupportedChains> | null;
  getSigner(): any;
  disconnect(): Promise<void>;
}

class PolkadotApiWrapper implements IApiWrapper {
  private api: ApiPromise | null = null;
  private currentUrl: string | null = null;
  private provider: WsProvider | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;

  async connect(rpcUrl: string): Promise<ApiPromise> {
    if (this.isConnecting) {
      throw new Error('Connection attempt already in progress');
    }

    try {
      this.isConnecting = true;

      if (!this.api || this.currentUrl !== rpcUrl) {
        // Clean up any existing connection first
        await this.disconnect();

        this.provider = new WsProvider(rpcUrl, CONNECTION_CONFIG.BASE_RECONNECT_DELAY);

        // Add event handlers for the provider
        this.provider.on('error', (error: Error) => {
          console.error(`WebSocket error for ${rpcUrl}:`, error);
        });

        this.provider.on('disconnected', () => {
          if (this.reconnectAttempts >= CONNECTION_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            console.error(`Max reconnection attempts (${CONNECTION_CONFIG.MAX_RECONNECT_ATTEMPTS}) reached for ${rpcUrl}`);
            // Force cleanup after max attempts
            this.disconnect().catch(err => {
              console.error('Error during forced disconnect:', err);
            });
            return;
          }
          console.warn(`Disconnected from ${rpcUrl} (attempt ${this.reconnectAttempts + 1}/${CONNECTION_CONFIG.MAX_RECONNECT_ATTEMPTS})`);
          this.reconnectAttempts++;
        });

        this.provider.on('connected', () => {
          console.log(`Connected to ${rpcUrl}`);
          this.reconnectAttempts = 0;
        });

        const connectionPromise = ApiPromise.create({ 
          provider: this.provider,
          throwOnConnect: true,
          noInitWarn: true,
        }).catch(error => {
          throw new Error(`ApiPromise creation failed: ${error.message}`);
        });

        // Add timeout for the connection
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeout = setTimeout(() => {
            clearTimeout(timeout);
            reject(new Error(`Connection timeout after ${CONNECTION_CONFIG.CONNECTION_TIMEOUT}ms`));
          }, CONNECTION_CONFIG.CONNECTION_TIMEOUT);
        });

        this.api = await Promise.race([connectionPromise, timeoutPromise]);
        
        try {
          await this.api.isReady;
          this.currentUrl = rpcUrl;
          console.log(`Connected to ${rpcUrl} using Polkadot API`);
        } catch (error) {
          throw new Error(`API not ready: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      return this.api;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Connection failed: ${errorMessage}`);
      // Clean up on error
      await this.disconnect().catch(err => {
        console.error('Error during cleanup:', err);
      });
      throw new Error(`Connection failed: ${errorMessage}`);
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    const disconnectPromise = async () => {
      try {
        if (this.api) {
          await Promise.race([
            this.api.disconnect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000))
          ]);
          this.api = null;
        }
      } catch (error) {
        console.warn('Error disconnecting API:', error);
        this.api = null;
      }

      try {
        if (this.provider) {
          await Promise.race([
            this.provider.disconnect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Provider disconnect timeout')), 5000))
          ]);
          this.provider = null;
        }
      } catch (error) {
        console.warn('Error disconnecting provider:', error);
        this.provider = null;
      }

      this.currentUrl = null;
      this.reconnectAttempts = 0;
      this.isConnecting = false;
    };

    // Ensure disconnect completes or times out
    await Promise.race([
      disconnectPromise(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 10000))
    ]).catch(error => {
      console.warn('Disconnect timed out:', error);
      // Force cleanup
      this.api = null;
      this.provider = null;
      this.currentUrl = null;
      this.reconnectAttempts = 0;
      this.isConnecting = false;
    });
  }

  getApi(): ApiPromise | null {
    return this.api;
  }

  getSigner(): any {
    throw new Error('Polkadot API does not support signer');
  }
}

class PapiWrapper implements IApiWrapper {
  private client: PolkadotClient | null = null;
  private typedApi: TypedApi<SupportedChains> | null = null;
  private currentUrl: string | null = null;
  private signer: any = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;

  async connect(rpcUrl: string, chainType: NetworkType): Promise<PapiConnection> {
    if (this.isConnecting) {
      throw new Error('Connection attempt already in progress');
    }

    try {
      this.isConnecting = true;

      if (!this.client || this.currentUrl !== rpcUrl) {
        // Clean up any existing connection first
        await this.disconnect();

        const wsProvider = getWsProvider(rpcUrl);
        
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeout = setTimeout(() => {
            clearTimeout(timeout);
            reject(new Error(`Connection timeout after ${CONNECTION_CONFIG.CONNECTION_TIMEOUT}ms`));
          }, CONNECTION_CONFIG.CONNECTION_TIMEOUT);
        });

        // Create the connection promise
        const connectionPromise = async () => {
          const client = createClient(withPolkadotSdkCompat(wsProvider));
          
          const chainDescriptor = CHAIN_DESCRIPTORS[chainType];
          if (!chainDescriptor) {
            throw new Error(`Unsupported chain type: ${chainType}`);
          }

          const typedApi = client.getTypedApi(chainDescriptor) as TypedApi<SupportedChains>;
          
          // Basic check to verify we have a working API
          if (!typedApi || !client) {
            throw new Error('Failed to initialize API client');
          }
          
          return { client, typedApi };
        };

        // Race between connection and timeout
        const { client, typedApi } = await Promise.race([
          connectionPromise(),
          timeoutPromise
        ]);

        this.client = client;
        this.typedApi = typedApi;
        this.currentUrl = rpcUrl;
        console.log(`Connected to ${rpcUrl} using PAPI`);
      }
      
      if (!this.typedApi || !this.client) {
        throw new Error('Failed to initialize PAPI client');
      }
      
      return { 
        api: this.typedApi, 
        client: this.client 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`PAPI connection failed: ${errorMessage}`);
      // Clean up on error
      await this.disconnect().catch(err => {
        console.error('Error during PAPI cleanup:', err);
      });
      throw new Error(`PAPI connection failed: ${errorMessage}`);
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    const disconnectPromise = async () => {
      try {
        if (this.client) {
          await Promise.race([
            this.client.destroy(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Client destroy timeout')), 5000))
          ]);
        }
      } catch (error) {
        console.warn('Error destroying PAPI client:', error);
      } finally {
        this.client = null;
        this.typedApi = null;
        this.currentUrl = null;
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      }
    };

    // Ensure disconnect completes or times out
    await Promise.race([
      disconnectPromise(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('PAPI disconnect timeout')), 10000))
    ]).catch(error => {
      console.warn('PAPI disconnect timed out:', error);
      // Force cleanup
      this.client = null;
      this.typedApi = null;
      this.currentUrl = null;
      this.reconnectAttempts = 0;
      this.isConnecting = false;
    });
  }

  getApi(): TypedApi<SupportedChains> | null {
    return this.typedApi;
  }

  setSigner(signer: any) {
    this.signer = signer;
  }

  getSigner(): any {
    return this.signer;
  }
}

class RpcConnection {
  private static instances: Map<ApiType, RpcConnection> = new Map();
  private apiWrapper: IApiWrapper;

  private constructor(apiType: ApiType) {
    this.apiWrapper = apiType === 'polkadotjs' 
      ? new PolkadotApiWrapper() 
      : new PapiWrapper();
  }

  public static getInstance(apiType: ApiType): RpcConnection {
    if (!this.instances.has(apiType)) {
      this.instances.set(apiType, new RpcConnection(apiType));
    }
    return this.instances.get(apiType)!;
  }

  public static clearInstances(): void {
    this.instances.forEach(instance => {
      instance.disconnect();
    });
    this.instances.clear();
  }

  public async connect(rpcUrl: string, chainType?: NetworkType): Promise<ApiReturnType> {
    return this.apiWrapper.connect(rpcUrl, chainType);
  }

  public getApi(): ApiPromise | TypedApi<any> | null {
    return this.apiWrapper.getApi();
  }

  public async disconnect(): Promise<void> {
    await this.apiWrapper.disconnect();
  }
}

export default RpcConnection;


