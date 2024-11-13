"use client"
import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import { ArrowDownIcon, Settings, Info, Wallet, Moon, Sun } from 'lucide-react'
import TokenSelectorDialog from '@/components/TokenSelectorDialog'
import { useTheme } from 'next-themes'

const availableTokens = [
    { name: 'DOT', balance: '1.5' },
    { name: 'HDX', balance: '0.5' },
    { name: 'USDC', balance: '1000' },
]

const STORAGE_KEYS = {
    SLIPPAGE: 'swap-slippage-tolerance',
    DEADLINE: 'swap-transaction-deadline'
};

const getStoredPreferences = () => {
    if (typeof window === 'undefined') return null;
    return {
        slippageTolerance: parseFloat(localStorage.getItem(STORAGE_KEYS.SLIPPAGE) ?? '0.5'),
        transactionDeadline: parseInt(localStorage.getItem(STORAGE_KEYS.DEADLINE) ?? '20')
    };
};

export default function Component() {
    const storedPrefs = getStoredPreferences();
    const [inputToken, setInputToken] = useState('DOT')
    const [outputToken, setOutputToken] = useState('USDC')
    const [inputAmount, setInputAmount] = useState('')
    const [outputAmount, setOutputAmount] = useState('')
    const [slippageTolerance, setSlippageTolerance] = useState(storedPrefs?.slippageTolerance ?? 0.5)
    const [transactionDeadline, setTransactionDeadline] = useState(storedPrefs?.transactionDeadline ?? 20)
    const [walletConnected, setWalletConnected] = useState(false)
    const { theme, setTheme } = useTheme()

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.SLIPPAGE, slippageTolerance.toString());
    }, [slippageTolerance]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.DEADLINE, transactionDeadline.toString());
    }, [transactionDeadline]);

    const handleInputChange = (value: string) => {
        setInputAmount(value)
        setOutputAmount((parseFloat(value) * 1800).toFixed(2))
    }

    const handleSwap = () => {
        console.log('Swap confirmed')
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background animation */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute left-1/4 top-1/4 w-64 h-64 bg-blue-200 dark:bg-blue-700 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob"></div>
                <div className="absolute right-1/4 bottom-1/4 w-64 h-64 bg-purple-200 dark:bg-purple-700 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute left-1/3 bottom-1/3 w-64 h-64 bg-pink-200 dark:bg-pink-700 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            </div>

            {/* Theme toggle button */}
            <Button
                variant="outline"
                size="icon"
                className="absolute top-4 left-4 bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-full"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Main swap container */}
            <div className="max-w-md w-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-3xl shadow-lg dark:shadow-2xl p-8 space-y-6 relative z-10 border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">Swap</h1>
                    <div className="flex items-center space-x-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-blue-500 hover:text-purple-500 transition-colors">
                                        <Info className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Trade tokens in an instant</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-blue-500 hover:text-purple-500 transition-colors">
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Advanced Settings</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="slippage" className="text-right">
                                            Slippage tolerance
                                        </Label>
                                        <Input
                                            id="slippage"
                                            type="number"
                                            value={slippageTolerance}
                                            onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
                                            className="col-span-3"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="deadline" className="text-right">
                                            Transaction deadline
                                        </Label>
                                        <Input
                                            id="deadline"
                                            type="number"
                                            value={transactionDeadline}
                                            onChange={(e) => setTransactionDeadline(parseInt(e.target.value))}
                                            className="col-span-3"
                                        />
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-white bg-opacity-50 dark:bg-gray-700/50 rounded-xl backdrop-blur-sm shadow-md">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">You pay</span>
                        </div>
                        <Input
                            type="number"
                            value={inputAmount}
                            onChange={(e) => handleInputChange(e.target.value)}
                            placeholder="0.0"
                            className="border-none text-2xl bg-transparent text-gray-800 dark:text-gray-200"
                        />
                        <TokenSelectorDialog
                            selectedToken={{ name: inputToken, balance: '1.5' }}
                            onSelectToken={(token) => setInputToken(token.name)}
                            availableTokens={availableTokens}
                        />
                    </div>

                    <div className="flex justify-center">
                        <Button variant="ghost" size="icon" className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md hover:shadow-lg transition-all">
                            <ArrowDownIcon className="h-6 w-6" />
                        </Button>
                    </div>

                    <div className="p-4 bg-white bg-opacity-50  dark:bg-gray-700/50 rounded-xl backdrop-blur-sm shadow-md">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">You receive</span>
                        </div>
                        <Input
                            type="number"
                            value={outputAmount}
                            readOnly
                            placeholder="0.0"
                            className="border-none text-2xl bg-transparent text-gray-800 dark:text-gray-200"
                        />
                        <TokenSelectorDialog
                            selectedToken={{ name: outputToken, balance: '1000' }}
                            onSelectToken={(token) => setOutputToken(token.name)}
                            availableTokens={availableTokens}
                        />
                    </div>
                </div>

                <div className="space-y-2 dark:text-gray-300">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Exchange rate</span>
                        <span>1 {inputToken} = 1800 {outputToken}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Network fee</span>
                        <span>~$5.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-help text-gray-500 dark:text-gray-400">Route</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Best route for your trade</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <span>{inputToken} → Hydration → {outputToken}</span>
                    </div>
                </div>

                {walletConnected ? (
                    <Button
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all"
                        onClick={handleSwap}
                        disabled={!inputAmount}
                    >
                        Swap
                    </Button>
                ) : (
                    <Button
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all"
                        onClick={() => setWalletConnected(true)}
                    >
                        <Wallet className="mr-2 h-5 w-5" /> Connect Wallet
                    </Button>
                )}
            </div>
        </div>
    )
}
