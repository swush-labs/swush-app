import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { NETWORKS_SUPPORTED } from "@/services/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to convert network name to display format
export const getNetworkDisplayName = (network: string): string => {
  const displayNameMap: Record<string, string> = {
    [NETWORKS_SUPPORTED.ASSET_HUB]: 'Asset Hub',
    [NETWORKS_SUPPORTED.HYDRA_DX]: 'Hydra DX',
    [NETWORKS_SUPPORTED.POLKADOT]: 'Polkadot'
  };
  
  return displayNameMap[network] || network;
};

export function shortenAddress(address: string, length?: number) {
  if (!length) length = 4;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}