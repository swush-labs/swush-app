'use client'

import dynamicImport from 'next/dynamic'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Image from 'next/image'

// Production-optimized: Load SwapContainer only on client side
// This is the standard pattern for WASM-based Web3 dApps
const SwapContainer = dynamicImport(
  () => import('@/components/swap/SwapContainer').then(mod => ({ default: mod.SwapContainer })),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }
)

export const dynamic = 'force-dynamic'

export default function SwapPage() {
  return (
    <ErrorBoundary>
      <div className="h-screen relative overflow-hidden">
        {/* Background loads immediately */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/background.png)' }}
        />
        <div 
          className="absolute w-screen h-screen origin-bottom-right bg-fixed bg-[position:bottom_40px_right_40px] bottom-0 right-0 bg-contain bg-no-repeat"
          style={{ backgroundImage: 'url(/images/firefly-n-mascot.png)' }}
        />
        
        {/* Logo loads immediately */}
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
        
        {/* SwapContainer loads async with WASM */}
        <SwapContainer />
      </div>
    </ErrorBoundary>
  )
}