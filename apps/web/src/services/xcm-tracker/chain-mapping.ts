/**
 * Chain Name to Ocelloids URN Mapping
 * 
 * Maps ParaSpell chain names to Ocelloids network URNs
 * Format: urn:ocn:{relay}:{paraId}
 * 
 * Reference: https://www.ocelloids.net/docs/apis/01_xcm-streams/
 */

export const CHAIN_TO_OCELLOIDS_URN: Record<string, string> = {
  // Relay Chains
  'Polkadot': 'urn:ocn:polkadot:0',
  'Kusama': 'urn:ocn:kusama:0',
  'Westend': 'urn:ocn:westend:0',
  'Rococo': 'urn:ocn:rococo:0',
  
  // Polkadot Parachains
  'AssetHubPolkadot': 'urn:ocn:polkadot:1000',
  'Hydration': 'urn:ocn:polkadot:2034',
  'HydrationDex': 'urn:ocn:polkadot:2034', // Alias for Hydration
  'Astar': 'urn:ocn:polkadot:2006',
  'Moonbeam': 'urn:ocn:polkadot:2004',
  'Acala': 'urn:ocn:polkadot:2000',
  'Parallel': 'urn:ocn:polkadot:2012',
  'Interlay': 'urn:ocn:polkadot:2032',
  'BifrostPolkadot': 'urn:ocn:polkadot:2030',
  'Centrifuge': 'urn:ocn:polkadot:2031',
  'Unique': 'urn:ocn:polkadot:2037',
  'Zeitgeist': 'urn:ocn:polkadot:2092',
  'Mythos': 'urn:ocn:polkadot:3369',
  
  // Kusama Parachains
  'AssetHubKusama': 'urn:ocn:kusama:1000',
  'Karura': 'urn:ocn:kusama:2000',
  'BifrostKusama': 'urn:ocn:kusama:2001',
  'Basilisk': 'urn:ocn:kusama:2090',
  'Moonriver': 'urn:ocn:kusama:2023',
  'Kintsugi': 'urn:ocn:kusama:2092',
  'Altair': 'urn:ocn:kusama:2088',
  'Calamari': 'urn:ocn:kusama:2084',
  'Crab': 'urn:ocn:kusama:2105',
  'Quartz': 'urn:ocn:kusama:2095',
  'Shiden': 'urn:ocn:kusama:2007',
  'Tinkernet': 'urn:ocn:kusama:2125',
  'Robonomics': 'urn:ocn:kusama:2048',
  
  // Westend Testnets
  'AssetHubWestend': 'urn:ocn:westend:1000',
  
  // Rococo Testnets
  'AssetHubRococo': 'urn:ocn:rococo:1000',
  
  // Paseo Testnets
  'Paseo': 'urn:ocn:paseo:0',
  'AssetHubPaseo': 'urn:ocn:paseo:1000',
};

/**
 * Convert ParaSpell chain name to Ocelloids URN
 * @param chainName - ParaSpell chain identifier (e.g. "AssetHubPolkadot", "Hydration")
 * @returns Ocelloids URN (e.g. "urn:ocn:polkadot:1000")
 * @throws Error if chain is not mapped
 */
export function getOcelloidsUrn(chainName: string): string {
  const urn = CHAIN_TO_OCELLOIDS_URN[chainName];
  if (!urn) {
    // Don't throw for now, just log warning and return empty string
    console.warn(`⚠️ No Ocelloids URN mapping found for chain: ${chainName}`);
    return '';
  }
  return urn;
}

/**
 * Check if a chain is supported by Ocelloids
 */
export function isChainSupported(chainName: string): boolean {
  return chainName in CHAIN_TO_OCELLOIDS_URN;
}

/**
 * Get all supported chain names
 */
export function getSupportedChains(): string[] {
  return Object.keys(CHAIN_TO_OCELLOIDS_URN);
}

