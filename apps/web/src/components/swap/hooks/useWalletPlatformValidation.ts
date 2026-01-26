import { useEffect } from 'react';
import { getNetworkPlatform } from '@/services/xcm-router/assetRegistry';

interface Account {
  platform: 'polkadot' | 'ethereum' | 'solana';
  address: string;
  [key: string]: any;
}

/**
 * Hook to automatically clear wallets when switching to networks that require different platforms
 * 
 * Examples:
 * - Polkadot wallet + switch to ETH(Sepolia) → Wallet cleared
 * - MetaMask + switch to DOT(AssetHub) → Wallet cleared
 * - Polkadot wallet + switch from DOT to USDC on AssetHub → Wallet stays (same platform)
 */
export function useWalletPlatformValidation(
  sourceAccount: Account | null,
  sourceNetwork: string | undefined,
  destinationAccount: Account | null,
  destinationNetwork: string | undefined,
  clearSourceWallet: () => void,
  clearDestinationWallet: () => void
) {
  // Clear source wallet when switching to incompatible network
  useEffect(() => {
    if (!sourceAccount || !sourceNetwork) return;
    
    const requiredPlatform = getNetworkPlatform(sourceNetwork);
    const currentPlatform = sourceAccount.platform;
    
    if (requiredPlatform !== currentPlatform) {
      console.log(`Source platform mismatch: ${sourceNetwork} requires ${requiredPlatform}, but wallet is ${currentPlatform}. Clearing wallet.`);
      clearSourceWallet();
    }
  }, [sourceNetwork, sourceAccount, clearSourceWallet]);

  // Clear destination wallet when switching to incompatible network
  useEffect(() => {
    if (!destinationAccount || !destinationNetwork) return;
    // Skip custom addresses - they don't have a platform
    if (destinationAccount.platform as string === 'custom') return;
    
    const requiredPlatform = getNetworkPlatform(destinationNetwork);
    const currentPlatform = destinationAccount.platform;
    
    if (requiredPlatform !== currentPlatform) {
      console.log(`Destination platform mismatch: ${destinationNetwork} requires ${requiredPlatform}, but wallet is ${currentPlatform}. Clearing recipient.`);
      clearDestinationWallet();
    }
  }, [destinationNetwork, destinationAccount, clearDestinationWallet]);
}
