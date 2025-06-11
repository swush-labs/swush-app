import { Suspense } from 'react'
import { SwapContainer } from '@/components/swap/SwapContainer'
import { LoadState } from '@/components/swap/ui/LoadState'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function SwapPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadState />}>
        <SwapContainer />
      </Suspense>
    </ErrorBoundary>
  )
}