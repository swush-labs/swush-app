"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallets } from '@kheopskit/react';

// Account interface from Kheopskit
interface KheopskitAccount {
  id: string;
  address: string;
  name?: string;
  platform: "polkadot" | "ethereum" | "solana";
  walletName: string;
  polkadotSigner?: any;
  client?: any;
}

const RECIPIENT_STORAGE_KEY = 'swush:recipient-account-id';
const CUSTOM_ADDRESS_STORAGE_KEY = 'swush:custom-recipient-address';
const RECIPIENT_STORAGE_EVENT = 'swush:recipient-changed';

/**
 * Hook to manage recipient account selection with localStorage persistence
 * 
 * Features:
 * - Persists recipient selection across page refreshes
 * - Validates recipient account still exists
 * - Supports custom addresses
 * - Independent from sender (no automatic fallback)
 * - Syncs across components via custom events
 * - Auto-cleanup of invalid selections
 */
export function useRecipientAccount() {
  const { accounts } = useWallets();
  
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [customAddress, setCustomAddress] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage once on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      const storedId = localStorage.getItem(RECIPIENT_STORAGE_KEY);
      const storedCustom = localStorage.getItem(CUSTOM_ADDRESS_STORAGE_KEY);
      
      if (storedId) {
        setRecipientId(storedId);
      }
      if (storedCustom) {
        setCustomAddress(storedCustom);
      }
      
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Listen for recipient changes from other hook instances
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRecipientChange = (event: CustomEvent<{ id: string | null; custom: string | null }>) => {
      setRecipientId(event.detail.id);
      setCustomAddress(event.detail.custom);
    };

    window.addEventListener(RECIPIENT_STORAGE_EVENT as any, handleRecipientChange);
    return () => {
      window.removeEventListener(RECIPIENT_STORAGE_EVENT as any, handleRecipientChange);
    };
  }, []);

  // Find the recipient account object from accounts list
  const recipientAccountFromWallet = useMemo(() => 
    recipientId ? accounts.find(acc => acc.id === recipientId) || null : null,
    [recipientId, accounts]
  );

  // Validate that stored recipient still exists, clear if not
  useEffect(() => {
    if (recipientId && accounts.length > 0 && isInitialized) {
      const exists = accounts.some(acc => acc.id === recipientId);
      if (!exists) {
        console.warn('Stored recipient account no longer exists, clearing selection');
        setRecipientId(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(RECIPIENT_STORAGE_KEY);
        }
      }
    }
  }, [recipientId, accounts, isInitialized]);

  // Determine final recipient account (independent from sender)
  const recipientAccount = useMemo(() => {
    // Priority: custom address > wallet account > null (no fallback to sender)
    if (customAddress) {
      return {
        id: 'custom',
        address: customAddress,
        platform: 'custom' as any,
        walletName: 'Custom Address',
      } as KheopskitAccount;
    }
    
    if (recipientAccountFromWallet) {
      return recipientAccountFromWallet;
    }
    
    // Return null - SwapContainer will handle fallback to sender for transactions
    return null;
  }, [customAddress, recipientAccountFromWallet]);

  // Get recipient address (for actual transactions)
  // Returns empty string if no explicit recipient - caller should fall back to sender
  const recipientAddress = useMemo(() => {
    return recipientAccount?.address || '';
  }, [recipientAccount]);

  // Check if using custom address
  const isCustomAddress = useMemo(() => {
    return !!customAddress;
  }, [customAddress]);

  // Set recipient from wallet account
  const setRecipientAccount = useCallback((account: KheopskitAccount | null) => {
    const id = account?.id || null;
    setRecipientId(id);
    setCustomAddress(null); // Clear custom address when selecting from wallet
    
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(RECIPIENT_STORAGE_KEY, id);
        localStorage.removeItem(CUSTOM_ADDRESS_STORAGE_KEY);
      } else {
        localStorage.removeItem(RECIPIENT_STORAGE_KEY);
      }
      
      // Broadcast change
      const event = new CustomEvent(RECIPIENT_STORAGE_EVENT, { 
        detail: { id, custom: null } 
      });
      window.dispatchEvent(event);
    }
  }, []);

  // Set custom recipient address
  const setCustomRecipient = useCallback((address: string | null) => {
    setCustomAddress(address);
    setRecipientId(null); // Clear wallet selection when setting custom
    
    if (typeof window !== 'undefined') {
      if (address) {
        localStorage.setItem(CUSTOM_ADDRESS_STORAGE_KEY, address);
        localStorage.removeItem(RECIPIENT_STORAGE_KEY);
      } else {
        localStorage.removeItem(CUSTOM_ADDRESS_STORAGE_KEY);
      }
      
      // Broadcast change
      const event = new CustomEvent(RECIPIENT_STORAGE_EVENT, { 
        detail: { id: null, custom: address } 
      });
      window.dispatchEvent(event);
    }
  }, []);

  // Reset to sender (clear all recipient selections)
  const resetToSender = useCallback(() => {
    setRecipientId(null);
    setCustomAddress(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(RECIPIENT_STORAGE_KEY);
      localStorage.removeItem(CUSTOM_ADDRESS_STORAGE_KEY);
      
      // Broadcast change
      const event = new CustomEvent(RECIPIENT_STORAGE_EVENT, { 
        detail: { id: null, custom: null } 
      });
      window.dispatchEvent(event);
    }
  }, []);

  // Check if there's a saved recipient (for UI indicators)
  const hasSavedRecipient = useMemo(() => {
    return !!recipientId || !!customAddress;
  }, [recipientId, customAddress]);

  return {
    recipientAccount,
    recipientAddress,
    setRecipientAccount,
    setCustomRecipient,
    resetToSender,
    isCustomAddress,
    hasSavedRecipient,
    isLoading: !isInitialized,
  };
}

