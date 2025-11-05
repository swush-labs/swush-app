/**
 * Phase 2 Tests: Fee Calculation & Dry-Run Validation
 * 
 * Tests fee aggregation across multiple currencies and dry-run validation
 */

import {
  calculateTotalFees,
  formatFeeSummary,
  validateDryRunResults,
  getAdjustedFeeAmount,
} from '../feeCalculator';
import type { TRouterXcmFeeResult } from '@paraspell/xcm-router';

const mockFeeResult: TRouterXcmFeeResult = {
  origin: {
    fee: '1000000000',
    currency: 'DOT',
    feeType: 'dryRun',
    asset: { decimals: 10 } as any,
  },
  destination: {
    fee: '500000',
    currency: 'USDC',
    feeType: 'dryRun',
    asset: { decimals: 6 } as any,
  },
  hops: [],
};

describe('feeCalculator - Phase 2: Fee Calculation', () => {
  describe('calculateTotalFees', () => {
    it('should calculate total fees correctly', () => {
      const result = calculateTotalFees(mockFeeResult);

      expect(result.totalFees['DOT']).toBeDefined();
      expect(result.totalFees['USDC']).toBeDefined();
      expect(result.totalFees['DOT'].decimals).toBe(10);
      expect(result.totalFees['USDC'].decimals).toBe(6);
      expect(result.totalFees['DOT'].currency).toBe('DOT');
      expect(result.totalFees['USDC'].currency).toBe('USDC');
    });

    it('should aggregate fees from multiple hops', () => {
      const feeResultWithHops: TRouterXcmFeeResult = {
        ...mockFeeResult,
        hops: [
          {
            chain: 'Hydration',
            result: {
              fee: '2000000000',
              currency: 'DOT',
              feeType: 'dryRun',
              asset: { decimals: 10 } as any,
            },
          },
        ],
      };

      const result = calculateTotalFees(feeResultWithHops);

      // Should aggregate DOT fees from origin + hop
      expect(result.totalFees['DOT']).toBeDefined();
      const dotRawAmount = BigInt(result.totalFees['DOT'].rawAmount);
      expect(dotRawAmount).toBe(BigInt('3000000000')); // 1000000000 + 2000000000
    });

    it('should throw error for missing decimals', () => {
      const invalidFeeResult = {
        ...mockFeeResult,
        origin: { 
          ...mockFeeResult.origin, 
          asset: {} as any // Missing decimals
        },
      };

      expect(() => calculateTotalFees(invalidFeeResult)).toThrow('Missing decimals');
    });

    it('should include breakdown in result', () => {
      const result = calculateTotalFees(mockFeeResult);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.origin).toEqual(mockFeeResult.origin);
      expect(result.breakdown.destination).toEqual(mockFeeResult.destination);
      expect(result.breakdown.hops).toEqual(mockFeeResult.hops);
    });
  });

  describe('formatFeeSummary', () => {
    it('should format fee summary as string', () => {
      const feeSummary = calculateTotalFees(mockFeeResult);
      const formatted = formatFeeSummary(feeSummary);

      expect(formatted).toContain('DOT');
      expect(formatted).toContain('USDC');
      expect(formatted).toContain('+');
    });

    it('should handle single currency', () => {
      const singleCurrencyResult: TRouterXcmFeeResult = {
        origin: {
          fee: '1000000000',
          currency: 'DOT',
          feeType: 'dryRun',
          asset: { decimals: 10 } as any,
        },
        destination: {
          fee: '2000000000',
          currency: 'DOT',
          feeType: 'dryRun',
          asset: { decimals: 10 } as any,
        },
        hops: [],
      };

      const feeSummary = calculateTotalFees(singleCurrencyResult);
      const formatted = formatFeeSummary(feeSummary);

      expect(formatted).toContain('DOT');
      expect(formatted).not.toContain('+'); // Only one currency
    });
  });

  describe('validateDryRunResults', () => {
    it('should validate successful dry-run results', () => {
      const validation = validateDryRunResults(mockFeeResult);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect failed origin dry-run', () => {
      const failedFeeResult = {
        ...mockFeeResult,
        origin: { ...mockFeeResult.origin, feeType: 'calculated' as const },
      };

      const validation = validateDryRunResults(failedFeeResult);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Origin');
    });

    it('should detect failed destination dry-run', () => {
      const failedFeeResult = {
        ...mockFeeResult,
        destination: { ...mockFeeResult.destination, feeType: undefined as any },
      };

      const validation = validateDryRunResults(failedFeeResult);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Destination'))).toBe(true);
    });

    it('should detect failed hop dry-runs', () => {
      const failedFeeResult: TRouterXcmFeeResult = {
        ...mockFeeResult,
        hops: [
          {
            chain: 'Hydration',
            result: {
              fee: '1000000',
              currency: 'HDX',
              feeType: 'calculated' as const,
              asset: { decimals: 12 } as any,
            },
          },
        ],
      };

      const validation = validateDryRunResults(failedFeeResult);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Hop'))).toBe(true);
      expect(validation.errors.some(e => e.includes('Hydration'))).toBe(true);
    });
  });

  describe('getAdjustedFeeAmount', () => {
    it('should convert fee to adjusted amount', () => {
      const adjusted = getAdjustedFeeAmount('1000000000', 10);
      expect(adjusted).toBeTruthy();
      expect(typeof adjusted).toBe('string');
    });

    it('should handle undefined fee', () => {
      const adjusted = getAdjustedFeeAmount(undefined, 10);
      expect(adjusted).toBe('0');
    });

    it('should handle bigint fee', () => {
      const adjusted = getAdjustedFeeAmount(BigInt('1000000000'), 10);
      expect(adjusted).toBeTruthy();
    });
  });
});


