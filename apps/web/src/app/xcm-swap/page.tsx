"use client"

import dynamicImport from 'next/dynamic'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowRight, CheckCircle2, CircleDashed } from 'lucide-react'
import type { SigningStep } from '@/components/swap/types'

// Dynamically import SwapProgress to prevent WASM loading during build
const SwapProgress = dynamicImport(
  () => import('@/components/swap/ui/SwapProgress').then(mod => ({ default: mod.SwapProgress })),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }
)

// Force dynamic rendering to avoid WASM prerendering issues
export const dynamic = 'force-dynamic'

export default function XcmSwapPage() {
  const [showProgress, setShowProgress] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [swapFailed, setSwapFailed] = useState(false)
  const [showRetryOptions, setShowRetryOptions] = useState(false)

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
      const swapSucceeds = Math.random() > 0.5
      
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
    setShowProgress(false)
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
    setShowProgress(true)
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

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex flex-col items-center justify-center p-4">
      {!showProgress ? (
        <div className="max-w-2xl mx-auto bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-slate-700/50">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-white">Cross-Chain Swap Preview</h1>
              <p className="text-slate-400">You are about to swap assets in an isolated pool, which may have higher risks.</p>
            </div>

            <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
              <div className="flex justify-between items-center mb-4">
                <div className="space-y-1">
                  <p className="text-sm text-slate-400">You will send</p>
                  <p className="text-2xl font-semibold text-white">10 DOT</p>
                  <p className="text-sm text-slate-400">from Asset Hub</p>
                </div>
                <ArrowRight className="text-slate-500" />
                <div className="space-y-1 text-right">
                  <p className="text-sm text-slate-400">You will receive</p>
                  <p className="text-2xl font-semibold text-white">100 USDT</p>
                  <p className="text-sm text-slate-400">on Hydradx</p>
                </div>
              </div>

              <div className="space-y-2 mt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Price Impact</span>
                  <span className="text-white">1.2%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Slippage Tolerance</span>
                  <span className="text-white">1.5%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Network Fee</span>
                  <span className="text-white">~0.01 DOT</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-900/20 rounded-xl p-5 border border-blue-700/30 flex gap-4">
              <div className="shrink-0">
                <CircleDashed className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-blue-300 font-medium mb-1">Preview Summary</h3>
                <p className="text-blue-200 text-sm">Simulation successful. Your swap should complete with the expected output, and assets will be transferred to Hydradx.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="text-lg font-medium text-white">2-Step Process</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-slate-600/50 flex items-center justify-center text-white font-medium">1</div>
                    <div>
                      <h4 className="font-medium text-white">Send to Hydradx</h4>
                      <p className="text-sm text-slate-400 mt-1">Transfer your DOT from Asset Hub to Hydradx</p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-slate-600/50 flex items-center justify-center text-white font-medium">2</div>
                    <div>
                      <h4 className="font-medium text-white">Execute Swap</h4>
                      <p className="text-sm text-slate-400 mt-1">Swap your DOT for USDT on Hydradx</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={startSwap}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-6 px-8 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200"
            >
              Start Swap Process
            </Button>
          </div>
        </div>
      ) : (
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
            <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
              <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-xl">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 text-amber-500 mb-4">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Swap Failed</h2>
                  <p className="text-slate-400 mt-2">Your DOT is safe on Hydradx. What would you like to do next?</p>
                </div>
                
                <div className="space-y-4">
                  <Button 
                    onClick={handleRetry} 
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-xl"
                  >
                    Retry with Adjusted Parameters
                    <span className="block text-xs mt-1 text-blue-300">3% slippage, estimated 95 USDT output</span>
                  </Button>
                  
                  <Button 
                    onClick={handleRefund}
                    variant="outline" 
                    className="w-full border-slate-600 text-white hover:bg-slate-700 py-4 rounded-xl"
                  >
                    Return DOT to Asset Hub
                    <span className="block text-xs mt-1 text-slate-400">Additional network fee: ~0.01 DOT</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}