/**
 * Chainflip Signer Utilities
 *
 * Helper functions to build and send transactions for Chainflip deposits.
 * These utilities abstract the chain-specific transaction building and signing.
 */

import { toSmallestUnit } from '@/lib/amountUtils';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/web';
import { APPKIT_CHAINS } from '@/lib/config/kheopskit';

// ═══════════════════════════════════════════════════════════════════════════════
// Chain Resolution
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Minimal chain definition for viem sendTransaction
 */
interface ViemChain {
  id: number;
  name: string;
}

/**
 * Get chain object from chainId
 * Uses chain definitions from kheopskit config for consistency
 */
const getChainFromId = (chainId: number): ViemChain | undefined => {
  // Filter EVM chains from kheopskit config and create a mapping
  const evmChains = APPKIT_CHAINS.filter(
    (chain) => (chain as { chainNamespace?: string }).chainNamespace === 'eip155'
  );

  // Find matching chain by converting string ID to number
  const chain = evmChains.find((c) => {
    const id = typeof c.id === 'string' ? parseInt(c.id, 10) : c.id;
    return id === chainId;
  });

  if (!chain) {
    return undefined;
  }

  // Convert chain ID to number if it's a string
  const numericId = typeof chain.id === 'string' ? parseInt(chain.id, 10) : chain.id;

  return {
    id: numericId,
    name: chain.name || `Chain ${chainId}`,
  };
};


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
    chain?: any;
  }) => Promise<`0x${string}`>;
  account?: {
    address: `0x${string}`;
  };
  chain?: any;
}

/**
 * Solana account interface (from kheopskit)
 */
interface SolanaAccount {
  address: string;
  publicKey: Uint8Array;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signAndSendTransaction: (
    transaction: Uint8Array,
    options?: { minContextSlot?: number }
  ) => Promise<{ signature: Uint8Array }>;
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
 * @param chainId - EVM chain ID (e.g., 1 for Ethereum, 11155111 for Sepolia, 42161 for Arbitrum)
 * @returns Transaction hash
 */
export async function sendEvmNativeDeposit(
  client: EvmWalletClient,
  depositAddress: string,
  amount: string,
  decimals: number = 18,
  chainId?: number
): Promise<DepositResult> {
  try {
    // Convert amount to wei
    const amountWei = BigInt(toSmallestUnit(amount, decimals));

    // Resolve the chain from chainId (preferred) or use client's chain
    const chain = chainId ? getChainFromId(chainId) : client.chain;

    console.log('💸 Sending EVM native deposit:', {
      to: depositAddress,
      amount: amount,
      amountWei: amountWei.toString(),
      chainId: chain?.id,
      chainName: chain?.name,
    });

    if (!chain) {
      throw new Error(
        `Could not determine chain. Please provide chainId or ensure client has chain configured.`
      );
    }

    // Send transaction with explicit chain
    const txHash = await client.sendTransaction({
      to: depositAddress as `0x${string}`,
      value: amountWei,
      chain,
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
 * @param tokenAddress - ERC20 token contract address (correct for the network)
 * @param amount - Amount in human-readable format (e.g., "100")
 * @param decimals - Token decimals (6 for USDC/USDT, 18 for FLIP)
 * @param chainId - EVM chain ID (e.g., 1 for Ethereum, 11155111 for Sepolia, 42161 for Arbitrum)
 * @returns Transaction hash
 */
export async function sendEvmTokenDeposit(
  client: EvmWalletClient,
  depositAddress: string,
  tokenAddress: string,
  amount: string,
  decimals: number,
  chainId?: number
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

    // Resolve the chain from chainId (preferred) or use client's chain
    const chain = chainId ? getChainFromId(chainId) : client.chain;

    console.log('💸 Sending EVM token deposit:', {
      token: tokenAddress,
      to: depositAddress,
      amount: amount,
      amountSmallest: amountSmallest.toString(),
      chainId: chain?.id,
      chainName: chain?.name,
    });

    if (!chain) {
      throw new Error(
        `Could not determine chain. Please provide chainId or ensure client has chain configured.`
      );
    }

    // Send transaction with explicit chain
    const txHash = await client.sendTransaction({
      to: tokenAddress as `0x${string}`,
      data,
      chain,
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
// Solana Deposit Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send native SOL deposit to Chainflip deposit address
 * 
 * @param account - Solana account from kheopskit
 * @param depositAddress - Chainflip deposit address
 * @param amount - Amount in human-readable format (e.g., "1.5")
 * @param rpcUrl - Solana RPC URL (defaults to mainnet)
 * @returns Transaction hash
 */
export async function sendSolanaDeposit(
  account: SolanaAccount,
  depositAddress: string,
  amount: string,
  rpcUrl: string = 'https://api.mainnet-beta.solana.com'
): Promise<DepositResult> {
  try {
    // Dynamic import to avoid bundling issues
    const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
    
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Convert amount to lamports (SOL has 9 decimals)
    const lamports = BigInt(toSmallestUnit(amount, 9));
    
    const fromPubkey = new PublicKey(account.address);
    const toPubkey = new PublicKey(depositAddress);
    
    // Create transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: Number(lamports), // SystemProgram.transfer expects number
    });
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    // Build transaction
    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: fromPubkey,
    }).add(transferInstruction);
    
    // Serialize transaction
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    
    console.log('💸 Sending SOL deposit:', {
      from: account.address,
      to: depositAddress,
      amount,
      lamports: lamports.toString(),
    });
    
    // Sign and send via kheopskit wallet
    const { signature } = await account.signAndSendTransaction(serializedTx);
    
    // Convert signature bytes to base58 string
    const bs58 = await import('bs58');
    const signatureStr = bs58.default.encode(signature);
    
    console.log('✅ SOL deposit sent:', signatureStr);
    
    return {
      txHash: signatureStr,
      success: true,
    };
  } catch (error) {
    console.error('❌ SOL deposit failed:', error);
    return {
      txHash: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send SPL token deposit to Chainflip deposit address
 * 
 * @param account - Solana account from kheopskit
 * @param depositAddress - Chainflip deposit address
 * @param tokenMint - SPL token mint address
 * @param amount - Amount in human-readable format
 * @param decimals - Token decimals
 * @param rpcUrl - Solana RPC URL (defaults to mainnet)
 * @returns Transaction hash
 */
export async function sendSolanaTokenDeposit(
  account: SolanaAccount,
  depositAddress: string,
  tokenMint: string,
  amount: string,
  decimals: number,
  rpcUrl: string = 'https://api.mainnet-beta.solana.com'
): Promise<DepositResult> {
  try {
    // Dynamic imports
    const { Connection, PublicKey, Transaction } = await import('@solana/web3.js');
    const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
    
    const connection = new Connection(rpcUrl, 'confirmed');
    
    const fromPubkey = new PublicKey(account.address);
    const toPubkey = new PublicKey(depositAddress);
    const mintPubkey = new PublicKey(tokenMint);
    
    // Get associated token accounts
    const sourceAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
    const destAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);
    
    // Convert amount to smallest unit
    const tokenAmount = BigInt(toSmallestUnit(amount, decimals));
    
    // Create transfer instruction
    const transferInstruction = createTransferInstruction(
      sourceAta,
      destAta,
      fromPubkey,
      tokenAmount,
      [],
      TOKEN_PROGRAM_ID
    );
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    // Build transaction
    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: fromPubkey,
    }).add(transferInstruction);
    
    // Serialize transaction
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    
    console.log('💸 Sending SPL token deposit:', {
      from: account.address,
      to: depositAddress,
      token: tokenMint,
      amount,
    });
    
    // Sign and send via kheopskit wallet
    const { signature } = await account.signAndSendTransaction(serializedTx);
    
    // Convert signature bytes to base58 string
    const bs58 = await import('bs58');
    const signatureStr = bs58.default.encode(signature);
    
    console.log('✅ SPL token deposit sent:', signatureStr);
    
    return {
      txHash: signatureStr,
      success: true,
    };
  } catch (error) {
    console.error('❌ SPL token deposit failed:', error);
    return {
      txHash: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send DOT or AssetHub token deposit to Chainflip
 * Uses Polkadot API (PAPI) for transaction building
 * 
 * @param polkadotSigner - Polkadot signer from kheopskit
 * @param depositAddress - Chainflip deposit address
 * @param amount - Amount in human-readable format (e.g., "1.5")
 * @param decimals - Token decimals (10 for DOT, 6 for USDC)
 * @param assetId - For tokens like USDC (asset ID 1337), undefined for DOT
 * @returns Transaction hash
 */
export async function sendPolkadotDeposit(
  polkadotSigner: any,
  depositAddress: string,
  amount: string,
  decimals: number,
  assetId?: string
): Promise<DepositResult> {
  let client: ReturnType<typeof createClient> | null = null;
  
  try {
    console.log('💸 Sending Polkadot deposit:', {
      to: depositAddress,
      amount: amount,
      decimals,
      assetId,
    });

    // Create WebSocket provider for AssetHub
    const wsProvider = getWsProvider('wss://polkadot-asset-hub-rpc.polkadot.io');
    
    // Create client with typed API
    client = createClient(wsProvider);
    
    // Get typed API for AssetHub
    const typedApi = client.getTypedApi(polkadot_asset_hub);
    
    // Build transfer transaction
    const amountBigInt = toSmallestUnit(amount, decimals);
    
    let tx;
    if (assetId) {
      // Transfer asset (USDC, USDT, etc.) using Assets pallet
      console.log('🔧 Building Assets.transfer transaction for asset ID:', assetId);
      tx = typedApi.tx.Assets.transfer({
        id: Number(assetId),
        target: {
          type: 'Id',
          value: depositAddress,
        },
        amount: amountBigInt,
      });
    } else {
      // Transfer native DOT using Balances pallet
      console.log('🔧 Building Balances.transfer_keep_alive transaction');
      tx = typedApi.tx.Balances.transfer_keep_alive({
        dest: {
          type: 'Id',
          value: depositAddress,
        },
        value: amountBigInt,
      });
    }
    
    console.log('🔐 Signing and submitting transaction...');
    
    // Sign and submit using the polkadot signer
    const result = await tx.signAndSubmit(polkadotSigner);
    
    console.log('✅ Polkadot deposit sent:', result.txHash);
    
    return {
      txHash: result.txHash,
      success: true,
    };
  } catch (error) {
    console.error('❌ Polkadot deposit failed:', error);
    return {
      txHash: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Cleanup: destroy client connection
    if (client) {
      try {
        client.destroy();
      } catch (e) {
        console.warn('Failed to destroy PAPI client:', e);
      }
    }
  }
}

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
): 'evm-native' | 'evm-token' | 'polkadot-native' | 'polkadot-token' | 'solana-native' | 'solana-token' | 'unsupported' {
  switch (chain) {
    case 'Ethereum':
    case 'Sepolia':
    case 'Arbitrum':
      return asset === 'ETH' ? 'evm-native' : 'evm-token';
    case 'AssetHubPolkadot':
      return asset === 'DOT' ? 'polkadot-native' : 'polkadot-token';
    case 'Solana':
      return asset === 'SOL' ? 'solana-native' : 'solana-token';
    case 'Bitcoin':
      // Bitcoin requires external wallet - not supported in-app
      return 'unsupported';
    default:
      return 'unsupported';
  }
}

/**
 * Check if a chain is supported for in-app deposits
 */
export function isChainSupportedForDeposit(chain: string): boolean {
  return ['Ethereum', 'Sepolia', 'Arbitrum', 'AssetHubPolkadot', 'Solana'].includes(chain);
}




