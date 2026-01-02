import { createConfig, http } from "wagmi";
import { APPKIT_CHAINS } from "./kheopskit";

// Filter only Ethereum chains for Wagmi
const ethereumChains = APPKIT_CHAINS.filter(network =>
  (network as any).chainNamespace === "eip155"
).map(chain => ({
  ...chain,
  id: typeof chain.id === 'string' ? parseInt(chain.id, 10) : chain.id,
}));

export const wagmiConfig = createConfig({
  chains: ethereumChains as any,
  transports: ethereumChains.reduce(
    (acc, chain) => {
      acc[chain.id as any] = http();
      return acc;
    },
    {} as Record<number, ReturnType<typeof http>>
  ),
});

