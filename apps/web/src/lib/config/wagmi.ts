import { createConfig, http } from "wagmi";
import { APPKIT_CHAINS } from "./kheopskit";

// Filter only Ethereum chains for Wagmi
const ethereumChains = APPKIT_CHAINS.filter(network => 
  (network as any).chainNamespace === "eip155"
);

export const wagmiConfig = createConfig({
  chains: ethereumChains as any,
  transports: ethereumChains.reduce(
    (acc, chain) => {
      acc[chain.id as keyof typeof acc] = http();
      return acc;
    },
    {} as Record<string, ReturnType<typeof http>>
  ),
});

