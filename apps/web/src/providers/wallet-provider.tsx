'use client';

import { KheopskitClientProvider } from "./kheopskit-client-provider";
import { WalletErrorBoundary } from "@/components/wallet/wallet-error-boundary";
import { WalletSuspense } from "@/components/wallet/wallet-suspense";

export function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletErrorBoundary>
        <KheopskitClientProvider>
          <WalletSuspense>
            {children}
          </WalletSuspense>
        </KheopskitClientProvider>
    </WalletErrorBoundary>
  );
}
