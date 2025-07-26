import { NETWORK_ENDPOINTS } from '../constants';

interface NetworkEndpoints {
  [key: string]: readonly string[];
}

interface EndpointState {
  lastUsed: Date;
  failureCount: number;
  lastFailureTime: Date;
}

export class EndpointProvider {
  private static instance: EndpointProvider;
  private endpoints: NetworkEndpoints;
  private currentIndex: Record<string, number> = {};
  private endpointStates: Map<string, EndpointState> = new Map();
  private failedEndpoints: Map<string, Set<string>> = new Map(); // Simple failed tracking per network

  // Simplified configuration
  private readonly ENDPOINT_RETRY_DELAY = 60000; // 1 minute before retrying failed endpoint

  private constructor() {
    this.endpoints = NETWORK_ENDPOINTS;

    // Initialize tracking for each network
    Object.keys(this.endpoints).forEach(network => {
      this.currentIndex[network] = 0;
      this.failedEndpoints.set(network, new Set());
      
      // Initialize endpoint states for monitoring
      this.endpoints[network].forEach(endpoint => {
        this.endpointStates.set(endpoint, {
          lastUsed: new Date(0),
          failureCount: 0,
          lastFailureTime: new Date(0)
        });
      });
    });
  }

  public static getInstance(): EndpointProvider {
    if (!EndpointProvider.instance) {
      EndpointProvider.instance = new EndpointProvider();
    }
    return EndpointProvider.instance;
  }

  public getEndpoint(network: string): string {
    const networkEndpoints = this.endpoints[network];
    if (!networkEndpoints || networkEndpoints.length === 0) {
      throw new Error(`No endpoints configured for network: ${network}`);
    }

    const failedForNetwork = this.failedEndpoints.get(network) || new Set();
    const now = new Date();

    // Get available endpoints (not failed or failed long enough ago to retry)
    const availableEndpoints = networkEndpoints.filter(endpoint => {
      if (!failedForNetwork.has(endpoint)) return true;
      
      // Check if enough time has passed to retry failed endpoint
      const state = this.endpointStates.get(endpoint);
      const timeSinceFailure = now.getTime() - (state?.lastFailureTime.getTime() || 0);
      return timeSinceFailure > this.ENDPOINT_RETRY_DELAY;
    });

    // If no endpoints available, clear failed list and start over
    if (availableEndpoints.length === 0) {
      console.warn(`All endpoints failed for ${network}, clearing failed list`);
      failedForNetwork.clear();
      return networkEndpoints[0];
    }

    // Simple round-robin selection from available endpoints
    const index = this.currentIndex[network] % availableEndpoints.length;
    this.currentIndex[network] = (this.currentIndex[network] + 1) % availableEndpoints.length;
    const selectedEndpoint = availableEndpoints[index];

    // Update state
    const state = this.endpointStates.get(selectedEndpoint);
    if (state) {
      state.lastUsed = now;
    }

    // Remove from failed list if it was there (retry)
    failedForNetwork.delete(selectedEndpoint);

    return selectedEndpoint;
  }

  public markEndpointFailed(network: string, endpoint: string): void {
    const failedForNetwork = this.failedEndpoints.get(network);
    if (failedForNetwork) {
      failedForNetwork.add(endpoint);
    }

    // Update endpoint state
    const state = this.endpointStates.get(endpoint);
    if (state) {
      state.failureCount++;
      state.lastFailureTime = new Date();
      console.warn(`Marked endpoint as failed: ${endpoint} (failure count: ${state.failureCount})`);
    }
  }

  public clearFailedEndpoints(network?: string): void {
    if (network) {
      // Clear failed endpoints for specific network
      const failedForNetwork = this.failedEndpoints.get(network);
      if (failedForNetwork) {
        failedForNetwork.clear();
      }
      console.log(`Cleared failed endpoints for ${network}`);
    } else {
      // Clear all failed endpoints
      this.failedEndpoints.forEach(failed => failed.clear());
      console.log('Cleared all failed endpoints');
    }
  }

  public getEndpointStatus(network: string): { 
    total: number; 
    available: number; 
    failed: string[];
    endpointDetails: Record<string, { failureCount: number; lastUsed: string; isFailed: boolean }>;
  } {
    const networkEndpoints = this.endpoints[network] || [];
    const failedForNetwork = this.failedEndpoints.get(network) || new Set();
    
    const endpointDetails: Record<string, { failureCount: number; lastUsed: string; isFailed: boolean }> = {};
    networkEndpoints.forEach(endpoint => {
      const state = this.endpointStates.get(endpoint);
      endpointDetails[endpoint] = {
        failureCount: state?.failureCount || 0,
        lastUsed: state?.lastUsed.toISOString() || 'never',
        isFailed: failedForNetwork.has(endpoint)
      };
    });
    
    return {
      total: networkEndpoints.length,
      available: networkEndpoints.length - failedForNetwork.size,
      failed: Array.from(failedForNetwork),
      endpointDetails
    };
  }
} 