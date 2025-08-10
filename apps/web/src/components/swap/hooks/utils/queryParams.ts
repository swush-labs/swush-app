import { useQueryState, parseAsString, parseAsInteger } from 'nuqs'

/**
 * Centralized query param configuration for the swap page
 * This follows nuqs best practices for organization and type safety
 * 
 * Note: We use asset IDs instead of symbols to handle multiple assets 
 * with the same symbol (e.g., USDC vs USDC Snowbridge)
 */
export const swapQueryParams = {
  // Token selection - using asset IDs for unique identification
  useFromTokenState: () => useQueryState(
    'from',
    parseAsString.withDefault('').withOptions({
      shallow: false, // Trigger server re-render if needed
      history: 'replace' // Don't create history entries for token changes
    })
  ),
  
  useToTokenState: () => useQueryState(
    'to', 
    parseAsString.withDefault('').withOptions({
      shallow: false,
      history: 'replace'
    })
  ),

  // Future swap parameters (can be added as needed)
  useAmountState: () => useQueryState(
    'amount',
    parseAsString.withDefault('').withOptions({
      shallow: false,
      history: 'replace'
    })
  ),

  useSlippageState: () => useQueryState(
    'slippage',
    parseAsInteger.withDefault(10).withOptions({
      shallow: false,
      history: 'replace'
    })
  ),
}

// Export individual hooks for convenience
export const useFromTokenState = swapQueryParams.useFromTokenState
export const useToTokenState = swapQueryParams.useToTokenState
export const useAmountState = swapQueryParams.useAmountState
export const useSlippageState = swapQueryParams.useSlippageState 