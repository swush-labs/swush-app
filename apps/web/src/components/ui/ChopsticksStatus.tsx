'use client';

import { useEffect, useState } from 'react';
import ChopsticksService from '@/services/ChopsticksService';

export function ChopsticksStatus() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const chopsticksService = ChopsticksService.getInstance();

  useEffect(() => {
    if (!chopsticksService.isChopsticksMode()) {
      return;
    }

    // Initialize chopsticks on mount
    chopsticksService.startChopsticks();

    // Update status periodically
    const interval = setInterval(() => {
      setStatus(chopsticksService.getConnectionStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [chopsticksService]);

  if (!chopsticksService.isChopsticksMode()) {
    return null;
  }

  const getStatusDisplay = () => {
    switch (status) {
      case 'connecting':
        return { text: 'Starting Chopsticks...', color: 'text-yellow-500', icon: '🟡' };
      case 'connected':
        return { text: 'Chopsticks Connected', color: 'text-green-500', icon: '🟢' };
      case 'error':
        return { text: 'Chopsticks Error', color: 'text-red-500', icon: '🔴' };
      default:
        return { text: 'Chopsticks Disconnected', color: 'text-gray-500', icon: '⚫' };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-sm">
        <span>{statusDisplay.icon}</span>
        <span className={statusDisplay.color}>{statusDisplay.text}</span>
      </div>
    </div>
  );
} 