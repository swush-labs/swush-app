"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallets } from '@kheopskit/react';

// Account interface from Kheopskit
interface KheopskitAccount {
  id: string;
  address: string;
  name?: string;
  platform: "polkadot" | "ethereum";
  walletName: string;
  polkadotSigner?: any;
  client?: any;
}

const STORAGE_KEY = 'kheopskit:selected-account-id';
const STORAGE_EVENT = 'kheopskit:account-changed';

/**
 * Simple localStorage-based account selection hook
 * Replaces the complex Context provider approach
 * Now with cross-component synchronization via custom events
 */
export function useSelectedAccount() {
  const { accounts } = useWallets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage once on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSelectedId(stored);
      }
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Listen for account changes from other hook instances
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAccountChange = (event: CustomEvent<string | null>) => {
      setSelectedId(event.detail);
    };

    window.addEventListener(STORAGE_EVENT as any, handleAccountChange);
    return () => {
      window.removeEventListener(STORAGE_EVENT as any, handleAccountChange);
    };
  }, []);

  // Find the selected account object from accounts list
  const selectedAccount = useMemo(() => 
    selectedId ? accounts.find(acc => acc.id === selectedId) || null : null,
    [selectedId, accounts]
  );

  // Auto-select if only one account is available
  useEffect(() => {
    if (isInitialized && accounts.length === 1 && !selectedId) {
      const account = accounts[0];
      setSelectedId(account.id);
      localStorage.setItem(STORAGE_KEY, account.id);
    }
  }, [accounts, selectedId, isInitialized]);

  // Validate that stored account still exists, clear if not
  useEffect(() => {
    if (selectedId && accounts.length > 0 && isInitialized) {
      const exists = accounts.some(acc => acc.id === selectedId);
      if (!exists) {
        console.warn('Stored account no longer exists, clearing selection');
        setSelectedId(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [selectedId, accounts, isInitialized]);

  // Function to update selected account
  const setSelectedAccount = useCallback((account: KheopskitAccount | null) => {
    const id = account?.id || null;
    setSelectedId(id);
    
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      
      // Broadcast change to all other hook instances
      const event = new CustomEvent(STORAGE_EVENT, { detail: id });
      window.dispatchEvent(event);
    }
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      
      // Broadcast change to all other hook instances
      const event = new CustomEvent(STORAGE_EVENT, { detail: null });
      window.dispatchEvent(event);
    }
  }, []);

  return {
    selectedAccount,
    selectedAccountId: selectedId,
    setSelectedAccount,
    setSelectedAccountById: setSelectedId,
    clearSelection,
    isLoading: !isInitialized,
    isClientReady: typeof window !== 'undefined'
  };
}

/**
 * Convenience hook to get only Polkadot accounts
 */
export function useSelectedPolkadotAccount() {
  const { selectedAccount } = useSelectedAccount();
  return selectedAccount?.platform === 'polkadot' ? selectedAccount : null;
}

/**
 * Convenience hook to get only Ethereum accounts
 */
export function useSelectedEthereumAccount() {
  const { selectedAccount } = useSelectedAccount();
  return selectedAccount?.platform === 'ethereum' ? selectedAccount : null;
}

/**
 * Utility hook with additional helpers
 */
export function useAccountSelection() {
  const { 
    selectedAccount, 
    setSelectedAccount, 
    clearSelection, 
    isLoading 
  } = useSelectedAccount();
  
  return {
    selectedAccount,
    selectAccount: setSelectedAccount,
    clearAccount: clearSelection,
    isLoading,
    hasSelectedAccount: !!selectedAccount,
  };
}
