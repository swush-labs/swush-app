"use client"

import dynamicImport from 'next/dynamic'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowRight, CheckCircle2, CircleDashed } from 'lucide-react'
import type { SigningStep } from '@/components/swap/types'

// Dynamically import WASM-dependent components
const SwapProgress = dynamicImport(
  () => import('@/components/swap/ui/SwapProgress').then(mod => ({ default: mod.SwapProgress })),
  { ssr: false }
)

const SwapPreview = dynamicImport(
  () => import('@/components/swap/ui/SwapPreview').then(mod => ({ default: mod.SwapPreview })),
  { ssr: false }
)

const SwapFailureOptions = dynamicImport(
  () => import('@/components/swap/ui/SwapFailureOptions').then(mod => ({ default: mod.SwapFailureOptions })),
  { ssr: false }
)

// Force dynamic rendering to avoid WASM prerendering issues
export const dynamic = 'force-dynamic'

export default function XcmSwapDemoPage() {
  const [currentView, setCurrentView] = useState<'preview' | 'progress' | 'home'>('home')
  const [isSwapping, setIsSwapping] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [swapFailed, setSwapFailed] = useState(false)
  const [showRetryOptions, setShowRetryOptions] = useState(false)
  const [simulationSuccess, setSimulationSuccess] = useState(true)
  const [showWarning, setShowWarning] = useState(false)

  // Demo steps for the XCM swap process
  const [steps, setSteps] = useState<SigningStep[]>([
    {
      id: 1,
      title: "Transfer assets to Hydradx",
      description: "Sign to transfer 10 DOT from Asset Hub to Hydradx",
      status: "pending",
      needsSignature: true,
    },
    {
      id: 2,
      title: "Execute swap on Hydradx",
      description: "Sign to swap 10 DOT to 100 USDT on Hydradx",
      status: "pending",
      needsSignature: true,
    },
    {
      id: 3,
      title: "Processing swap",
      description: "Waiting for transaction confirmation",
      status: "pending",
      needsSignature: false,
    }
  ])

  // Simulate signing steps
  const handleSignStep = async (stepId: number) => {
    setSteps(prevSteps => 
      prevSteps.map(step => {
        if (step.id === stepId) {
          return { ...step, status: "loading" }
        }
        return step
      })
    )

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Simulate swap success or failure in step 3
    if (stepId === 2) {
      // For demo purposes, let's assume the swap might fail 50% of the time
      const swapSucceeds = showWarning ? Math.random() > 0.8 : Math.random() > 0.5
      
      if (swapSucceeds) {
        setSteps(prevSteps => 
          prevSteps.map(step => {
            if (step.id === stepId) {
              return { ...step, status: "completed" }
            }
            return step
          })
        )
        
        // Mark step 3 as loading and then complete it
        setSteps(prevSteps => 
          prevSteps.map(step => {
            if (step.id === 3) {
              return { ...step, status: "loading" }
            }
            return step
          })
        )
        
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        setSteps(prevSteps => 
          prevSteps.map(step => {
            if (step.id === 3) {
              return { ...step, status: "completed" }
            }
            return step
          })
        )
      } else {
        // Swap failed
        setSteps(prevSteps => 
          prevSteps.map(step => {
            if (step.id === stepId) {
              return { ...step, status: "completed" }
            }
            return step
          })
        )
        
        // Mark step 3 as loading and then failed
        setSteps(prevSteps => 
          prevSteps.map(step => {
            if (step.id === 3) {
              return { ...step, status: "loading" }
            }
            return step
          })
        )
        
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        setSteps(prevSteps => 
          prevSteps.map(step => {
            if (step.id === 3) {
              return { ...step, status: "failed", description: "Swap failed due to high slippage. Your DOT is still on Hydradx." }
            }
            return step
          })
        )
        
        setSwapFailed(true)
        setShowRetryOptions(true)
      }
    } else {
      // Normal step completion
      setSteps(prevSteps => 
        prevSteps.map(step => {
          if (step.id === stepId) {
            return { ...step, status: "completed" }
          }
          return step
        })
      )

      // Move to next step
      if (stepId < steps.length) {
        setSteps(prevSteps => 
          prevSteps.map(step => {
            if (step.id === stepId + 1) {
              return { ...step, status: "pending" }
            }
            return step
          })
        )
      }
    }

    setCurrentStepIndex(prev => prev + 1)
  }

  const handleClose = () => {
    setCurrentView('home')
    setIsSwapping(false)
    setSwapFailed(false)
    setShowRetryOptions(false)
    // Reset steps for next demo
    setSteps(prevSteps => 
      prevSteps.map(step => ({
        ...step,
        status: "pending",
        description: step.id === 3 
          ? "Waiting for transaction confirmation" 
          : step.description
      }))
    )
    setCurrentStepIndex(0)
  }

  const startSwap = () => {
    setCurrentView('progress')
    setIsSwapping(true)
  }

  const handleRetry = () => {
    // Add a new step for retry with adjusted parameters
    setSteps([
      ...steps.slice(0, 2), // Keep the first two steps (they're already completed)
      {
        id: 3,
        title: "Retry swap with adjusted parameters",
        description: "Sign to swap 10 DOT to ~95 USDT with 3% slippage",
        status: "pending",
        needsSignature: true,
      },
      {
        id: 4,
        title: "Processing retry swap",
        description: "Waiting for transaction confirmation",
        status: "pending",
        needsSignature: false,
      }
    ])
    setShowRetryOptions(false)
  }

  const handleRefund = () => {
    // Add a new step for refund
    setSteps([
      ...steps.slice(0, 2), // Keep the first two steps (they're already completed)
      {
        id: 3,
        title: "Refund assets to Asset Hub",
        description: "Sign to return 10 DOT from Hydradx to Asset Hub",
        status: "pending", 
        needsSignature: true,
      },
      {
        id: 4,
        title: "Processing refund",
        description: "Waiting for transaction confirmation",
        status: "pending",
        needsSignature: false,
      }
    ])
    setShowRetryOptions(false)
  }

  const handleShowPreview = (withWarning: boolean) => {
    setSimulationSuccess(!withWarning)
    setShowWarning(withWarning)
    setCurrentView('preview')
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex flex-col items-center justify-center p-4">
      {currentView === 'home' && (
        <div className="max-w-md space-y-8 text-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">XCM Swap Demo</h1>
            <p className="text-slate-300 mb-8">Choose a demo scenario to experience the full swap flow</p>
          </div>
          
          <div className="grid gap-4">
            <Button 
              onClick={() => handleShowPreview(false)}
              className="bg-green-500 hover:bg-green-600 text-white font-medium py-6 px-8 rounded-xl shadow-lg shadow-green-500/25 transition-all duration-200"
            >
              Successful Swap Demo
              <span className="block text-xs mt-1 text-green-300">
                Preview with successful simulation
              </span>
            </Button>
            
            <Button 
              onClick={() => handleShowPreview(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-6 px-8 rounded-xl shadow-lg shadow-amber-500/25 transition-all duration-200"
            >
              Risky Swap Demo
              <span className="block text-xs mt-1 text-amber-300">
                Preview with warning and possible failure
              </span>
            </Button>
          </div>
        </div>
      )}

      {currentView === 'preview' && (
        <SwapPreview
          inputAmount="10"
          inputToken="DOT"
          outputAmount="100"
          outputToken="USDT"
          sourceChain="Asset Hub"
          destinationChain="Hydradx"
          priceImpact={simulationSuccess ? "1.2" : "4.5"}
          slippageTolerance={simulationSuccess ? "1.5" : "1.0"}
          networkFee="~0.01 DOT"
          simulationSuccess={simulationSuccess}
          simulationWarning={
            simulationSuccess ? undefined : 
            "High price impact detected. The pool has low liquidity which may cause the swap to fail. Consider increasing slippage tolerance or reducing the swap amount."
          }
          onStartSwap={startSwap}
          onAdjustParams={() => {
            // In a real app, this would open slippage settings
            // For demo, just improve the chances
            setSimulationSuccess(true)
          }}
        />
      )}

      {currentView === 'progress' && (
        <>
          <SwapProgress
            steps={steps}
            onClose={handleClose}
            onSignStep={handleSignStep}
            inputAmount="10"
            inputToken="DOT"
            outputAmount="100"
            outputToken="USDT"
            isSwapping={isSwapping}
            setIsSwapping={setIsSwapping}
          />
          
          {showRetryOptions && (
            <SwapFailureOptions
              inputAmount="10"
              inputToken="DOT"
              sourceChain="Asset Hub"
              destinationChain="Hydradx"
              suggestedSlippage="3.0"
              estimatedOutput="95"
              outputToken="USDT"
              refundFee="~0.01 DOT"
              onRetry={handleRetry}
              onRefund={handleRefund}
            />
          )}
        </>
      )}
    </div>
  )
}