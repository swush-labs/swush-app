"use client";

import dynamic from "next/dynamic";

// Dynamically import Kheopskit provider with ssr disabled
const KheopskitProvider = dynamic(
  () => import("./kheopskit-provider").then((mod) => ({ default: mod.KheopskitProvider })),
  { ssr: false },
);

export function KheopskitClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <KheopskitProvider>{children}</KheopskitProvider>;
}

