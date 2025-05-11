import { describe, it, expect, jest } from '@jest/globals';
import { formatAmount, convertToPlank } from '../utils';

// Mock CacheService and CACHE_KEYS
// jest.mock('services/cache/CacheService', () => ({
//   CacheService: {
//     getInstance: jest.fn().mockReturnValue({
//       get: jest.fn().mockReturnValue(new Map()),
//       set: jest.fn(),
//     }),
//   },
// }));

// jest.mock('services/constants', () => ({
//   CACHE_KEYS: {
//     MERGED_ASSETS: 'MERGED_ASSETS',
//   },
  // }));

describe('formatAmount', () => {
  it('should handle zero amount correctly', () => {
    expect(formatAmount('0', 18)).toEqual({ raw: '0', decimal: '0' });
    expect(formatAmount(BigInt(0), 18)).toEqual({ raw: '0', decimal: '0' });
  });

  it('should format amounts with different decimals correctly', () => {
    // Test with 18 decimals (common for ETH)
    expect(formatAmount('1000000000000000000', 18)).toEqual({
      raw: '1000000000000000000',
      decimal: '1'
    });

    // Test with 12 decimals (common for DOT)
    expect(formatAmount('1000000000000', 12)).toEqual({
      raw: '1000000000000',
      decimal: '1'
    });
  });

  it('should handle rounding option correctly', () => {
    const amount = '1234567890000000000'; // 1.23456789 ETH
    expect(formatAmount(amount, 18, { round: 2 })).toEqual({
      raw: '1234567890000000000',
      decimal: '1.23'
    });
    
    expect(formatAmount(amount, 18, { round: 4 })).toEqual({
      raw: '1234567890000000000',
      decimal: '1.2346'
    });
  });

  it('should handle commify option correctly', () => {
    const amount = '1234567890000000000000'; // 1,234.56789 ETH
    expect(formatAmount(amount, 18, { commify: true })).toEqual({
      raw: '1234567890000000000000',
      decimal: '1,234.56789'
    });
  });

  it('should handle trim option correctly', () => {
    const amount = '1000000000000000000'; // 1.000000000000000000 ETH
    expect(formatAmount(amount, 18, { trim: true })).toEqual({
      raw: '1000000000000000000',
      decimal: '1'
    });
  });

  it('should handle all options combined', () => {
    const amount = '1234567890000000000000'; // 1,234.56789 ETH
    expect(formatAmount(amount, 18, { round: 2, commify: true, trim: true })).toEqual({
      raw: '1234567890000000000000',
      decimal: '1,234.57'
    });
  });

  it('should handle invalid inputs gracefully', () => {
 //   expect(formatAmount('invalid', 18)).toEqual({ raw: '0', decimal: '0' });
    // @ts-expect-error - Testing null input
    expect(formatAmount(null, 18)).toEqual({ raw: '0', decimal: '0' });
  });
});

describe('convertToPlank', () => {
  it('should handle zero and empty inputs correctly', () => {
    expect(convertToPlank('0', 18)).toBe(BigInt(0));
    expect(convertToPlank(0, 18)).toBe(BigInt(0));
    expect(convertToPlank('', 18)).toBe(BigInt(0));
  });

  it('should convert decimal amounts to planks correctly', () => {
    
    // 1 DOT = 1000000000000 Planck
    expect(convertToPlank('1', 12)).toBe(BigInt('1000000000000'));
  });


  it('should handle scientific notation correctly', () => {
    expect(convertToPlank('1e-18', 18)).toBe(BigInt(1));
    expect(convertToPlank('1e-9', 18)).toBe(BigInt('1000000000'));
  });

  it('should handle invalid inputs gracefully', () => {
    expect(convertToPlank('invalid', 18)).toBe(BigInt(0));
    // @ts-expect-error - Testing null input
    expect(convertToPlank(null, 18)).toBe(BigInt(0));
    expect(convertToPlank(NaN, 18)).toBe(BigInt(0));
  });

}); 