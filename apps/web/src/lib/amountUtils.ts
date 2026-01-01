/**
 * Amount conversion utilities
 *
 * Shared utilities for converting between human-readable amounts and smallest units
 */

/**
 * Convert user input (decimal string) to smallest unit (bigint)
 *
 * Uses string manipulation to preserve precision for large decimals
 * Example: "1.5" with 12 decimals → 1500000000000n
 *
 * @param amount - Decimal amount as string (e.g., "1.5")
 * @param decimals - Number of decimal places (e.g., 12 for DOT)
 * @returns Amount in smallest unit as bigint
 */
export function toSmallestUnit(amount: string, decimals: number): bigint {
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

/**
 * Convert user input to smallest unit as string (for Chainflip API)
 *
 * @param amount - Decimal amount as string (e.g., "1.5")
 * @param decimals - Token decimals
 * @returns Amount in smallest unit as string
 */
export function toSmallestUnitString(amount: string, decimals: number): string {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;
  // Remove leading zeros but keep at least one digit
  return combined.replace(/^0+/, '') || '0';
}
