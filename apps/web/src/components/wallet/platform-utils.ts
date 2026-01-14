"use client";

/**
 * Utility functions for matching token networks to wallet platforms
 */

export type WalletPlatform = "polkadot" | "ethereum" | "solana";

// EVM-compatible networks
const EVM_NETWORKS = ["Ethereum", "Arbitrum", "Sepolia", "ArbitrumSepolia"];

// Solana networks
const SOLANA_NETWORKS = ["Solana", "SolanaDevnet"];

/**
 * Get the required wallet platform for a given token network
 */
export function getRequiredPlatform(tokenNetwork: string | undefined): WalletPlatform | null {
  if (!tokenNetwork) return null;

  // EVM networks require ethereum wallet
  if (EVM_NETWORKS.includes(tokenNetwork)) {
    return "ethereum";
  }

  // Solana networks require solana wallet
  if (SOLANA_NETWORKS.includes(tokenNetwork)) {
    return "solana";
  }

  // All other networks (Polkadot ecosystem) require polkadot wallet
  return "polkadot";
}

/**
 * Check if a wallet platform is compatible with a token network
 */
export function isPlatformCompatible(
  walletPlatform: WalletPlatform | undefined,
  tokenNetwork: string | undefined
): boolean {
  if (!walletPlatform || !tokenNetwork) return true; // Can't validate if unknown

  const required = getRequiredPlatform(tokenNetwork);
  if (!required) return true;

  return walletPlatform === required;
}

/**
 * Get a human-readable platform name for display
 */
export function getPlatformDisplayName(platform: WalletPlatform | null): string {
  switch (platform) {
    case "ethereum":
      return "Ethereum";
    case "solana":
      return "Solana";
    case "polkadot":
      return "Polkadot";
    default:
      return "Unknown";
  }
}
