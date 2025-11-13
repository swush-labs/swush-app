/**
 * Phase 2 Tests: Route Calculation & Fee Estimation
 * 
 * Tests routing logic, state management, and validation
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useXcmRoute } from '../useXcmRoute';
import type { TokenInfo } from '@/components/swap/types';

const mockInputToken: TokenInfo = {
  id: 'DOT-native-Polkadot',
  symbol: 'DOT',
  name: 'Polkadot',
  icon: 'D',
  decimals: 10,
  assetKey: 'DOT-native-Polkadot',
  networkChain: 'Polkadot',
};

const mockOutputToken: TokenInfo = {
  id: 'USDC-1337-AssetHubPolkadot',
  symbol: 'USDC',
  name: 'USD Coin',
  icon: 'U',
  decimals: 6,
  assetKey: 'USDC-1337-AssetHubPolkadot',
  networkChain: 'AssetHubPolkadot',
};

const mockGetOptimalExchanges = jest.fn((_fromKey: string, _toKey: string, _fromChain: string, _toChain: string) => ['HydrationDex' as const]);
const mockDetermineCurrency = jest.fn((asset: any) => ({ symbol: asset.symbol }));
const mockGetTAssetFromKey = jest.fn((_key: string, _direction: 'from' | 'to') => ({ 
  symbol: 'DOT', 
  decimals: 10 
} as any));

describe('useXcmRoute - Phase 2: Routing', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset env variable before each test
    delete process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH;
  });

  afterEach(() => {
    // Restore original env variable
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH;
    }
  });

  it('should initialize with empty state', () => {
    process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH = 'true';
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: null,
        outputToken: null,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
      })
    );

    expect(result.current.outputAmount).toBe('');
    expect(result.current.routeDex).toBe('');
    expect(result.current.estimatedFees).toBe('0');
    expect(result.current.isProcessing).toBe(false);
  });

  it('should skip price fetch when skipPriceFetch is true', async () => {
    process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH = 'true';
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: mockInputToken,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
      })
    );

    await act(async () => {
      result.current.debouncedFetchRoute('10');
      // Debounce is mocked to execute immediately
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.outputAmount).toBe('10'); // Mock returns input
    expect(result.current.routeDex).toContain('mock');
  });

  it('should validate token configuration', async () => {
    process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH = 'false';
    const invalidToken = { ...mockInputToken, assetKey: undefined };
    
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: invalidToken as any,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
      })
    );

    await act(async () => {
      result.current.debouncedFetchRoute('10');
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.routeState.error).toBeTruthy();
    expect(result.current.routeState.error).toContain('configuration error');
  });

  it('should reset route state correctly', () => {
    process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH = 'true';
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: mockInputToken,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
      })
    );

    act(() => {
      result.current.resetRoute();
    });

    expect(result.current.outputAmount).toBe('');
    expect(result.current.routeDex).toBe('');
    expect(result.current.estimatedFees).toBe('0');
    expect(result.current.routeState.data).toBeNull();
  });

  it('should handle separate loading states for quote and fees', () => {
    process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH = 'true';
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: mockInputToken,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
      })
    );

    expect(result.current.isLoadingQuote).toBe(false);
    expect(result.current.isLoadingFees).toBe(false);
  });

  it('should clear state for invalid amounts', async () => {
    process.env.NEXT_PUBLIC_SKIP_PRICE_FETCH = 'true';
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: mockInputToken,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
      })
    );

    await act(async () => {
      result.current.debouncedFetchRoute('0'); // Invalid amount
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.outputAmount).toBe('');
    expect(result.current.routeDex).toBe('');
  });
});


