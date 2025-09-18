import { Suspense } from 'react'
import { SwapContainer } from '@/components/swap/SwapContainer'
import { LoadState } from '@/components/swap/ui/LoadState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Image from 'next/image'

export default function SwapPage() {
  return (
    <ErrorBoundary>
      <div className="h-screen relative overflow-hidden">
        {/* Background image with overlay for better contrast */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/swush-background.svg)'
          }}
        >
          
        </div>
        
        {/* Logo at top left */}
        <div className="absolute top-4 left-4 md:top-2 md:left-6 z-10">
          <Image
            src="/swush-font.svg"
            alt="Swush Logo"
            width={148}
            height={52}
            className="w-28 h-auto md:w-32 lg:w-36"
            priority
          />
        </div>
        
        <Suspense fallback={<LoadState />}>
          <SwapContainer />
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}