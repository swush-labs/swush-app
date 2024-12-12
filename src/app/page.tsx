"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Settings, RotateCcw, ArrowRight, Wallet, Check, Loader2, ChevronsDown, History, X, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface TokenButtonProps {
  token: string;
  icon: React.ReactNode;
  onClick: () => void;
  price: string;
}

const TokenButton = ({ token, icon, onClick, price }: TokenButtonProps) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all duration-200 w-full group"
  >
    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-600 group-hover:from-slate-600 group-hover:to-slate-500 transition-all duration-200">
      {icon}
    </div>
    <div className="flex flex-col items-start">
      <span className="font-semibold text-white group-hover:text-slate-200 transition-colors duration-200">{token}</span>
      <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors duration-200">{price}</span>
    </div>
    <ArrowRight className="w-5 h-5 text-slate-400 ml-auto group-hover:text-slate-300 transition-colors duration-200" />
  </button>
)

interface SwapHistoryItem {
  id: number;
  type: 'success' | 'error';
  message: string;
  timestamp: Date;
}

// First, define a proper type for step status
type StepStatus = 'waiting' | 'pending' | 'loading' | 'completed' | 'failed';

// Add new interface for signing steps
interface SigningStep {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
  needsSignature: boolean;
}

// Add this new interface for detailed route info
interface DetailedRouteInfo {
  route: {
    path: string;
    details: string;
  };
}

// Add this component for the detailed info section
const DetailedSwapInfo: React.FC<{ details: DetailedRouteInfo }> = ({ details }) => (
  <div className="space-y-3 pt-3 border-t border-slate-700/50">
    {/* <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">Expected Output</span>
      <span className="text-slate-300 font-medium">{details.expectedOutput}</span>
    </div> */}
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Routing Path</span>
      </div>
      <div className="">
        <p className="text-xs text-slate-300 font-medium leading-relaxed">
          {details.route.path}
        </p>
        {/* <p className="text-xs text-slate-400 mt-1">
          {details.route.details}
        </p> */}
      </div>
    </div>
  </div>
);

export default function Component() {
  const [inputToken, setInputToken] = useState({ name: 'DOT', icon: '●', price: '$2.00' })
  const [outputToken, setOutputToken] = useState({ name: 'ETH', icon: 'Ξ', price: '$2000' })
  const [inputAmount, setInputAmount] = useState('50')
  const [outputAmount, setOutputAmount] = useState('0')
  const [slippageTolerance, setSlippageTolerance] = useState(0.5)
  const [transactionDeadline, setTransactionDeadline] = useState(20)
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [isSwapping, setIsSwapping] = useState(false)
  const [swapSteps, setSwapSteps] = useState<SigningStep[]>([
    { 
      id: 1, 
      title: 'Approve DOT',
      description: 'Allow the smart contract to spend your DOT',
      status: 'pending',
      needsSignature: true
    },
    { 
      id: 2, 
      title: 'Swap DOT → USDC',
      description: 'Swap DOT to USDC via Moonbeam DEX',
      status: 'waiting',
      needsSignature: true
    },
    { 
      id: 3, 
      title: 'Swap USDC → ETH',
      description: 'Swap USDC to ETH via Bridge',
      status: 'waiting',
      needsSignature: true
    },
  ])
  const [swapHistory] = useState<SwapHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [balance] = useState(1234.56)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [showSwapProgress, setShowSwapProgress] = useState(false)

  const handleInputChange = (value: string) => {
    setInputAmount(value)
    const inputValue = parseFloat(value)
    setOutputAmount(isNaN(inputValue) ? '0' : (inputValue * 2).toFixed(4))
    setInsufficientBalance(inputValue > balance)
  }

  const handleWalletConnect = () => {
    setIsConnected(!isConnected)
    setWalletAddress(isConnected ? '' : '0x1234...5678')
    
    if (!isConnected) {
      toast.success('Wallet connected successfully', {
        icon: '👋',
        style: {
          borderLeft: '4px solid #22c55e', // Green border for success
        },
      })
    } else {
      toast.success('Wallet disconnected', {
        icon: '👋',
        style: {
          borderLeft: '4px solid #64748b', // Slate border for neutral actions
        },
      })
    }
  }

  const handleSwap = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first', { icon: '🔒' })
      return
    }
    
    setShowSwapProgress(true)
    setIsSwapping(true)
  }

  const handleSignStep = async (stepId: number) => {
    try {
      // Set current step to loading
      setSwapSteps(steps => steps.map(step => ({
        ...step,
        status: step.id === stepId ? 'loading' : step.status
      })))

      await new Promise(r => setTimeout(r, 2000))
      const success = await mockBlockchainTransaction()
      
      if (!success) {
        setSwapSteps(steps => steps.map(step => ({
          ...step,
          status: step.id === stepId ? 'failed' : step.status
        })))
        throw new Error(`Step ${stepId} failed`)
      }

      // Mark current step as completed and next step as pending
      setSwapSteps(steps => steps.map(step => ({
        ...step,
        status: 
          step.id === stepId ? 'completed' :
          step.id === stepId + 1 ? 'pending' :
          step.status
      })))

    } catch (error) {
      console.error('Step failed:', error)
      toast.error(`Failed to complete step ${stepId}`, { icon: '❌' })
    }
  }

  const mockBlockchainTransaction = async (): Promise<boolean> => {
    const success = Math.random() > 0.1
    return success
  }

  const tokens = [
    { name: 'DOT', icon: '●', price: '$2.00' },
    { name: 'ETH', icon: 'Ξ', price: '$2000' },
    { name: 'BTC', icon: '₿', price: '$30000' },
  ]

  const percentageOptions = [
    { label: '25%', value: 0.25 },
    { label: '50%', value: 0.50 },
    { label: '75%', value: 0.75 },
    { label: 'MAX', value: 1 },
  ]

/*   const getStepStatusMessage = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return 'Transaction confirmed'
      case 'loading':
        return 'Processing transaction...'
      case 'failed':
        return 'Transaction failed'
      case 'pending':
        return 'Ready to process'
      case 'waiting':
        return 'Waiting to start'
      default:
        return 'Unknown status'
    }
  } */

  // Render the main action button based on connection state
  const renderActionButton = () => {
    if (!isConnected) {
      return (
        <Button 
          className="w-full h-14 text-lg font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          onClick={handleWalletConnect}
        >
          <Wallet className="w-5 h-5 mr-2" />
          Connect Wallet
        </Button>
      );
    }

    return (
      <Button 
        className="w-full h-14 text-lg font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-rose-500/25"
        onClick={handleSwap}
        disabled={!inputAmount || parseFloat(inputAmount) <= 0 || insufficientBalance}
      >
        {insufficientBalance ? (
          'Insufficient Balance'
        ) : isSwapping ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Swapping...
          </>
        ) : (
          'Swap'
        )}
      </Button>
    );
  };

  return (
    <>
      <div className="fixed top-4 right-4 hidden sm:flex items-center gap-4 z-50">
        <Button
          onClick={() => setShowHistory(true)}
          variant="outline"
          size="icon"
          className="bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-slate-300 transition-all duration-200"
        >
          <History className="w-4 h-4" />
        </Button>
        <Button
          onClick={handleWalletConnect}
          variant="outline"
          className="flex items-center gap-2 bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-slate-300 transition-all duration-200"
        >
          <Wallet className="w-4 h-4" />
          <span>{isConnected ? walletAddress : 'Connect Wallet'}</span>
        </Button>
      </div>

      <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-between items-center px-1">
            <h1 className="text-2xl font-bold text-white"></h1>
            <div className="flex gap-2 items-center">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800/50">
                    <Settings className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800">
                  <DialogHeader>
                    <DialogTitle className="text-white">Settings</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label className="text-sm text-slate-400">Slippage Tolerance (%)</label>
                      <Input
                        type="number"
                        value={slippageTolerance}
                        onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm text-slate-400">Transaction Deadline (minutes)</label>
                      <Input
                        type="number"
                        value={transactionDeadline}
                        onChange={(e) => setTransactionDeadline(parseInt(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                  <div className="sm:hidden pt-4 border-t border-slate-800">
                    <Button
                      onClick={handleWalletConnect}
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2 bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-white transition-all duration-200"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>{isConnected ? walletAddress : 'Connect Wallet'}</span>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800/50">
                <RotateCcw className="w-5 h-5" />
              </Button>
              <div className="sm:hidden">
                <Button
                  onClick={handleWalletConnect}
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-white hover:bg-slate-800/50"
                >
                  <Wallet className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <motion.div 
              className="p-6 rounded-2xl bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-slate-300">Pay</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Balance: </span>
                  <span className="text-sm font-medium text-slate-300">1,234.56 {inputToken.name}</span>
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                {percentageOptions.map(({ label, value }) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleInputChange((1234.56 * value).toString())}
                    className="text-xs font-medium bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white transition-all duration-200"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              
              <div className="flex items-center gap-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="flex-shrink-0">
                      <TokenButton
                        token={inputToken.name}
                        icon={
                          <div className="w-full h-full bg-pink-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-lg font-bold">{inputToken.icon}</span>
                          </div>
                        }
                        price={inputToken.price}
                        onClick={() => {}}
                      />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-800">
                    <DialogHeader>
                      <DialogTitle className="text-white">Select a token</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                      {tokens.map((token) => (
                        <TokenButton
                          key={token.name}
                          token={token.name}
                          icon={<div className={`w-full h-full ${token.name === 'DOT' ? 'bg-pink-500' : token.name === 'ETH' ? 'bg-blue-500' : 'bg-orange-500'} rounded-full flex items-center justify-center`}>
                            <span className="text-white text-lg font-bold">{token.icon}</span>
                          </div>}
                          price={token.price}
                          onClick={() => setInputToken(token)}
                        />
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="flex-1">
                  <Input
                    type="number"
                    value={inputAmount}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="border-0 bg-transparent text-2xl text-white focus-visible:ring-0 focus-visible:ring-offset-0 text-right appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>
              </div>
            </motion.div>

            <div className="flex justify-center -my-3 relative z-10">
              <motion.div 
                className="p-2 rounded-lg bg-slate-700/90 backdrop-blur-sm border border-slate-600/50 shadow-lg hover:bg-slate-600/90 transition-all duration-200 cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.01 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <ChevronsDown className="w-6 h-6 text-slate-300" />
              </motion.div>
            </div>

            <motion.div 
              className="p-6 rounded-2xl bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-slate-300">Receive</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Balance: </span>
                  <span className="text-sm font-medium text-slate-300">5,678.90 {outputToken.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="flex-shrink-0">
                      <TokenButton
                        token={outputToken.name}
                        icon={
                          <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-lg font-bold">{outputToken.icon}</span>
                          </div>
                        }
                        price={outputToken.price}
                        onClick={() => {}}
                      />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-800">
                    <DialogHeader>
                      <DialogTitle className="text-white">Select a token</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                      {tokens.map((token) => (
                        <TokenButton
                          key={token.name}
                          token={token.name}
                          icon={<div className={`w-full h-full ${token.name === 'DOT' ? 'bg-pink-500' : token.name === 'ETH' ? 'bg-blue-500' : 'bg-orange-500'} rounded-full flex items-center justify-center`}>
                            <span className="text-white text-lg font-bold">{token.icon}</span>
                          </div>}
                          price={token.price}
                          onClick={() => setOutputToken(token)}
                        />
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="flex-1">
                  <Input
                    type="number"
                    value={outputAmount}
                    readOnly
                    className="border-0 bg-transparent text-2xl text-white focus-visible:ring-0 focus-visible:ring-offset-0 text-right appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div 
            className="p-4 rounded-xl bg-slate-800/20 backdrop-blur-sm border border-slate-700/20 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className="space-y-2">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Minimum Received</span>
                  <span className="text-slate-300">
                    {(parseFloat(outputAmount) * 0.995).toFixed(4)} {outputToken.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Max Transaction Fee</span>
                  <span className="text-slate-300">0.004005</span>
                </div>
                {/* <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Price Impact</span>
                  <span className="text-slate-300">~0.1724%</span>
                </div> */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Route</span>
                  <span className="text-slate-300">Moonbeam</span>
                </div>
              </div>

              <Collapsible>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-center gap-2 pt-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
                    <span>Show more details</span>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="CollapsibleContent">
                  <DetailedSwapInfo
                    details={{
                      route: {
                        path: `${inputToken.name} → USDC → ${outputToken.name}`,
                        details: `${inputAmount} ${inputToken.name} → ${(parseFloat(inputAmount) * 1.5).toFixed(2)} USDC → ${outputAmount} ${outputToken.name}`,
                      },
                    }}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            {renderActionButton()}
          </motion.div>
          
        </div>
      </div>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Swap History</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4 max-h-96 overflow-y-auto">
            {swapHistory.length === 0 ? (
              <p className="text-slate-400">No swap history yet.</p>
            ) : (
              swapHistory.map((item) => (
                <div key={item.id} className="bg-slate-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${item.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {item.type === 'success' ? '✅ Success' : '❌ Error'}
                    </span>
                    <span className="text-xs text-slate-400">{item.timestamp.toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-white">{item.message}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Toaster
        position="top-right"
        toastOptions={{
          className: "!bg-slate-900 !border !border-slate-800 !text-white",
          style: {
            background: 'rgb(15 23 42 / 0.9)',
            border: '1px solid rgb(51 65 85 / 0.5)',
            backdropFilter: 'blur(8px)',
          },
        }}
      />

      {showSwapProgress && (
        <motion.div 
          className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="w-full max-w-md space-y-8 relative"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">
                  {swapSteps.every(step => step.status === 'completed') 
                    ? '🎉 Swap Complete'
                    : swapSteps.some(step => step.status === 'failed')
                    ? '❌ Swap Failed'
                    : '🔄 Confirming Swap'
                  }
                </h2>
                <p className="text-slate-400">
                  {inputAmount} {inputToken.name} → {outputAmount} {outputToken.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (!swapSteps.some(step => step.status === 'loading')) {
                    setShowSwapProgress(false)
                    setIsSwapping(false)
                    setSwapSteps(steps => steps.map((step, index) => ({
                      ...step,
                      status: index === 0 ? 'pending' : 'waiting'
                    })))
                  }
                }}
                disabled={swapSteps.some(step => step.status === 'loading')}
                className="text-slate-400 hover:text-white hover:bg-slate-800/50"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {swapSteps.map((step, index) => (
                <motion.div 
                  key={step.id}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-6 rounded-xl border backdrop-blur-sm transition-all duration-300
                    ${step.status === 'completed' ? 'bg-green-500/10 border-green-500/20 shadow-lg shadow-green-500/10' :
                      step.status === 'loading' ? 'bg-blue-500/10 border-blue-500/20 shadow-lg shadow-blue-500/10' :
                      step.status === 'pending' ? 'bg-yellow-500/10 border-yellow-500/20' :
                      step.status === 'failed' ? 'bg-red-500/10 border-red-500/20 shadow-lg shadow-red-500/10' :
                      'bg-slate-800/50 border-slate-700/50'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                      ${step.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                        step.status === 'loading' ? 'bg-blue-500/20 text-blue-500' :
                        step.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                        step.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                        'bg-slate-700/50 text-slate-400'}`}
                    >
                      {step.status === 'completed' ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                          <Check className="w-6 h-6" />
                        </motion.div>
                      ) : step.status === 'loading' ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : step.status === 'failed' ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                          <X className="w-6 h-6" />
                        </motion.div>
                      ) : (
                        <span className="text-lg font-semibold">{step.id}</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                        <p className="text-sm text-slate-400">{step.description}</p>
                      </div>
                      {step.needsSignature && step.status === 'pending' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <Button
                            onClick={() => handleSignStep(step.id)}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-5 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200"
                          >
                            Sign Transaction
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {swapSteps.every(step => step.status === 'completed') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8"
              >
                <Button
                  onClick={() => {
                    setShowSwapProgress(false)
                    setIsSwapping(false)
                  }}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-6 text-lg font-semibold rounded-xl shadow-lg shadow-green-500/25 transition-all duration-200"
                >
                  Return to Swap
                </Button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  )
}