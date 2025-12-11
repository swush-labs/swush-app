/**
 * Chainflip Signer Utilities
 * 
 * Helper functions to build and send transactions for Chainflip deposits.
 * These utilities abstract the chain-specific transaction building and signing.
 */

import { toSmallestUnit } from './client';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * EVM wallet client interface (from kheopskit/viem)
 */
interface EvmWalletClient {
  sendTransaction: (params: {
    to: `0x${string}`;
    value?: bigint;
    data?: `0x${string}`;
  }) => Promise<`0x${string}`>;
  account?: {
    address: `0x${string}`;
  };
}

/**
 * Solana account interface (from kheopskit when available)
 */
interface SolanaAccount {
  address: string;
  publicKey: Uint8Array;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signAndSendTransaction?: (transaction: unknown) => Promise<string>;
}

/**
 * Result of a deposit transaction
 */
export interface DepositResult {
  txHash: string;
  success: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVM Deposit Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send native ETH/ARB deposit to Chainflip deposit address
 * 
 * @param client - EVM wallet client from kheopskit
 * @param depositAddress - Chainflip deposit address
 * @param amount - Amount in human-readable format (e.g., "1.5")
 * @param decimals - Token decimals (18 for ETH)
 * @returns Transaction hash
 */
export async function sendEvmNativeDeposit(
  client: EvmWalletClient,
  depositAddress: string,
  amount: string,
  decimals: number = 18
): Promise<DepositResult> {
  try {
    // Convert amount to wei
    const amountWei = BigInt(toSmallestUnit(amount, decimals));

    console.log('💸 Sending EVM native deposit:', {
      to: depositAddress,
      amount: amount,
      amountWei: amountWei.toString(),
    });

    // Send transaction
    const txHash = await client.sendTransaction({
      to: depositAddress as `0x${string}`,
      value: amountWei,
    });

    console.log('✅ EVM native deposit sent:', txHash);

    return {
      txHash,
      success: true,
    };
  } catch (error) {
    console.error('❌ EVM native deposit failed:', error);
    return {
      txHash: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send ERC20 token deposit to Chainflip deposit address
 * 
 * @param client - EVM wallet client from kheopskit
 * @param depositAddress - Chainflip deposit address
 * @param tokenAddress - ERC20 token contract address
 * @param amount - Amount in human-readable format (e.g., "100")
 * @param decimals - Token decimals (6 for USDC/USDT)
 * @returns Transaction hash
 */
export async function sendEvmTokenDeposit(
  client: EvmWalletClient,
  depositAddress: string,
  tokenAddress: string,
  amount: string,
  decimals: number
): Promise<DepositResult> {
  try {
    // Convert amount to smallest unit
    const amountSmallest = BigInt(toSmallestUnit(amount, decimals));

    // ERC20 transfer function signature: transfer(address,uint256)
    // Function selector: 0xa9059cbb
    const transferSelector = '0xa9059cbb';
    
    // Encode parameters (address and uint256)
    const paddedAddress = depositAddress.slice(2).padStart(64, '0');
    const paddedAmount = amountSmallest.toString(16).padStart(64, '0');
    
    const data = `${transferSelector}${paddedAddress}${paddedAmount}` as `0x${string}`;

    console.log('💸 Sending EVM token deposit:', {
      token: tokenAddress,
      to: depositAddress,
      amount: amount,
      amountSmallest: amountSmallest.toString(),
    });

    // Send transaction
    const txHash = await client.sendTransaction({
      to: tokenAddress as `0x${string}`,
      data,
    });

    console.log('✅ EVM token deposit sent:', txHash);

    return {
      txHash,
      success: true,
    };
  } catch (error) {
    console.error('❌ EVM token deposit failed:', error);
    return {
      txHash: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Solana Deposit Functions (Placeholder - requires @solana/kit)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send native SOL deposit to Chainflip deposit address
 * 
 * Note: This is a placeholder. Full implementation requires @solana/kit
 * and will be completed when kheopskit adds Solana support.
 * 
 * @param account - Solana account from kheopskit
 * @param depositAddress - Chainflip deposit address
 * @param amount - Amount in human-readable format (e.g., "1.5")
 * @returns Transaction hash
 */
export async function sendSolanaDeposit(
  account: SolanaAccount,
  depositAddress: string,
  amount: string
): Promise<DepositResult> {
  // TODO: Implement when @solana/kit is added
  // This will require:
  // 1. Creating a SystemProgram.transfer instruction
  // 2. Building a transaction with recent blockhash
  // 3. Signing with account.signAndSendTransaction or manual flow
  
  console.warn('⚠️ Solana deposits not yet implemented');
  
  return {
    txHash: '',
    success: false,
    error: 'Solana deposits not yet implemented. Please use a Solana wallet directly.',
  };
}

/**
 * Send SPL token deposit to Chainflip deposit address
 * 
 * Note: This is a placeholder. Full implementation requires @solana/kit
 * 
 * @param account - Solana account from kheopskit
 * @param depositAddress - Chainflip deposit address
 * @param tokenMint - SPL token mint address
 * @param amount - Amount in human-readable format
 * @param decimals - Token decimals
 * @returns Transaction hash
 */
export async function sendSolanaTokenDeposit(
  account: SolanaAccount,
  depositAddress: string,
  tokenMint: string,
  amount: string,
  decimals: number
): Promise<DepositResult> {
  // TODO: Implement when @solana/kit is added
  // This will require:
  // 1. Getting/creating associated token accounts
  // 2. Creating a Token.transfer instruction
  // 3. Building and signing the transaction
  
  console.warn('⚠️ Solana token deposits not yet implemented');
  
  return {
    txHash: '',
    success: false,
    error: 'Solana token deposits not yet implemented. Please use a Solana wallet directly.',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine the appropriate deposit function based on chain and asset
 * 
 * @param chain - Chainflip chain name
 * @param asset - Chainflip asset name
 * @param isNative - Whether the asset is the chain's native token
 */
export function getDepositType(
  chain: string,
  asset: string
): 'evm-native' | 'evm-token' | 'solana-native' | 'solana-token' | 'unsupported' {
  switch (chain) {
    case 'Ethereum':
    case 'Arbitrum':
      return asset === 'ETH' ? 'evm-native' : 'evm-token';
    case 'Solana':
      return asset === 'SOL' ? 'solana-native' : 'solana-token';
    case 'Bitcoin':
      // Bitcoin requires external wallet - not supported in-app
      return 'unsupported';
    case 'Polkadot':
      // Polkadot DOT via Chainflip - handled separately
      return 'unsupported';
    default:
      return 'unsupported';
  }
}

/**
 * Check if a chain is supported for in-app deposits
 */
export function isChainSupportedForDeposit(chain: string): boolean {
  return ['Ethereum', 'Arbitrum'].includes(chain);
  // Add 'Solana' when kheopskit adds support
}




