/**
 * EVM Chain Identification Utility
 * 
 * Lists EVM-compatible parachains in the Polkadot ecosystem
 * that require EVM signers for RouterBuilder
 */

export const EVM_CHAINS = [
  // Polkadot Parachains
  'Moonbeam',
  'Astar',
  
  // Kusama Parachains
  'Moonriver',
  'Shiden',
] as const;

export type EvmChain = typeof EVM_CHAINS[number];

/**
 * Check if a chain is EVM-based and requires EVM signer
 * @param chainName - ParaSpell chain identifier
 * @returns true if chain is EVM-based
 */
export function isEvmChain(chainName: string): boolean {
  return EVM_CHAINS.includes(chainName as EvmChain);
}

