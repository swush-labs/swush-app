'use client';

import { Suspense } from 'react';
import { Skeleton } from "@/components/ui/skeleton";

function WalletLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function WalletSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<WalletLoadingSkeleton />}>
      {children}
    </Suspense>
  );
}
