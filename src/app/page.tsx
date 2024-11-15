"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, RotateCcw, ArrowRight, Wallet, Check, Loader2, Info, ArrowLeftRight } from 'lucide-react'
import { motion } from 'framer-motion'

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

export default function Component() {
  const [inputToken, setInputToken] = useState({ name: 'DOT', icon: '●', price: '$2.00' })
  const [outputToken, setOutputToken] = useState({ name: 'ETH', icon: 'Ξ', price: '$2000' })
  const [inputAmount, setInputAmount] = useState('50')
  const [outputAmount, setOutputAmount] = useState('100')
  const [slippageTolerance, setSlippageTolerance] = useState(0.5)
  const [transactionDeadline, setTransactionDeadline] = useState(20)
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [isSwapping, setIsSwapping] = useState(false)
  const [swapSteps, setSwapSteps] = useState([
    { id: 1, title: 'Approve DOT', status: 'pending' },
    { id: 2, title: 'Swap DOT → USDC', status: 'waiting' },
    { id: 3, title: 'Swap USDC → ETH', status: 'waiting' },
  ])

  const handleInputChange = (value: string) => {
    setInputAmount(value)
    setOutputAmount((parseFloat(value) * 2).toString())
  }

  const handleWalletConnect = () => {
    setIsConnected(!isConnected)
    setWalletAddress(isConnected ? '' : '0x1234...5678')
  }

  const handleSwap = async () => {
    setIsSwapping(true)
    
    try {
      for (let i = 0; i < swapSteps.length; i++) {
        setSwapSteps(steps => steps.map(step =>
          step.id === i + 1 ? { ...step, status: 'loading' } : step
        ))
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000))
        setSwapSteps(steps => steps.map(step =>
          step.id === i + 1 ? { ...step, status: 'completed' } : step
        ))
      }
    } catch (error) {
      console.error('Swap failed:', error)
    }
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

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="fixed top-4 right-4 flex items-center gap-4">
        <Button
          onClick={handleWalletConnect}
          variant="outline"
          className="flex items-center gap-2 bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-white transition-all duration-200"
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isConnected ? walletAddress : 'Connect Wallet'}
          </span>
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="bg-slate-800/90 border-slate-700/50 hover:bg-slate-700 text-white transition-all duration-200">
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
          </DialogContent>
        </Dialog>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-between items-center px-1">
          <h1 className="text-2xl font-bold text-white">Swap Tokens</h1>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800/50">
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          <motion.div 
            className="p-6 rounded-2xl bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-white">Pay</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Balance: </span>
                <span className="text-sm font-medium text-white">1,234.56 {inputToken.name}</span>
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
                  className="border-0 bg-transparent text-3xl text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-right"
                  placeholder="0"
                />
              </div>
            </div>
          </motion.div>

          <div className="flex justify-center -my-3 relative z-10">
            <motion.div 
              className="p-2 rounded-lg bg-slate-700/90 backdrop-blur-sm border border-slate-600/50 shadow-lg hover:bg-slate-600/90 transition-all duration-200 cursor-pointer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeftRight className="w-6 h-6 text-slate-300" />
            </motion.div>
          </div>

          <motion.div 
            className="p-6 rounded-2xl bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-white">Receive</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Balance: </span>
                <span className="text-sm font-medium text-white">5,678.90 {outputToken.name}</span>
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
                  className="border-0 bg-transparent text-3xl text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-right"
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
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
              <TabsTrigger value="details" className="text-sm text-slate-400 data-[state=active]:bg-slate-700/50 data-[state=active]:text-white">Details</TabsTrigger>
              <TabsTrigger value="route" className="text-sm text-slate-400 data-[state=active]:bg-slate-700/50 data-[state=active]:text-white">Route</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Exchange Rate</span>
                <div className="flex items-center gap-2">
                  <span className="text-white">1 {inputToken.name} = {(parseFloat(outputToken.price.slice(1)) / parseFloat(inputToken.price.slice(1))).toFixed(4)} {outputToken.name}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-slate-500 hover:text-slate-400" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-800 border-slate-700">
                        <div className="space-y-2">
                          <p>Current market rate including:</p>
                          <ul className="text-xs space-y-1 text-slate-300">
                            <li>• Network fees</li>
                            <li>• Price impact</li>
                            <li>• DEX fees</li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Price Impact</span>
                <span className="text-green-400">-0.03%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Minimum Received</span>
                <span className="text-white">
                  {(parseFloat(outputAmount) * 0.995).toFixed(4)} {outputToken.name}
                </span>
              </div>
            </TabsContent>
            <TabsContent value="route" className="mt-4 text-sm">
              <div className="text-sm text-slate-400">
                Best route: <span className="text-white">{inputToken.name} → USDC → {outputToken.name}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">Estimated Time</span>
                <span className="text-white">~2 minutes</span>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        <Dialog open={isSwapping} onOpenChange={setIsSwapping}>
          <DialogTrigger asChild>
            <Button 
              className="w-full h-14 text-lg font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-rose-500/25"
              onClick={handleSwap}
            >
              Swap Tokens
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white">Confirming Swap</DialogTitle>
            </DialogHeader>
            <div className="mt-6 space-y-6">
              {swapSteps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-4">
                  <div className="relative">
                    <motion.div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center
                        ${step.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                          step.status === 'loading' ? 'bg-blue-500/20 text-blue-500' :
                          'bg-slate-800 text-slate-400'}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.2 }}
                    >
                      {step.status === 'completed' ? (
                        <Check className="w-6 h-6" />
                      ) : step.status === 'loading' ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <span className="text-lg font-semibold">{step.id}</span>
                      )}
                    </motion.div>
                    {index < swapSteps.length - 1 && (
                      <div className={`absolute left-1/2 top-full h-6 border-l-2 border-dashed
                        ${step.status === 'completed' ? 'border-green-500/50' : 'border-slate-700'}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-white">{step.title}</p>
                    <p className="text-sm text-slate-400">
                      {step.status === 'completed' ? 'Transaction confirmed' :
                       step.status === 'loading' ? 'Waiting for confirmation...' :
                       'Waiting to start'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="mt-8">
              {swapSteps.every(step => step.status === 'completed') ? (
                <Button
                  className="w-full bg-green-500 hover:bg-green-600 text-white text-lg font-semibold py-6 rounded-xl transition-all duration-200"
                  onClick={() => setIsSwapping(false)}
                >
                  Swap Complete
                </Button>
              ) : (
                <Button
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg font-semibold py-6 rounded-xl transition-all duration-200"
                  disabled
                >
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Confirming Swap
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}