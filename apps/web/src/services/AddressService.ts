import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';

// SS58 Prefixes for different chains
export const SS58_PREFIXES = {
  POLKADOT: 0,
  ASSET_HUB_POLKADOT: 0,
  HYDRADX: 63,
  KUSAMA: 2,
  ASSET_HUB_KUSAMA: 2,
} as const;

export interface ChainAddress {
  chain: string;
  address: string;
  prefix: number;
}

export class AddressService {
  private static instance: AddressService;
  
  public static getInstance(): AddressService {
    if (!AddressService.instance) {
      AddressService.instance = new AddressService();
    }
    return AddressService.instance;
  }

  /**
   * Convert address from one chain format to another
   */
  public convertAddress(
    address: string, 
    targetChain: keyof typeof SS58_PREFIXES
  ): string {
    try {
      // Decode the address to get the public key
      const publicKey = decodeAddress(address);
      
      // Encode with the target chain's prefix
      const targetPrefix = SS58_PREFIXES[targetChain];
      return encodeAddress(publicKey, targetPrefix);
    } catch (error) {
      console.error(`Error converting address to ${targetChain}:`, error);
      return address; // Return original address on error
    }
  }

  /**
   * Get all chain-specific addresses from a single address
   */
  public getAllChainAddresses(address: string): ChainAddress[] {
    try {
      const publicKey = decodeAddress(address);
      
      return Object.entries(SS58_PREFIXES).map(([chain, prefix]) => ({
        chain,
        address: encodeAddress(publicKey, prefix),
        prefix
      }));
    } catch (error) {
      console.error('Error generating chain addresses:', error);
      return [];
    }
  }

  /**
   * Get specific chain addresses needed for XCM operations
   */
  public getXcmAddresses(walletAddress: string): {
    assetHub: string;
    hydraDx: string;
    original: string;
  } {
    return {
      assetHub: this.convertAddress(walletAddress, 'ASSET_HUB_POLKADOT'),
      hydraDx: this.convertAddress(walletAddress, 'HYDRADX'),
      original: walletAddress
    };
  }

  /**
   * Determine if an address is from a specific chain based on prefix
   */
  public getChainFromAddress(address: string): string | null {
    try {
      // Common prefix patterns
      if (address.startsWith('1')) return 'POLKADOT';
      if (address.startsWith('7')) return 'HYDRADX';
      if (address.startsWith('C') || address.startsWith('D') || 
          address.startsWith('F') || address.startsWith('G')) return 'KUSAMA';
      
      return null;
    } catch (error) {
      console.error('Error determining chain from address:', error);
      return null;
    }
  }

  /**
   * Validate if an address is valid
   */
  public isValidAddress(address: string): boolean {
    try {
      decodeAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the public key from any SS58 address
   */
  public getPublicKey(address: string): Uint8Array | null {
    try {
      return decodeAddress(address);
    } catch {
      return null;
    }
  }
} 