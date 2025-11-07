/**
 * Phase 1 Tests: Token Selection & Asset Key Format
 * 
 * Tests the critical fix for asset key format matching:
 * - Native tokens: DOT-native-Polkadot
 * - Asset tokens: USDC-1337-AssetHubPolkadot
 */

import { renderHook } from '@testing-library/react-hooks';
import { useXcmTokens } from '../useXcmTokens';
import type { UnifiedAsset } from '@/services/xcm-router/useAssetAggregator';

// Mock the asset aggregator
const mockFromAssets: UnifiedAsset[] = [
  {
    symbol: 'DOT',
    name: 'Polkadot',
    category: 'native',
    isValid: true,
    totalNetworks: 1,
    validNetworks: 1,
    supportedNetworks: [
      {
        network: 'Polkadot',
        assetKey: 'DOT-native-Polkadot',
        displayName: 'DOT (Polkadot)',
        assetType: 'Native',
        verified: true,
        actualAsset: { 
          symbol: 'DOT',
          decimals: 10 
        } as any,
      },
    ],
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    category: 'stablecoin',
    isValid: true,
    totalNetworks: 1,
    validNetworks: 1,
    supportedNetworks: [
      {
        network: 'AssetHubPolkadot',
        assetKey: 'USDC-1337-AssetHubPolkadot',
        displayName: 'USDC (AssetHub)',
        assetType: 'Asset ID',
        verified: true,
        actualAsset: { 
          symbol: 'USDC',
          assetId: '1337',
          decimals: 6 
        } as any,
      },
    ],
  },
];

const mockToAssets: UnifiedAsset[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    category: 'stablecoin',
    isValid: true,
    totalNetworks: 1,
    validNetworks: 1,
    supportedNetworks: [
      {
        network: 'AssetHubPolkadot',
        assetKey: 'USDC-1337-AssetHubPolkadot',
        displayName: 'USDC (AssetHub)',
        assetType: 'Asset ID',
        verified: true,
        actualAsset: { 
          symbol: 'USDC',
          assetId: '1337',
          decimals: 6 
        } as any,
      },
    ],
  },
];

// Mock dependencies
jest.mock('@/services/xcm-router/useAssetAggregator', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    unifiedFromAssets: mockFromAssets,
    unifiedToAssets: mockToAssets,
    getTAssetFromKey: jest.fn(),
    getAssetKeyForNetwork: jest.fn(),
    getOptimalExchanges: jest.fn(() => ['HydrationDex']),
    currencyFromMap: {},
    currencyToMap: {},
  })),
  determineCurrency: jest.fn(),
}));

jest.mock('../utils/queryParams', () => ({
  useFromTokenState: () => ['DOT', jest.fn()],
  useToTokenState: () => ['USDC', jest.fn()],
  useFromNetworkState: () => ['Polkadot', jest.fn()],
  useToNetworkState: () => ['AssetHubPolkadot', jest.fn()],
}));

describe('useXcmTokens - Phase 1: Token Selection', () => {
  it('should generate correct asset key format for native tokens', () => {
    const { result } = renderHook(() => useXcmTokens());
    
    const dotToken = result.current.fromTokens.find(t => t.symbol === 'DOT');
    expect(dotToken?.assetKey).toBe('DOT-native-Polkadot');
    expect(dotToken?.networkChain).toBe('Polkadot');
  });

  it('should generate correct asset key format for asset tokens', () => {
    const { result } = renderHook(() => useXcmTokens());
    
    const usdcToken = result.current.toTokens.find(t => t.symbol === 'USDC');
    expect(usdcToken?.assetKey).toBe('USDC-1337-AssetHubPolkadot');
    expect(usdcToken?.networkChain).toBe('AssetHubPolkadot');
  });

  it('should provide separate from/to token lists', () => {
    const { result } = renderHook(() => useXcmTokens());
    
    expect(result.current.fromTokens).toBeDefined();
    expect(result.current.toTokens).toBeDefined();
    expect(result.current.fromTokens.length).toBe(2); // DOT and USDC
    expect(result.current.toTokens.length).toBe(1); // Only USDC
  });

  it('should convert UnifiedAsset to TokenInfo with all required fields', () => {
    const { result } = renderHook(() => useXcmTokens());
    
    const token = result.current.fromTokens[0];
    expect(token).toHaveProperty('id');
    expect(token).toHaveProperty('symbol');
    expect(token).toHaveProperty('name');
    expect(token).toHaveProperty('assetKey');
    expect(token).toHaveProperty('networkChain');
    expect(token).toHaveProperty('decimals');
    expect(typeof token.decimals).toBe('number');
  });

  it('should track initial loading state correctly', () => {
    const { result } = renderHook(() => useXcmTokens());
    
    // With mocked data, should not be loading
    expect(result.current.isInitialLoad).toBe(false);
    expect(result.current.fromTokens.length).toBeGreaterThan(0);
    expect(result.current.toTokens.length).toBeGreaterThan(0);
  });
});


