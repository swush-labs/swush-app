import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to convert network name to display format
export const getNetworkDisplayName = (network: string): string => {
  const displayNameMap: Record<string, string> = {
    'asset_hub': 'Asset Hub',
    'hydra_dx': 'Hydra DX',
    'polkadot': 'Polkadot'
  };
  
  return displayNameMap[network] || network;
};