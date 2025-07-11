'use client';

import { useEffect } from 'react';
import ChopsticksService from '@/services/ChopsticksService';

export function ChopsticksStatus() {
  const chopsticksService = ChopsticksService.getInstance();

  useEffect(() => {
    if (!chopsticksService.isChopsticksMode()) {
      return;
    }

    // Initialize chopsticks on mount for immediate availability
    chopsticksService.initializeChopsticks();
  }, [chopsticksService]);

  // No UI - this component only handles auto-initialization
  return null;
} 