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
 * Predefined chain configurations
 */
const CHAINS: Record<string, ViemChain> = {
  mainnet: { id: 1, name: 'Ethereum' },
  sepolia: { id: 11155111, name: 'Sepolia' },
  arbitrum: { id: 42161, name: 'Arbitrum One' },
  arbitrumSepolia: { id: 421614, name: 'Arbitrum Sepolia' },
};

/**
 * Check if we're in testnet mode based on environment variable
 */
const isTestnet = (): boolean => {
  return process.env.NEXT_PUBLIC_IS_TESTNET === 'true';
};

/**
 * Get the chain object for a given network name
 * Handles both mainnet and testnet (Perseverance) environments
 */
const getChainForNetwork = (network: string): ViemChain | undefined => {
  const testnet = isTestnet();

  switch (network) {
    case 'Ethereum':
      // In testnet mode, "Ethereum" means Sepolia
      return testnet ? CHAINS.sepolia : CHAINS.mainnet;
    case 'Arbitrum':
      // In testnet mode, "Arbitrum" means Arbitrum Sepolia
      return testnet ? CHAINS.arbitrumSepolia : CHAINS.arbitrum;
    default:
      console.warn(`Unknown EVM network: ${network}`);
      return undefined;
  }
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
 * @param network - Network name (e.g., "Ethereum", "Sepolia", "Arbitrum")
 * @returns Transaction hash
 */
export async function sendEvmNativeDeposit(
  client: EvmWalletClient,
  depositAddress: string,
  amount: string,
  decimals: number = 18,
  network?: string
): Promise<DepositResult> {
  try {
    // Convert amount to wei
    const amountWei = BigInt(toSmallestUnit(amount, decimals));

    // Resolve the chain based on network name and environment (testnet vs mainnet)
    const chain = network ? getChainForNetwork(network) : client.chain;

    console.log('💸 Sending EVM native deposit:', {
      to: depositAddress,
      amount: amount,
      amountWei: amountWei.toString(),
      network,
      chainId: chain?.id,
      chainName: chain?.name,
      isTestnet: isTestnet(),
    });

    if (!chain) {
      throw new Error(
        `Could not determine chain for network "${network}". Please ensure you're connected to the correct network.`
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
 * @param tokenAddress - ERC20 token contract address (mainnet)
 * @param amount - Amount in human-readable format (e.g., "100")
 * @param decimals - Token decimals (6 for USDC/USDT)
 * @param network - Network name (e.g., "Ethereum", "Sepolia", "Arbitrum")
 * @param testnetTokenAddress - Optional testnet contract address (used when NEXT_PUBLIC_IS_TESTNET=true)
 * @returns Transaction hash
 */
export async function sendEvmTokenDeposit(
  client: EvmWalletClient,
  depositAddress: string,
  tokenAddress: string,
  amount: string,
  decimals: number,
  network?: string,
  testnetTokenAddress?: string
): Promise<DepositResult> {
  try {
    // Use testnet address if in testnet mode and testnet address is provided
    const actualTokenAddress = isTestnet() && testnetTokenAddress
      ? testnetTokenAddress
      : tokenAddress;

    if (isTestnet() && testnetTokenAddress) {
      console.log(`🔄 Using testnet token address: ${testnetTokenAddress} (mainnet: ${tokenAddress})`);
    }

    // Convert amount to smallest unit
    const amountSmallest = BigInt(toSmallestUnit(amount, decimals));

    // ERC20 transfer function signature: transfer(address,uint256)
    // Function selector: 0xa9059cbb
    const transferSelector = '0xa9059cbb';

    // Encode parameters (address and uint256)
    const paddedAddress = depositAddress.slice(2).padStart(64, '0');
    const paddedAmount = amountSmallest.toString(16).padStart(64, '0');

    const data = `${transferSelector}${paddedAddress}${paddedAmount}` as `0x${string}`;

    // Resolve the chain based on network name and environment (testnet vs mainnet)
    const chain = network ? getChainForNetwork(network) : client.chain;

    console.log('💸 Sending EVM token deposit:', {
      token: actualTokenAddress,
      originalToken: tokenAddress !== actualTokenAddress ? tokenAddress : undefined,
      to: depositAddress,
      amount: amount,
      amountSmallest: amountSmallest.toString(),
      network,
      chainId: chain?.id,
      chainName: chain?.name,
      isTestnet: isTestnet(),
    });

    if (!chain) {
      throw new Error(
        `Could not determine chain for network "${network}". Please ensure you're connected to the correct network.`
      );
    }

    // Send transaction with explicit chain - use the resolved token address
    const txHash = await client.sendTransaction({
      to: actualTokenAddress as `0x${string}`,
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
  return ['Ethereum', 'Arbitrum', 'AssetHubPolkadot'].includes(chain);
  // Add 'Solana' when kheopskit adds support
}




