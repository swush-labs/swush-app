<!-- 93cef574-b89e-49bb-90f9-0fdb62e0a338 8a16ca4c-d65a-4bc6-9e5d-bdeb594b296b -->
# Update Wallet Display in SwapField

## Overview

Modify the SwapField component to display the connected account's shortened address after wallet connection, and remove the balance display functionality.

## Changes Required

### 1. Update SwapField Component

**File:** `apps/web/src/components/swap/ui/SwapField.tsx`

**Changes:**

- Import `useSelectedAccount` hook to access selected account
- Import `shortenAddress` utility for formatting addresses
- Remove balance display from line 96-102 (the Wallet icon + balance section)
- Update the WalletButton section (lines 106-128) to conditionally show:
  - **When NOT connected (input field)**: "Connect Wallet" button
  - **When connected (input field)**: Connected status with shortened address
  - **Output field**: Keep "Select recipient" button

**Implementation details:**

```tsx
// Add imports
import { useSelectedAccount } from '@/components/wallet/use-selected-account';
import { shortenAddress } from '@/lib/utils';

// Inside component, get selected account
const { selectedAccount } = useSelectedAccount();

// Replace balance display section (lines 96-102) with empty div or remove entirely

// Update button section for input field:
{isInput ? (
  isConnected && selectedAccount ? (
    // Show connected status with address
    <div className="rounded-full py-1 px-3 flex items-center text-white bg-blue-whale/50 border border-burning-orange/30">
      <Check className="w-3 h-3 text-burning-orange" />
      <p className="text-xs font-normal ml-1">{shortenAddress(selectedAccount.address)}</p>
    </div>
  ) : (
    // Show connect wallet button
    <WalletButton onClick={onConnectWalletClick}>Connect Wallet</WalletButton>
  )
) : (
  // Output field - keep select recipient
  <WalletButton onClick={onSelectRecipientClick}>Select recipient</WalletButton>
)}
```

### 2. Update SwapContainer (if needed)

**File:** `apps/web/src/components/swap/SwapContainer.tsx`

The SwapContainer already passes `isConnected` to SwapField. Since we're now using the hook directly in SwapField, we can keep passing it for consistency, or rely entirely on the hook in SwapField.

## Summary

- Remove balance display from SwapField (lines 96-102)
- Show shortened address when wallet is connected instead of "Connect Wallet" button
- Add visual indicator (check icon) to show connection status
- Keep "Select recipient" button for output field unchanged

## Files to Modify

- `apps/web/src/components/swap/ui/SwapField.tsx` (main changes)

### To-dos

- [ ] Add account selection view and logic to ConnectWalletDialog.tsx with two-view system (wallets/accounts)
- [ ] Update SwapContainer.tsx to use selectedAccount hook instead of local wallet state
- [ ] Simplify SwapAction.tsx by removing wallet state setter props
- [ ] Enhance SelectRecipientDialog.tsx to display selected account details when connected