import type { Asset } from '@swush/api';
import { NETWORKS_SUPPORTED } from '@/services/constants';

const API_HOST = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
const API_VERSION = 'v1';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const USE_HTTPS = process.env.NEXT_PUBLIC_USE_HTTPS === 'true';

// Determine API base URL based on environment
const getApiConfig = () => {
  if (IS_DEVELOPMENT) {
    // Development: always use HTTP with explicit port
    const port = process.env.NEXT_PUBLIC_API_PORT || '3001';
    return {
      baseUrl: `http://${API_HOST}:${port}/api/${API_VERSION}`,
      protocol: 'http',
      port,
      host: API_HOST
    };
  } else {
    // Production: use HTTPS by default (nginx handles SSL termination)
    const protocol = process.env.NEXT_PUBLIC_USE_HTTPS !== 'false' ? 'https' : 'http';
    return {
      baseUrl: `${protocol}://${API_HOST}/api/${API_VERSION}`,
      protocol,
      port: protocol === 'https' ? '443' : '80',
      host: API_HOST
    };
  }
};

const { baseUrl: API_BASE_URL, protocol, port } = getApiConfig();

// Log configuration in development
if (IS_DEVELOPMENT) {
  console.log('🔧 API Configuration:', {
    host: API_HOST,
    protocol,
    port,
    baseUrl: API_BASE_URL,
    environment: 'development'
  });
}

interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  errors?: Array<{
    message: string;
  }>;
}

export interface AssetWithId extends Asset {
  id: string;
}

// New types for route finding and balances
export interface RouteQuote {
  path: string[];
  expectedOutput: {
    raw: string;
    decimal: string;
  };
  hops: {
    from: string;
    to: string;
    amountIn: string;
    amountOut: string;
  }[];
  dex: typeof NETWORKS_SUPPORTED.ASSET_HUB | typeof NETWORKS_SUPPORTED.HYDRA_DX;
}

export interface Balance {
  balance: number;
  status: string;
  reason: string;
  extra: any;
}

export interface BatchBalanceResponse {
  status: 'success' | 'error';
  request: { 
    address: string; 
    assetId: string; 
  };
  data?: Balance;
  error?: string;
}

// Enhanced fetch function with better error handling and retry logic
async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result: ApiResponse<T> = await response.json();
    
    if (result.status === 'error' || !result.data) {
      throw new Error(result.message || 'API returned error status');
    }

    return result.data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      // Handle network/connection errors
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - API server may be unavailable');
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(`Unable to connect to API server at ${API_BASE_URL}`);
      }
    }
    
    throw error;
  }
}

export const api = {
  // Get API configuration (useful for debugging)
  getConfig: () => getApiConfig(),

  assets: {
    getAll: async (forceRefresh = false): Promise<AssetWithId[]> => {
      const url = `${API_BASE_URL}/assets${forceRefresh ? '?forceRefresh=true' : ''}`;
      return apiRequest<AssetWithId[]>(url);
    },

    findRoute: async (params: {
      fromAsset: string;
      toAsset: string;
      amountIn: string;
    }): Promise<RouteQuote> => {
      const url = `${API_BASE_URL}/assets/find-route`;
      return apiRequest<RouteQuote>(url, {
        method: 'POST',
        body: JSON.stringify(params),
      });
    }
  },

  // Health check endpoint
  health: async (): Promise<{ 
    status: string; 
    timestamp: string; 
    protocol: string; 
    secure: boolean;
    forwarded?: string;
    host?: string;
  }> => {
    const url = `${API_BASE_URL.replace('/api/v1', '')}/health`;
    return apiRequest(url);
  },

  // Balance methods now import from the local BalanceService
  // They're kept here for API compatibility
  balances: {
    get: async (address: string, assetId: string): Promise<Balance> => {
      // Importing here to avoid circular dependencies
      const { BalanceService } = await import('../services/balances/BalanceService');
      const balanceService = BalanceService.getInstance();
      
      try {
        return await balanceService.getBalance({ address, assetId });
      } catch (error) {
        console.error('Error fetching balance:', error);
        throw error;
      }
    },

    batch: async (params: {
      requests: Array<{ address: string; assetId: string; }>;
    }): Promise<BatchBalanceResponse[]> => {
      // Importing here to avoid circular dependencies
      const { BalanceService } = await import('../services/balances/BalanceService');
      const balanceService = BalanceService.getInstance();

      try {
        const results = await balanceService.getBalances(params.requests);
        
        // Convert to the expected format
        return params.requests.map(req => {
          const key = `${req.address}-${req.assetId}`;
          const balanceData = results[key];
          
          if (!balanceData) {
            return {
              status: 'error',
              request: req,
              error: 'Failed to fetch balance'
            };
          }
          
          return {
            status: 'success',
            request: req,
            data: balanceData
          };
        });
      } catch (error) {
        console.error('Error fetching balances:', error);
        throw error;
      }
    }
  }
}; 