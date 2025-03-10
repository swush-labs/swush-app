import { NetworkConfig, DEFAULT_RPC_CONFIG, RpcEndpoint } from './rpc-config';
import { HEALTH_CHECK } from '../../constants';
import EventEmitter from 'events';
import WebSocket from 'ws';

interface EndpointEvent {
  network: string;
  url: string;
  error?: string;
  nextUrl?: string;
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
        await this.checkSingleEndpoint(network, endpoint);
      } catch (error) {
        // Only mark as error if all retries fail
        await this.handleEndpointError(network, endpoint, error);
      }
    }
  }

  private async checkSingleEndpoint(network: string, endpoint: RpcEndpoint): Promise<void> {
    const config = this.networkConfigs[network];
    const maxRetries = 2; // Number of retries before marking as failed
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const ws = new WebSocket(endpoint.url);
        let isConnectionClosed = false;

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (!isConnectionClosed) {
              ws.close();
              reject(new Error('Health check timeout'));
            }
          }, config.healthCheck.timeout);

          ws.onopen = () => {
            ws.send(JSON.stringify({
              id: 1,
              jsonrpc: '2.0',
              method: 'system_health',
              params: []
            }));
          };

          ws.onmessage = (event) => {
            try {
              const response = JSON.parse(event.data.toString());
              if (response.result || response.error) {
                clearTimeout(timeout);
                isConnectionClosed = true;
                ws.close();
                resolve(true);
              }
            } catch (error) {
              clearTimeout(timeout);
              isConnectionClosed = true;
              ws.close();
              reject(new Error('Invalid response from node'));
            }
          };

          ws.onerror = (event: WebSocket.ErrorEvent) => {
            clearTimeout(timeout);
            isConnectionClosed = true;
            ws.close();
            reject(new Error(event.message || 'WebSocket connection failed'));
          };

          ws.onclose = (event) => {
            if (!isConnectionClosed) {
              clearTimeout(timeout);
              isConnectionClosed = true;
              reject(new Error(`Connection closed with code ${event.code}: ${event.reason || 'Unknown reason'}`));
            }
          };
        });

        // If we reach here, the health check was successful
        endpoint.isActive = true;
        endpoint.lastChecked = new Date();
        endpoint.lastError = undefined;
        
        // If this endpoint was previously marked as error, emit a recovery event
        if (endpoint.lastError) {
          this.emit('endpointRecovered', {
            network,
            url: endpoint.url
          });
        }
        
        return; // Success, exit the retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // If we get here, all retries failed
    throw lastError;
  }

  private async handleEndpointError(network: string, endpoint: RpcEndpoint, error: unknown): Promise<void> {
    endpoint.isActive = false;
    endpoint.lastChecked = new Date();
    endpoint.lastError = error instanceof Error ? error.message : 'Unknown error';
    
    this.emit('endpointError', {
      network,
      url: endpoint.url,
      error: endpoint.lastError
    });

    // Check if all endpoints are down for this network
    const allEndpointsDown = this.networkConfigs[network].endpoints.every(e => !e.isActive);
    if (allEndpointsDown) {
      this.emit('networkDown', { network });
    }
  }

  public getEndpoint(network: string): string {
    const config = this.networkConfigs[network];
    if (!config) {
      throw new Error(`No configuration found for network: ${network}`);
    }

    // Get active endpoints sorted by priority
    const activeEndpoints = config.endpoints
      .filter(e => e.isActive)
      .sort((a, b) => a.priority - b.priority);

    if (activeEndpoints.length === 0) {
      // If no active endpoints, try to reactivate the highest priority endpoint
      const highestPriorityEndpoint = [...config.endpoints].sort((a, b) => a.priority - b.priority)[0];
      if (!highestPriorityEndpoint) {
        throw new Error(`No endpoints available for network: ${network}`);
      }
      highestPriorityEndpoint.isActive = true;
      return highestPriorityEndpoint.url;
    }

    // Get the current endpoint
    const currentIndex = config.currentIndex % activeEndpoints.length;
    return activeEndpoints[currentIndex].url;
  }

  public async markEndpointError(network: string, url: string, error: Error): Promise<string | null> {
    const config = this.networkConfigs[network];
    if (!config) return null;

    const endpoint = config.endpoints.find(e => e.url === url);
    if (!endpoint) return null;

    // Mark current endpoint as inactive
    endpoint.isActive = false;
    endpoint.lastError = error.message;
    endpoint.lastChecked = new Date();

    // Try to find next best endpoint
    const activeEndpoints = config.endpoints
      .filter(e => e.isActive && e.url !== url)
      .sort((a, b) => a.priority - b.priority);

    let nextUrl: string | null = null;

    if (activeEndpoints.length > 0) {
      // Update the current index to point to the next best endpoint
      const nextEndpoint = activeEndpoints[0];
      config.currentIndex = config.endpoints.findIndex(e => e.url === nextEndpoint.url);
      nextUrl = nextEndpoint.url;
    } else {
      // If no active endpoints, try to reactivate the highest priority endpoint
      const highestPriorityEndpoint = [...config.endpoints]
        .filter(e => e.url !== url) // Don't reactivate the one that just failed
        .sort((a, b) => a.priority - b.priority)[0];

      if (highestPriorityEndpoint) {
        highestPriorityEndpoint.isActive = true;
        config.currentIndex = config.endpoints.findIndex(e => e.url === highestPriorityEndpoint.url);
        nextUrl = highestPriorityEndpoint.url;
      }
    }

    // Emit the error event with the next URL if available
    this.emit('endpointError', {
      network,
      url,
      error: error.message,
      nextUrl
    } as EndpointEvent);

    // Schedule reactivation after configured time
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

    return nextUrl;
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