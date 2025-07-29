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
            backgroundImage: 'url(/swush-background.png)'
          }}
        >
          
        </div>
        
        <Suspense fallback={<LoadState />}>
          <SwapContainer />
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}