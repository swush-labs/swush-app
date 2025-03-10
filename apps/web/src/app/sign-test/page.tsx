'use client';

import { useState } from 'react';
import { WalletButton, SignMessageButton } from '@/components/swap/WalletButton';

export default function SignTestPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Wallet Signing Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Connect Wallet</h2>
            <p className="text-sm text-gray-500">
              Connect your wallet to test the signing functionality
            </p>
          </div>
          
          <WalletButton
            isConnected={isConnected}
            setIsConnected={setIsConnected}
            setWalletAddress={setWalletAddress}
            className="w-full"
          />
          
          {isConnected && (
            <div className="mt-4">
              <p className="text-sm font-medium">Connected Address:</p>
              <p className="text-xs break-all bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                {walletAddress}
              </p>
            </div>
          )}
        </div>
        
        {isConnected && (
          <div className="border rounded-lg p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Sign Message</h2>
              <p className="text-sm text-gray-500">
                Test the signing functionality with your connected wallet
              </p>
            </div>
            
            <SignMessageButton />
          </div>
        )}
      </div>
    </div>
  );
} 