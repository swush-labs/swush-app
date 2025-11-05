/**
 * Phase 1 Tests: Asset Key Format Matching
 * 
 * Tests the critical fix from Phase 1 that ensures asset keys match registry format:
 * - Keys must include network suffix: USDC-1337-AssetHubPolkadot
 * - Native tokens use "native" keyword: DOT-native-Polkadot
 */

import { renderHook } from '@testing-library/react-hooks';
import useCurrencyOptions from '../useCurrencyOptions';
import type { TAssetInfo } from '@paraspell/sdk';

// Mock ParaSpell functions
const mockAssetsWithNetwork: Array<TAssetInfo & { _network: string }> = [
  { 
    symbol: 'USDC', 
    assetId: '1337',
    decimals: 6,
    _network: 'AssetHubPolkadot'
  } as any,
  { 
    symbol: 'DOT',
    decimals: 10,
    _network: 'Polkadot'
  } as any, // Native token (no assetId)
];

jest.mock('@paraspell/xcm-router', () => ({
  getSupportedAssetsFrom: jest.fn(() => mockAssetsWithNetwork),
  getSupportedAssetsTo: jest.fn(() => mockAssetsWithNetwork),
}));

describe('useCurrencyOptions - Asset Key Format', () => {
  it('should generate correct key format with network suffix', () => {
    const { result } = renderHook(() =>
      useCurrencyOptions(
        'Polkadot' as any,
        ['HydrationDex'],
        'AssetHubPolkadot' as any,
        ['Polkadot', 'AssetHubPolkadot']
      )
    );

    const keys = Object.keys(result.current.currencyFromMap);
    
    // Should include network in key
    expect(keys.some(k => k.includes('-Polkadot'))).toBe(true);
    expect(keys.some(k => k.includes('-AssetHubPolkadot'))).toBe(true);
  });

  it('should use "native" keyword for native tokens', () => {
    const { result } = renderHook(() =>
      useCurrencyOptions(
        'Polkadot' as any,
        ['HydrationDex'],
        'AssetHubPolkadot' as any,
        ['Polkadot']
      )
    );

    const keys = Object.keys(result.current.currencyFromMap);
    
    // Native token should have "native" in key (DOT has no assetId)
    expect(keys.some(k => k.includes('DOT-native-'))).toBe(true);
  });

  it('should use assetId for asset tokens', () => {
    const { result } = renderHook(() =>
      useCurrencyOptions(
        'Polkadot' as any,
        ['HydrationDex'],
        'AssetHubPolkadot' as any,
        ['AssetHubPolkadot']
      )
    );

    const keys = Object.keys(result.current.currencyFromMap);
    
    // Asset token should have assetId in key
    expect(keys.some(k => k.includes('USDC-1337-'))).toBe(true);
  });

  it('should create both from and to currency maps', () => {
    const { result } = renderHook(() =>
      useCurrencyOptions(
        'Polkadot' as any,
        ['HydrationDex'],
        'AssetHubPolkadot' as any,
        ['Polkadot', 'AssetHubPolkadot']
      )
    );

    expect(result.current.currencyFromMap).toBeDefined();
    expect(result.current.currencyToMap).toBeDefined();
    expect(Object.keys(result.current.currencyFromMap).length).toBeGreaterThan(0);
    expect(Object.keys(result.current.currencyToMap).length).toBeGreaterThan(0);
  });

  it('should create select options with proper labels', () => {
    const { result } = renderHook(() =>
      useCurrencyOptions(
        'Polkadot' as any,
        ['HydrationDex'],
        'AssetHubPolkadot' as any,
        ['Polkadot', 'AssetHubPolkadot']
      )
    );

    expect(result.current.currencyFromOptions).toBeDefined();
    expect(result.current.currencyFromOptions.length).toBeGreaterThan(0);
    
    // Check that options have value and label
    const firstOption = result.current.currencyFromOptions[0];
    expect(firstOption).toHaveProperty('value');
    expect(firstOption).toHaveProperty('label');
  });
});


