import { NETWORK_ENDPOINTS } from '../constants';

interface NetworkEndpoints {
  [key: string]: readonly string[];
}

interface EndpointState {
  lastUsed: Date;
  failureCount: number;
  isBlacklisted: boolean;
  lastFailureTime: Date;
}

interface CircuitBreakerState {
  isOpen: boolean;
  lastFailureTime: Date;
  consecutiveFailures: number;
  nextRetryTime: Date;
}

export class EndpointProvider {
  private static instance: EndpointProvider;
  private endpoints: NetworkEndpoints;
  private currentIndex: Record<string, number> = {};
  private endpointStates: Map<string, EndpointState> = new Map();
  private lastEndpointUsed: Record<string, string> = {};
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  // Circuit breaker configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3; // All endpoints must fail this many times
  private readonly CIRCUIT_BREAKER_BASE_DELAY = 30000; // 30 seconds base delay
  private readonly CIRCUIT_BREAKER_MAX_DELAY = 300000; // 5 minutes max delay
  private readonly ENDPOINT_RETRY_DELAY = 60000; // 1 minute before retrying a failed endpoint

  private constructor() {
    // Use endpoints from constants
    this.endpoints = NETWORK_ENDPOINTS;

    // Initialize current index and endpoint states for each network
    Object.keys(this.endpoints).forEach(network => {
      this.currentIndex[network] = 0;
      this.lastEndpointUsed[network] = '';
      
      // Initialize circuit breaker state
      this.circuitBreakers.set(network, {
        isOpen: false,
        lastFailureTime: new Date(0),
        consecutiveFailures: 0,
        nextRetryTime: new Date(0)
      });
      
      // Initialize endpoint states
      this.endpoints[network].forEach(endpoint => {
        this.endpointStates.set(endpoint, {
          lastUsed: new Date(0),
          failureCount: 0,
          isBlacklisted: false,
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

    // Check circuit breaker
    const circuitBreaker = this.circuitBreakers.get(network);
    if (circuitBreaker?.isOpen && new Date() < circuitBreaker.nextRetryTime) {
      const remainingTime = Math.ceil((circuitBreaker.nextRetryTime.getTime() - Date.now()) / 1000);
      throw new Error(`Circuit breaker open for ${network}, retry in ${remainingTime}s`);
    }

    // Get available (non-blacklisted or recently failed) endpoints
    const now = new Date();
    const availableEndpoints = networkEndpoints.filter(endpoint => {
      const state = this.endpointStates.get(endpoint);
      if (!state) return true;
      
      // Not blacklisted
      if (!state.isBlacklisted) return true;
      
      // Or blacklisted but enough time has passed for retry
      const timeSinceFailure = now.getTime() - state.lastFailureTime.getTime();
      return timeSinceFailure > this.ENDPOINT_RETRY_DELAY;
    });

    // If all endpoints are still failing, check if we should open circuit breaker
    if (availableEndpoints.length === 0) {
      this.handleAllEndpointsFailed(network);
      
      // Try to find the oldest failed endpoint to retry
      const oldestFailure = this.findOldestFailedEndpoint(network);
      if (oldestFailure) {
        this.resetEndpointState(oldestFailure);
        console.log(`Circuit breaker: Retrying oldest failed endpoint: ${oldestFailure}`);
        return oldestFailure;
      }
      
      // Last resort: clear all blacklists and use first endpoint
      console.warn(`Circuit breaker: All endpoints exhausted for ${network}, clearing blacklists`);
      this.clearBlacklist(network);
      return networkEndpoints[0];
    }

    // Reset circuit breaker if we have available endpoints
    if (circuitBreaker?.isOpen) {
      console.log(`Circuit breaker: Endpoints recovered for ${network}, closing circuit breaker`);
      circuitBreaker.isOpen = false;
      circuitBreaker.consecutiveFailures = 0;
    }

    // Smart endpoint selection: avoid recently used endpoints if possible
    let selectedEndpoint: string;
    
    if (availableEndpoints.length === 1) {
      selectedEndpoint = availableEndpoints[0];
    } else {
      // Try to avoid the last used endpoint if we have alternatives
      const lastUsed = this.lastEndpointUsed[network];
      const alternativeEndpoints = availableEndpoints.filter(ep => ep !== lastUsed);
      
      if (alternativeEndpoints.length > 0) {
        // Use round-robin among alternatives
        const idx = this.currentIndex[network] % alternativeEndpoints.length;
        selectedEndpoint = alternativeEndpoints[idx];
        this.currentIndex[network] = (this.currentIndex[network] + 1) % alternativeEndpoints.length;
      } else {
        // All alternatives exhausted, use round-robin on all available
        const idx = this.currentIndex[network] % availableEndpoints.length;
        selectedEndpoint = availableEndpoints[idx];
        this.currentIndex[network] = (this.currentIndex[network] + 1) % availableEndpoints.length;
      }
    }

    // Update last used tracking
    this.lastEndpointUsed[network] = selectedEndpoint;
    const state = this.endpointStates.get(selectedEndpoint);
    if (state) {
      state.lastUsed = new Date();
      // Clear blacklist status when selecting for retry
      state.isBlacklisted = false;
    }

    return selectedEndpoint;
  }

  public markEndpointFailed(network: string, endpoint: string): void {
    const state = this.endpointStates.get(endpoint);
    if (state) {
      state.failureCount++;
      state.isBlacklisted = true;
      state.lastFailureTime = new Date();
      state.lastUsed = new Date();
      console.warn(`Blacklisted endpoint for session: ${endpoint} (failure count: ${state.failureCount})`);
    }

    // Check if this triggers circuit breaker
    this.checkCircuitBreaker(network);
  }

  private handleAllEndpointsFailed(network: string): void {
    const circuitBreaker = this.circuitBreakers.get(network);
    if (!circuitBreaker) return;

    circuitBreaker.consecutiveFailures++;
    circuitBreaker.lastFailureTime = new Date();
    
    // Calculate exponential backoff delay
    const baseDelay = this.CIRCUIT_BREAKER_BASE_DELAY;
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, circuitBreaker.consecutiveFailures - 1),
      this.CIRCUIT_BREAKER_MAX_DELAY
    );
    
    circuitBreaker.nextRetryTime = new Date(Date.now() + exponentialDelay);
    circuitBreaker.isOpen = true;
    
    console.warn(`Circuit breaker opened for ${network}: retry in ${Math.ceil(exponentialDelay / 1000)}s (attempt ${circuitBreaker.consecutiveFailures})`);
  }

  private checkCircuitBreaker(network: string): void {
    const networkEndpoints = this.endpoints[network] || [];
    const allBlacklisted = networkEndpoints.every(endpoint => {
      const state = this.endpointStates.get(endpoint);
      return state?.isBlacklisted;
    });

    if (allBlacklisted) {
      console.warn(`All endpoints blacklisted for ${network}, considering circuit breaker`);
      this.handleAllEndpointsFailed(network);
    }
  }

  private findOldestFailedEndpoint(network: string): string | null {
    const networkEndpoints = this.endpoints[network] || [];
    let oldestEndpoint: string | null = null;
    let oldestTime = new Date();

    for (const endpoint of networkEndpoints) {
      const state = this.endpointStates.get(endpoint);
      if (state?.isBlacklisted && state.lastFailureTime < oldestTime) {
        oldestTime = state.lastFailureTime;
        oldestEndpoint = endpoint;
      }
    }

    return oldestEndpoint;
  }

  private resetEndpointState(endpoint: string): void {
    const state = this.endpointStates.get(endpoint);
    if (state) {
      state.isBlacklisted = false;
      state.lastUsed = new Date(0);
      // Keep failure count for statistics but allow retry
    }
  }

  public clearBlacklist(network?: string): void {
    if (network) {
      // Clear blacklist for specific network
      const networkEndpoints = this.endpoints[network] || [];
      networkEndpoints.forEach(endpoint => {
        const state = this.endpointStates.get(endpoint);
        if (state) {
          state.isBlacklisted = false;
          state.lastUsed = new Date(0);
        }
      });
      
      // Reset circuit breaker
      const circuitBreaker = this.circuitBreakers.get(network);
      if (circuitBreaker) {
        circuitBreaker.isOpen = false;
        circuitBreaker.consecutiveFailures = 0;
        circuitBreaker.nextRetryTime = new Date(0);
      }
    } else {
      // Clear all blacklisted endpoints
      this.endpointStates.forEach(state => {
        state.isBlacklisted = false;
        state.lastUsed = new Date(0);
      });
      
      // Reset all circuit breakers
      this.circuitBreakers.forEach(circuitBreaker => {
        circuitBreaker.isOpen = false;
        circuitBreaker.consecutiveFailures = 0;
        circuitBreaker.nextRetryTime = new Date(0);
      });
    }
  }

  public getEndpointStatus(network: string): { 
    total: number; 
    available: number; 
    blacklisted: string[];
    endpointDetails: Record<string, { failureCount: number; lastUsed: string; isBlacklisted: boolean }>;
    circuitBreaker: {
      isOpen: boolean;
      consecutiveFailures: number;
      nextRetryTime: string;
    };
  } {
    const networkEndpoints = this.endpoints[network] || [];
    const blacklisted = networkEndpoints.filter(endpoint => {
      const state = this.endpointStates.get(endpoint);
      return state?.isBlacklisted;
    });
    
    const endpointDetails: Record<string, { failureCount: number; lastUsed: string; isBlacklisted: boolean }> = {};
    networkEndpoints.forEach(endpoint => {
      const state = this.endpointStates.get(endpoint);
      endpointDetails[endpoint] = {
        failureCount: state?.failureCount || 0,
        lastUsed: state?.lastUsed.toISOString() || 'never',
        isBlacklisted: state?.isBlacklisted || false
      };
    });
    
    const circuitBreaker = this.circuitBreakers.get(network);
    
    return {
      total: networkEndpoints.length,
      available: networkEndpoints.length - blacklisted.length,
      blacklisted,
      endpointDetails,
      circuitBreaker: {
        isOpen: circuitBreaker?.isOpen || false,
        consecutiveFailures: circuitBreaker?.consecutiveFailures || 0,
        nextRetryTime: circuitBreaker?.nextRetryTime.toISOString() || 'never'
      }
    };
  }
} 