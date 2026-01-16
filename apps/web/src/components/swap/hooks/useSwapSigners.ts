import { useMemo } from 'react';
import type { PolkadotSigner } from 'polkadot-api';

interface Account {
  address: string;
  platform: 'polkadot' | 'ethereum' | 'solana';
  polkadotSigner?: PolkadotSigner;
  client?: any;
}

interface SwapSignersResult {
  // Connection state
  isConnected: boolean;
  walletAddress: string;
  
  // Sender signers
  senderPolkadotSigner: PolkadotSigner | undefined;
  evmSigner: any;
  
  // Recipient signers
  recipientPolkadotSigner: PolkadotSigner | undefined;
}

/**
 * Custom hook to extract and manage signers from sender and recipient accounts
 * Simplifies the logic of extracting platform-specific signers
 */
export function useSwapSigners(
  selectedAccount: Account | null,
  recipientAccount: Account | null
): SwapSignersResult {
  
  const isConnected = !!selectedAccount;
  const walletAddress = selectedAccount?.address || '';
  
  // Extract sender signers based on platform
  const senderPolkadotSigner = useMemo(() => {
    if (!selectedAccount) return undefined;
    return 'polkadotSigner' in selectedAccount 
      ? selectedAccount.polkadotSigner 
      : undefined;
  }, [selectedAccount]);
  
  const evmSigner = useMemo(() => {
    if (!selectedAccount) return undefined;
    return 'client' in selectedAccount 
      ? selectedAccount.client 
      : undefined;
  }, [selectedAccount]);
  
  // Extract recipient signer (used for cross-platform swaps: EVM → Substrate)
  const recipientPolkadotSigner = useMemo(() => {
    if (!recipientAccount) return undefined;
    return 'polkadotSigner' in recipientAccount
      ? recipientAccount.polkadotSigner
      : undefined;
  }, [recipientAccount]);
  
  return {
    isConnected,
    walletAddress,
    senderPolkadotSigner,
    evmSigner,
    recipientPolkadotSigner,
  };
}

