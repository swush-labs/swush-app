// services/RpcConnection.ts
import { ApiPromise, WsProvider } from '@polkadot/api';
import { createClient, PolkadotClient, TypedApi } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { polkadot_asset_hub, polkadot, hydration } from '@polkadot-api/descriptors';

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

type ApiReturnType = ApiPromise | TypedApi<any> | { api: TypedApi<any>, client: PolkadotClient };

interface IApiWrapper {
  connect(rpcUrl: string, chainType?: 'asset-hub' | 'polkadot' | 'hydration'): Promise<ApiReturnType>;
  getApi(): ApiPromise | TypedApi<any> | null;
  getSigner(): any;
  disconnect(): Promise<void>;
}

class PolkadotApiWrapper implements IApiWrapper {
  private api: ApiPromise | null = null;
  private currentUrl: string | null = null;
  private provider: WsProvider | null = null;

  async connect(rpcUrl: string): Promise<ApiPromise> {
    try {
      if (!this.api || this.currentUrl !== rpcUrl) {
        this.provider = new WsProvider(rpcUrl);
        this.api = await ApiPromise.create({ 
          provider: this.provider,
          throwOnConnect: true,
          noInitWarn: true,
        });

        await this.api.isReady;
        this.currentUrl = rpcUrl;
        console.log(`Connected to ${rpcUrl} using Polkadot API`);
      }
      return this.api;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Connection failed: ${errorMessage}`);
      throw new Error(`Connection failed: ${errorMessage}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.api) {
      await this.api.disconnect();
      this.api = null;
    }
    
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
    }
    
    this.currentUrl = null;
  }

  getApi(): ApiPromise | null {
    return this.api;
  }

  getSigner(): any {
    throw new Error('Polkadot API does not support signer');
  }
}

class PapiWrapper implements IApiWrapper {
  private client: ReturnType<typeof createClient> | null = null;
  private typedApi: TypedApi<any> | null = null;
  private currentUrl: string | null = null;
  private signer: any = null;

  async connect(rpcUrl: string, chainType: 'asset-hub' | 'polkadot' | 'hydration' = 'polkadot'): Promise<{ api: TypedApi<any>, client: PolkadotClient }> {
    try {
      if (!this.client || this.currentUrl !== rpcUrl) {
        const wsProvider = getWsProvider(rpcUrl);
        this.client = createClient(withPolkadotSdkCompat(wsProvider));
        
        const chainDescriptor = (() => {
          switch (chainType) {
            case 'asset-hub': return polkadot_asset_hub;
            case 'polkadot': return polkadot;
            case 'hydration': return hydration;
            default: throw new Error(`Unsupported chain type: ${chainType}`);
          }
        })();
        
        this.typedApi = this.client.getTypedApi(chainDescriptor);
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
      console.error(`Connection failed: ${errorMessage}`);
      throw new Error(`Connection failed: ${errorMessage}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy(); // Ensure to call the destroy method to clean up subscriptions and connections
      this.client = null;
    }
    
    this.typedApi = null;
    this.currentUrl = null;
  }

  getApi(): TypedApi<any> | null {
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

  public async connect(rpcUrl: string, chainType?: 'asset-hub' | 'polkadot' | 'hydration'): Promise<ApiReturnType> {
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


