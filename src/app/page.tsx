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
} from "@/components/ui/dialog"
import { Settings, Clock, ArrowRight, ArrowDownToLine, Wallet } from 'lucide-react'


interface TokenButtonProps {
  token: string;
  icon: React.ReactNode;
  onClick: () => void;
  price?: string; // Add price prop
}
const TokenButton = ({ token, icon, onClick }: TokenButtonProps) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors w-full"
  >
    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
      {icon}
    </div>
    <div className="flex flex-col items-start">
      <span className="font-medium text-white">{token}</span>
    </div>
    <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
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

  const handleInputChange = (value: string) => {
    setInputAmount(value)
    setOutputAmount((parseFloat(value) * 2).toString())
  }

  const handleWalletConnect = () => {
    setIsConnected(!isConnected)
    setWalletAddress(isConnected ? '' : '0x1234...5678')
  }

  const tokens = [
    { name: 'DOT', icon: '●', price: '$2.00' },
    { name: 'ETH', icon: 'Ξ', price: '$2000' },
    { name: 'BTC', icon: '₿', price: '$30000' },
  ]

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="fixed top-4 right-4">
        <Button
          onClick={handleWalletConnect}
          variant="outline"
          className="flex items-center gap-2 bg-slate-900/90 border-slate-800/50 hover:bg-slate-800 text-white"
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isConnected ? walletAddress : 'Connect Wallet'}
          </span>
        </Button>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-between items-center px-1">
          <h1 className="text-xl font-medium text-white">Swap</h1>
          <div className="flex items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-slate-800/50">
                  <Settings className="w-5 h-5 text-slate-400" />
                </button>
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
            <button className="p-2 rounded-lg hover:bg-slate-800/50">
              <Clock className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="p-4 rounded-2xl bg-slate-900/90 backdrop-blur-sm border border-slate-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-slate-400">Pay</span>
              <span className="text-sm font-medium text-white bg-slate-800 px-2 py-1 rounded-full">
                ${(parseFloat(inputAmount) * parseFloat(inputToken.price.slice(1))).toFixed(3)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <div className="flex-shrink-0">
                    <TokenButton
                      token={inputToken.name}
                      icon={
                        <div className="w-full h-full bg-pink-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">{inputToken.icon}</span>
                        </div>
                      }
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
                          <span className="text-white text-xs">{token.icon}</span>
                        </div>}
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
                  className="border-0 bg-transparent text-2xl text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-right"
                  placeholder="0"
                />
                <div className="text-right">
                  <span className="text-sm text-slate-400">$100 </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-2 relative z-10">
            <div className="p-2 rounded-lg bg-slate-800/90 backdrop-blur-sm border border-slate-700/50">
              <ArrowDownToLine className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 backdrop-blur-sm border border-slate-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-slate-400">Receive</span>
              <span className="text-sm font-medium text-white bg-slate-800 px-2 py-1 rounded-full">
                ${(parseFloat(outputAmount) * parseFloat(outputToken.price.slice(1))).toFixed(3)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <div className="flex-shrink-0">
                    <TokenButton
                      token={outputToken.name}
                      icon={
                        <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">{outputToken.icon}</span>
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
                          <span className="text-white text-xs">{token.icon}</span>
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
                  className="border-0 bg-transparent text-2xl text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-right"
                  placeholder="0"
                />
                <div className="text-right">
                  <span className="text-sm text-slate-400">$100</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>1 {inputToken.name} = {(parseFloat(outputToken.price.slice(1)) / parseFloat(inputToken.price.slice(1))).toFixed(4)} {outputToken.name} (${outputToken.price.slice(1)})</span>
            <div className="flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.2 4L4 7.2M4 7.2L7.2 10.4M4 7.2H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>$2.50</span>
            </div>
          </div>
        </div>

        <Button 
          className="w-full h-12 text-lg font-medium bg-rose-500/90 hover:bg-rose-500 text-white rounded-xl"
        >
          Swap
        </Button>
      </div>
    </div>
  )
}