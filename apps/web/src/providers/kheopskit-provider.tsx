"use client";

import { KheopskitProvider as KheopskitProviderCore } from "@kheopskit/react";
import { WagmiProvider } from "wagmi";
import { kheopskitConfig } from "@/lib/config/kheopskit";
import { wagmiConfig } from "@/lib/config/wagmi";

export function KheopskitProvider({ children }: { children: React.ReactNode }) {
  return (
    <KheopskitProviderCore config={kheopskitConfig}>
      <WagmiProvider config={wagmiConfig}>
          {children}
      </WagmiProvider>
    </KheopskitProviderCore>
  );
}
