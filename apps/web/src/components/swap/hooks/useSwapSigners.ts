import { useMemo } from 'react';
import type { PolkadotSigner } from 'polkadot-api';

/**
 * Solana account interface matching kheopskit's Solana wallet integration
 */
export interface SolanaAccount {
  address: string;
  publicKey: Uint8Array;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signAndSendTransaction: (
    transaction: Uint8Array,
    options?: { minContextSlot?: number }
  ) => Promise<{ signature: Uint8Array }>;
}

interface Account {
  address: string;
  platform: 'polkadot' | 'ethereum' | 'solana';
  polkadotSigner?: PolkadotSigner;
  client?: any;
  // Solana-specific fields
  publicKey?: Uint8Array;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  signAndSendTransaction?: (
    transaction: Uint8Array,
    options?: { minContextSlot?: number }
  ) => Promise<{ signature: Uint8Array }>;
}

interface SwapSignersResult {
  // Connection state
  isConnected: boolean;
  walletAddress: string;
  
  // Sender signers
  senderPolkadotSigner: PolkadotSigner | undefined;
  evmSigner: any;
  solanaSigner: SolanaAccount | undefined;
  
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
  
  // Extract Solana signer (account with signAndSendTransaction method)
  const solanaSigner = useMemo((): SolanaAccount | undefined => {
    if (!selectedAccount) return undefined;
    if (selectedAccount.platform !== 'solana') return undefined;
    if (!selectedAccount.signAndSendTransaction || !selectedAccount.publicKey) return undefined;
    
    return {
      address: selectedAccount.address,
      publicKey: selectedAccount.publicKey,
      signMessage: selectedAccount.signMessage!,
      signAndSendTransaction: selectedAccount.signAndSendTransaction,
    };
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
    solanaSigner,
    recipientPolkadotSigner,
  };
}

