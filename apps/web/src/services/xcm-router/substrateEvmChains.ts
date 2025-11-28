/**
 * Substrate EVM Chain Identification Utility
 * 
 * Lists EVM-compatible Substrate parachains in the Polkadot ecosystem.
 * These are Substrate chains with EVM compatibility (Moonbeam, Astar, etc.),
 * NOT pure EVM chains like Ethereum or Arbitrum.
 * 
 * Users connect via Polkadot wallets (Talisman, SubWallet) which provide
 * polkadotSigner for both Substrate and EVM operations.
 */

export const SUBSTRATE_EVM_CHAINS = [
  // Polkadot Parachains
  'Moonbeam',
  'Astar',
  
  // Kusama Parachains
  'Moonriver',
  'Shiden',
] as const;

export type SubstrateEvmChain = typeof SUBSTRATE_EVM_CHAINS[number];

/**
 * Check if a chain is a Substrate-based EVM parachain
 * @param chainName - ParaSpell chain identifier
 * @returns true if chain is a Substrate EVM parachain (Moonbeam, Astar, etc.)
 */
export function isSubstrateEvmChain(chainName: string): boolean {
  return SUBSTRATE_EVM_CHAINS.includes(chainName as SubstrateEvmChain);
}



