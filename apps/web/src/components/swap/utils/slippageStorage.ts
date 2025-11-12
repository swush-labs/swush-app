/**
 * Slippage Tolerance Storage Utilities
 * 
 * Handles persistence of slippage tolerance preference in localStorage.
 * Provides SSR-safe functions for loading and saving slippage values.
 */

// Storage configuration
const SLIPPAGE_STORAGE_KEY = 'swush:slippage-tolerance';
const DEFAULT_SLIPPAGE = 1; // Default 1% slippage
const MIN_SLIPPAGE = 0.01;
const MAX_SLIPPAGE = 50;

/**
 * Load slippage tolerance from localStorage with validation
 * 
 * @returns The stored slippage value (validated) or default if not found/invalid
 */
export const loadSlippageFromStorage = (): number => {
  // SSR-safe: return default if window is undefined
  if (typeof window === 'undefined') {
    return DEFAULT_SLIPPAGE;
  }

  try {
    const stored = localStorage.getItem(SLIPPAGE_STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      
      // Validate: must be a number between MIN and MAX
      if (!isNaN(parsed) && parsed >= MIN_SLIPPAGE && parsed <= MAX_SLIPPAGE) {
        // Round to 2 decimal places to avoid floating-point precision issues
        return Math.round(parsed * 100) / 100;
      }
    }
  } catch (error) {
    console.warn('Failed to load slippage from localStorage:', error);
  }

  return DEFAULT_SLIPPAGE;
};

/**
 * Save slippage tolerance to localStorage
 * 
 * @param value - The slippage percentage to save (0.01 - 50)
 */
export const saveSlippageToStorage = (value: number): void => {
  // SSR-safe: no-op if window is undefined
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Validate before saving
    const clampedValue = Math.max(MIN_SLIPPAGE, Math.min(MAX_SLIPPAGE, value));
    const roundedValue = Math.round(clampedValue * 100) / 100;
    
    localStorage.setItem(SLIPPAGE_STORAGE_KEY, roundedValue.toString());
  } catch (error) {
    console.warn('Failed to save slippage to localStorage:', error);
  }
};

/**
 * Clear slippage tolerance from localStorage
 */
export const clearSlippageFromStorage = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(SLIPPAGE_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear slippage from localStorage:', error);
  }
};

// Export constants for use in other modules if needed
export { DEFAULT_SLIPPAGE, MIN_SLIPPAGE, MAX_SLIPPAGE, SLIPPAGE_STORAGE_KEY };

