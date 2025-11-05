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

const mockGetOptimalExchanges = jest.fn(() => ['HydrationDex']);
const mockDetermineCurrency = jest.fn((asset) => ({ symbol: asset.symbol }));
const mockGetTAssetFromKey = jest.fn(() => ({ 
  symbol: 'DOT', 
  decimals: 10 
}));

describe('useXcmRoute - Phase 2: Routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: null,
        outputToken: null,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
        skipPriceFetch: true,
      })
    );

    expect(result.current.outputAmount).toBe('');
    expect(result.current.routeDex).toBe('');
    expect(result.current.estimatedFees).toBe('0');
    expect(result.current.isProcessing).toBe(false);
  });

  it('should skip price fetch when skipPriceFetch is true', async () => {
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: mockInputToken,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
        skipPriceFetch: true,
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
    const invalidToken = { ...mockInputToken, assetKey: undefined };
    
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: invalidToken as any,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
        skipPriceFetch: false,
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
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: mockInputToken,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
        skipPriceFetch: true,
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
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: mockInputToken,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
        skipPriceFetch: true,
      })
    );

    expect(result.current.isLoadingQuote).toBe(false);
    expect(result.current.isLoadingFees).toBe(false);
  });

  it('should clear state for invalid amounts', async () => {
    const { result } = renderHook(() =>
      useXcmRoute({
        inputToken: mockInputToken,
        outputToken: mockOutputToken,
        getOptimalExchanges: mockGetOptimalExchanges,
        determineCurrency: mockDetermineCurrency,
        getTAssetFromKey: mockGetTAssetFromKey,
        skipPriceFetch: true,
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


