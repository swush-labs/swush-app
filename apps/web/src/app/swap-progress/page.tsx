"use client"

import dynamicImport from 'next/dynamic'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
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

export default function SignTest() {
  const [showProgress, setShowProgress] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Demo steps for the signing process
  const [steps, setSteps] = useState<SigningStep[]>([
    {
      id: 1,
      title: "Approve Token Transfer",
      description: "Allow the smart contract to spend your tokens",
      status: "pending",
      needsSignature: true,
    },
    {
      id: 2,
      title: "Confirm Transaction",
      description: "Sign the transaction to complete the swap",
      status: "pending",
      needsSignature: true,
    },
    {
      id: 3,
      title: "Processing Swap",
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

    setCurrentStepIndex(prev => prev + 1)
  }

  const handleClose = () => {
    setShowProgress(false)
    setIsSwapping(false)
    // Reset steps for next demo
    setSteps(prevSteps => 
      prevSteps.map(step => ({
        ...step,
        status: "pending"
      }))
    )
    setCurrentStepIndex(0)
  }

  const startDemo = () => {
    setShowProgress(true)
    setIsSwapping(true)
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-white mb-8">Swap Progress Demo</h1>
        <Button
          onClick={startDemo}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-6 px-8 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200"
        >
          Start Signing Demo
        </Button>
      </div>

      {showProgress && (
        <SwapProgress
          steps={steps}
          onClose={handleClose}
          onSignStep={handleSignStep}
          inputAmount="100"
          inputToken="USDC"
          outputAmount="0.05"
          outputToken="ETH"
          isSwapping={isSwapping}
          setIsSwapping={setIsSwapping}
        />
      )}
    </div>
  )
}