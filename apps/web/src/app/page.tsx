import { Suspense } from 'react'
import { SwapContainer } from '@/components/swap/SwapContainer'
import { LoadState } from '@/components/swap/ui/LoadState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Image from 'next/image'

export default function SwapPage() {
  return (
    <ErrorBoundary>
      <div className="h-screen relative overflow-hidden">
        {/* Simplified Swush-inspired background with better contrast */}
        <div className="absolute inset-0 bg-gradient-to-br from-forest-900 via-forest-900 to-slate-900">
        </div>
        
        {/* Swush Logo - Top Left Corner - Hidden on mobile */}
        <div className="absolute top-6 left-6 z-20 hidden md:block">
          <div className="relative">
            <Image
              src="/swush-logo.png"
              alt="Swush"
              width={100}
              height={100}
              className="drop-shadow-lg opacity-90 hover:opacity-100 transition-opacity duration-300"
              priority
            />
            {/* Subtle glow effect and increase the effect time to 300ms*/}
            <div className="absolute inset-0 bg-gradient-to-br from-flame-400/15 to-flame-500/10 rounded-full filter blur-lg -z-10"></div>
          </div>
        </div>

        <Suspense fallback={<LoadState />}>
          <SwapContainer />
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}