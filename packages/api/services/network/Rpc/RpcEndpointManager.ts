import { NetworkConfig, DEFAULT_RPC_CONFIG } from './rpc-config';
import { HEALTH_CHECK } from '../../constants';
import EventEmitter from 'events';
import WebSocket from 'ws';

interface EndpointEvent {
  network: string;
  url: string;
  error?: string;
}

export class RpcEndpointManager extends EventEmitter {
  private static instance: RpcEndpointManager;
  private networkConfigs: Record<string, NetworkConfig>;
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  private constructor(config?: Record<string, NetworkConfig>) {
    super();
    this.networkConfigs = config || DEFAULT_RPC_CONFIG;
    this.setupHealthChecks();
  }

  public static getInstance(config?: Record<string, NetworkConfig>): RpcEndpointManager {
    if (!RpcEndpointManager.instance) {
      RpcEndpointManager.instance = new RpcEndpointManager(config);
    }
    return RpcEndpointManager.instance;
  }

  private setupHealthChecks(): void {
    Object.entries(this.networkConfigs).forEach(([network, config]) => {
      const interval = setInterval(() => {
        this.checkEndpointsHealth(network);
      }, config.healthCheck.interval);
      
      this.healthCheckIntervals.set(network, interval);
    });
  }

  private async checkEndpointsHealth(network: string): Promise<void> {
    const config = this.networkConfigs[network];
    if (!config) return;

    for (const endpoint of config.endpoints) {
      try {
        const ws = new WebSocket(endpoint.url);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Health check timeout'));
          }, config.healthCheck.timeout);

          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(true);
          };

          ws.onerror = (event: WebSocket.ErrorEvent) => {
            clearTimeout(timeout);
            reject(new Error(event.message || 'WebSocket connection failed'));
          };
        });

        endpoint.isActive = true;
        endpoint.lastChecked = new Date();
        endpoint.lastError = undefined;
      } catch (error) {
        endpoint.isActive = false;
        endpoint.lastChecked = new Date();
        endpoint.lastError = error instanceof Error ? error.message : 'Unknown error';
        
        this.emit('endpointError', {
          network,
          url: endpoint.url,
          error: endpoint.lastError
        } as EndpointEvent);
      }
    }
  }

  public getEndpoint(network: string): string {
    const config = this.networkConfigs[network];
    if (!config) {
      throw new Error(`No configuration found for network: ${network}`);
    }

    const activeEndpoints = config.endpoints
      .filter(e => e.isActive)
      .sort((a, b) => a.priority - b.priority);

    if (activeEndpoints.length === 0) {
      // If no active endpoints, try the first one from the original list
      const fallbackEndpoint = config.endpoints[0];
      if (!fallbackEndpoint) {
        throw new Error(`No endpoints available for network: ${network}`);
      }
      return fallbackEndpoint.url;
    }

    // Get the next endpoint using round-robin
    config.currentIndex = (config.currentIndex + 1) % activeEndpoints.length;
    return activeEndpoints[config.currentIndex].url;
  }

  public markEndpointError(network: string, url: string, error: Error): void {
    const config = this.networkConfigs[network];
    if (!config) return;

    const endpoint = config.endpoints.find(e => e.url === url);
    if (endpoint) {
      endpoint.isActive = false;
      endpoint.lastError = error.message;
      endpoint.lastChecked = new Date();

      this.emit('endpointError', {
        network,
        url,
        error: error.message
      } as EndpointEvent);

      // Schedule re-activation after configured time
      setTimeout(() => {
        if (endpoint.lastError === error.message) {
          endpoint.isActive = true;
          endpoint.lastError = undefined;
          this.emit('endpointRecovered', {
            network,
            url
          } as EndpointEvent);
        }
      }, HEALTH_CHECK.REACTIVATION);
    }
  }

  public getNetworkConfig(network: string): NetworkConfig | undefined {
    return this.networkConfigs[network];
  }

  public cleanup(): void {
    this.healthCheckIntervals.forEach(interval => clearInterval(interval));
    this.healthCheckIntervals.clear();
    this.removeAllListeners();
  }
} 