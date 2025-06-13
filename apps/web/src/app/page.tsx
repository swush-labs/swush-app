import { Suspense } from 'react'
import { SwapContainer } from '@/components/swap/SwapContainer'
import { LoadState } from '@/components/swap/ui/LoadState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Image from 'next/image'

export default function SwapPage() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen relative overflow-hidden">
        {/* Simplified Swush-inspired background with better contrast */}
        <div className="absolute inset-0 bg-gradient-to-br from-forest-900 via-forest-900 to-slate-900">
          {/* Subtle floating orbs for ambiance */}
          <div className="absolute top-20 left-10 w-24 h-24 bg-gradient-to-br from-flame-400/15 to-flame-500/10 rounded-full filter blur-2xl animate-flame-flicker"></div>
          <div className="absolute bottom-20 right-10 w-32 h-32 bg-gradient-to-br from-forest-300/10 to-forest-400/8 rounded-full filter blur-3xl animate-forest-sway"></div>
          
          {/* Clean depth overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent"></div>
        </div>
        
        {/* Swush Logo - Top Right Corner */}
        <div className="absolute top-6 left-6 z-20">
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