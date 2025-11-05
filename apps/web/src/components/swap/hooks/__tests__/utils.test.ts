/**
 * Utility Tests: BigInt Conversion
 * 
 * Tests precision handling for decimal to BigInt conversion
 */

/**
 * Extract toSmallestUnit function for testing
 * This is the same implementation used in useXcmRoute and useXcmSwapExecution
 */
function toSmallestUnit(amount: string, decimals: number): bigint {
  const parsed = parseFloat(amount);

  if (parsed > Number.MAX_SAFE_INTEGER) {
    throw new Error('Amount too large');
  }

  if (isNaN(parsed) || parsed <= 0) return BigInt(0);

  // Handle decimal places with string manipulation to avoid precision loss
  const [whole = '0', fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;

  return BigInt(combined);
}

describe('BigInt Conversion Utilities', () => {
  describe('toSmallestUnit', () => {
    it('should convert decimal string to smallest unit', () => {
      const result = toSmallestUnit('1.5', 10);
      expect(result).toBe(BigInt('15000000000'));
    });

    it('should handle whole numbers', () => {
      const result = toSmallestUnit('10', 10);
      expect(result).toBe(BigInt('100000000000'));
    });

    it('should handle very small decimals', () => {
      const result = toSmallestUnit('0.000001', 6);
      expect(result).toBe(BigInt('1'));
    });

    it('should handle maximum precision', () => {
      const result = toSmallestUnit('1.123456789012', 12);
      expect(result).toBe(BigInt('1123456789012'));
    });

    it('should truncate excess decimal places', () => {
      const result = toSmallestUnit('1.123456789', 6);
      // Should only use first 6 decimals: 1.123456
      expect(result).toBe(BigInt('1123456'));
    });

    it('should return 0 for zero amount', () => {
      expect(toSmallestUnit('0', 10)).toBe(BigInt(0));
    });

    it('should return 0 for negative amounts', () => {
      expect(toSmallestUnit('-1', 10)).toBe(BigInt(0));
      expect(toSmallestUnit('-0.5', 10)).toBe(BigInt(0));
    });

    it('should return 0 for invalid amounts', () => {
      expect(toSmallestUnit('invalid', 10)).toBe(BigInt(0));
      expect(toSmallestUnit('', 10)).toBe(BigInt(0));
      expect(toSmallestUnit('abc', 10)).toBe(BigInt(0));
    });

    it('should throw for amounts exceeding MAX_SAFE_INTEGER', () => {
      const hugeAmount = '9999999999999999999999';
      expect(() => toSmallestUnit(hugeAmount, 10)).toThrow('Amount too large');
    });

    it('should handle DOT with 10 decimals', () => {
      const result = toSmallestUnit('100.5', 10);
      expect(result).toBe(BigInt('1005000000000'));
    });

    it('should handle USDC with 6 decimals', () => {
      const result = toSmallestUnit('100.5', 6);
      expect(result).toBe(BigInt('100500000'));
    });

    it('should preserve precision for complex decimals', () => {
      const result = toSmallestUnit('0.123456', 6);
      expect(result).toBe(BigInt('123456'));
    });

    it('should handle amounts with no decimal point', () => {
      const result = toSmallestUnit('42', 10);
      expect(result).toBe(BigInt('420000000000'));
    });

    it('should handle amounts with trailing zeros', () => {
      const result = toSmallestUnit('1.500000', 6);
      expect(result).toBe(BigInt('1500000'));
    });

    it('should handle very large valid amounts', () => {
      const result = toSmallestUnit('1000000', 6);
      expect(result).toBe(BigInt('1000000000000'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero decimals', () => {
      const result = toSmallestUnit('42', 0);
      expect(result).toBe(BigInt('42'));
    });

    it('should handle single decimal place', () => {
      const result = toSmallestUnit('1.5', 1);
      expect(result).toBe(BigInt('15'));
    });

    it('should handle amounts close to MAX_SAFE_INTEGER', () => {
      // Just below MAX_SAFE_INTEGER
      const result = toSmallestUnit('9007199254740991', 0);
      expect(result).toBe(BigInt('9007199254740991'));
    });
  });
});


