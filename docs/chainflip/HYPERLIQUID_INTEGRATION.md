# Hyperliquid Integration Guide

## Overview

Swush enables users to bridge DOT from Polkadot to USDC on Arbitrum via Chainflip. After the swap completes, users can deposit their USDC directly into Hyperliquid for perpetual trading. This integration provides a seamless on-ramp from Polkadot ecosystem to Hyperliquid's decentralized perpetuals exchange.

## What is Hyperliquid?

**Hyperliquid** is a high-performance decentralized perpetuals exchange that operates on Arbitrum L2. It offers:
- Up to 50x leverage on perpetual contracts
- Low trading fees
- Deep liquidity
- Wide range of trading pairs
- Decentralized order book

## Supported Route

```
DOT (Polkadot/AssetHub) → USDC (Arbitrum) → Hyperliquid Deposit
                  ↓
              (Chainflip)
```

### Networks Supported
- **Mainnet**: Arbitrum (Production)
- **Testnet**: Arbitrum Sepolia (Testing)

## User Flow

### Step-by-Step Process

1. **Swap**: User initiates swap from DOT to USDC on Arbitrum via Chainflip
   - Chainflip handles the cross-chain bridge
   - User signs transaction in their Polkadot wallet
   - Swap completes in ~2-5 minutes

2. **Complete**: Swap completes, USDC arrives in user's Arbitrum wallet
   - User earns Swush Points for the swap
   - Success dialog displays with points celebration

3. **Hyperliquid CTA**: After revealing points, user sees "Continue to Hyperliquid" option
   - **Desktop**: Side-by-side cards (Swush Points + Hyperliquid CTA)
   - **Mobile**: Stacked cards for better mobile UX

4. **Redirect**: User clicks link → redirected to Hyperliquid
   - Referral code automatically applied
   - User deposits USDC using Hyperliquid's interface

5. **Trade**: User can now trade perpetuals on Hyperliquid

## UI Design

### Original Layout (No Hyperliquid CTA)
When the swap is NOT to USDC on Arbitrum, the original centered layout is preserved:

```
┌─────────────────────────────────────────┐
│                  ✅                     │
│           Swap Complete!                │
│           DOT → ETH                     │
│                                         │
│   ┌─────────────────────────────┐       │
│   │   🪙 (Swush coin)           │       │
│   │       60+                   │       │
│   │   Swush Points              │       │
│   └─────────────────────────────┘       │
│                                         │
└─────────────────────────────────────────┘
```

### With Hyperliquid CTA - Desktop Layout (≥640px)
Side-by-side cards when swapping to USDC on Arbitrum:

```
┌──────────────────────────────────────────────────┐
│                     ✅                           │
│              Swap Complete!                      │
│              DOT → USDC                          │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  🪙              │  │  💹 Trade on         │  │
│  │                  │  │     Hyperliquid      │  │
│  │    60+           │  │                      │  │
│  │  Swush Points    │  │  Your USDC is ready  │  │
│  │                  │  │  on Arbitrum!        │  │
│  │                  │  │                      │  │
│  │                  │  │  [Deposit Now →]     │  │
│  └──────────────────┘  └──────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### With Hyperliquid CTA - Mobile Layout (<640px)
Stacked cards when swapping to USDC on Arbitrum:

```
┌─────────────────────────────────────────┐
│                  ✅                     │
│           Swap Complete!                │
│           DOT → USDC                    │
│                                         │
│   ┌─────────────────────────────┐       │
│   │   🪙 (Swush coin)           │       │
│   │       60+                   │       │
│   │   Swush Points              │       │
│   └─────────────────────────────┘       │
│                                         │
│   ╔═════════════════════════════════╗   │
│   ║  💹 Ready to Trade?             ║   │
│   ║                                 ║   │
│   ║  Your USDC is on Arbitrum.      ║   │
│   ║  Deposit to Hyperliquid to      ║   │
│   ║  trade perpetuals.              ║   │
│   ║                                 ║   │
│   ║  ┌─────────────────────────┐    ║   │
│   ║  │  Continue to Hyperliquid │   ║   │
│   ║  └─────────────────────────┘    ║   │
│   ╚═════════════════════════════════╝   │
│                                         │
└─────────────────────────────────────────┘
```

## Technical Implementation

### Display Logic

The Hyperliquid CTA is shown conditionally based on:

```typescript
const showHyperliquidCTA = isGiftRevealed && 
    outputToken === 'USDC' && 
    (outputNetwork === 'Arbitrum' || outputNetwork === 'Arbitrum Sepolia');
```

**Conditions:**
- ✅ User has revealed Swush Points gift
- ✅ Output token is USDC
- ✅ Output network is Arbitrum (mainnet) or Arbitrum Sepolia (testnet)

**Layout Behavior:**
- **When CTA is NOT shown** (e.g., DOT → ETH): Original centered single-card layout
- **When CTA is shown** (e.g., DOT → USDC on Arbitrum): 
  - Desktop: Side-by-side layout
  - Mobile: Stacked layout

This ensures the normal swap completion flow remains unchanged for all other swaps.

### Referral Integration

The Hyperliquid link includes Swush's referral code:
```
https://app.hyperliquid.xyz/trade?referral=SWUSH
```

**To update the referral code:**
1. Navigate to: `apps/web/src/components/swap/ui/SwapCompleteDialog.tsx`
2. Find both instances (desktop and mobile layouts)
3. Update the `href` attribute with your referral code

### Files Modified

1. **`apps/web/src/components/swap/ui/SwapCompleteDialog.tsx`**
   - Added `outputNetwork` prop
   - Added conditional Hyperliquid CTA rendering
   - Implemented responsive layouts (desktop side-by-side, mobile stacked)

2. **`apps/web/src/components/swap/SwapContainer.tsx`**
   - Passed `outputNetwork={outputToken?.network}` to SwapCompleteDialog
   - Fixed `outputToken` to use `symbol` instead of `name`

3. **`apps/web/src/services/xcm-router/assetRegistry.ts`**
   - Added Arbitrum Sepolia to `CHAINFLIP_ONLY_NETWORKS`
   - Added USDC network instance for Arbitrum Sepolia
   - Added ETH network instance for Arbitrum Sepolia

4. **`apps/web/src/lib/config/kheopskit.ts`**
   - Added `arbitrumSepolia` chain definition
   - Added to `APPKIT_CHAINS` array for wallet support

## Requirements

### For Users

- **Polkadot Wallet**: Connected with DOT balance
- **EVM Wallet**: Connected for receiving USDC on Arbitrum
- **Gas**: Small amount of ETH on Arbitrum for Hyperliquid deposit transaction

### For Developers

- **Environment Variables**: Chainflip API key configured
- **Wallet SDK**: Kheopskit with Arbitrum support
- **RPC Endpoints**: Arbitrum mainnet/testnet access

## Testing

### Mainnet Testing

1. Swap DOT → USDC (Arbitrum)
2. Wait for completion (~2-5 min)
3. Verify Hyperliquid CTA appears
4. Click link → should redirect to Hyperliquid with referral code
5. Verify USDC balance on Arbitrum in your wallet

### Testnet Testing

1. Get testnet DOT (from faucet)
2. Swap DOT → USDC (Arbitrum Sepolia)
3. Verify Hyperliquid CTA appears
4. Test referral link

**Test URLs:**
```bash
# Mainnet swap
http://localhost:3000/?from=DOT&fromNetwork=AssetHubPolkadot&to=USDC&toNetwork=Arbitrum

# Testnet swap
http://localhost:3000/?from=DOT&fromNetwork=AssetHubPerseverance&to=USDC&toNetwork=Arbitrum%20Sepolia
```

## Why Not Automated Deposit?

We chose a **simple referral link approach** over automated deposit integration for several reasons:

### Pros of Current Approach ✅
- **Quick to implement** - No complex smart contract integration
- **Clear user journey** - Users understand they're moving to a different platform
- **Lower risk** - No additional transaction signing or potential failures
- **User control** - Users decide when/if to deposit to Hyperliquid
- **Simpler maintenance** - No dependency on Hyperliquid's contract updates
- **Better UX for first-timers** - Users can learn about Hyperliquid before depositing

### Cons of Automated Approach ❌
- **Complex implementation** - Requires Hyperliquid SDK/contract integration
- **Additional transaction fees** - User pays gas twice (swap + deposit)
- **More points of failure** - Network issues, contract changes, etc.
- **User confusion** - Automatic actions may surprise users
- **Harder to maintain** - Requires tracking Hyperliquid's API/contract changes

## Future Enhancements

Potential improvements for future iterations:

- [ ] **Analytics tracking** - Track Hyperliquid CTA click-through rate
- [ ] **Gas estimation** - Show estimated gas cost for Hyperliquid deposit
- [ ] **Direct deposit integration** - Optional one-click deposit to Hyperliquid (advanced)
- [ ] **Balance display** - Show user's USDC balance on Arbitrum
- [ ] **Deposit history** - Track deposits to Hyperliquid from Swush
- [ ] **Tutorial** - First-time user guide for Hyperliquid trading

## FAQ

### Q: Do I need a Hyperliquid account?
**A:** No, Hyperliquid is non-custodial. You just need your EVM wallet (MetaMask, etc.) that holds the USDC on Arbitrum.

### Q: What if I don't want to use Hyperliquid?
**A:** The CTA is optional and non-intrusive. You can simply close the dialog and use your USDC elsewhere.

### Q: Does Swush earn from this integration?
**A:** Yes, through Hyperliquid's referral program. This helps support Swush development.

### Q: Can I trade immediately after swap?
**A:** You need to deposit USDC to Hyperliquid first (separate transaction, ~30 seconds).

### Q: What if Hyperliquid is down?
**A:** Your USDC is safely in your Arbitrum wallet. You can deposit to Hyperliquid anytime.

### Q: Why Arbitrum and not other L2s?
**A:** Hyperliquid operates on Arbitrum L2, providing low fees and fast finality.

## Support

For issues or questions:
- **Swush Integration**: Check GitHub issues or contact dev team
- **Hyperliquid Platform**: Visit [Hyperliquid Docs](https://hyperliquid.gitbook.io/)
- **Chainflip Swaps**: Check [Chainflip Status](https://scan.perseverance.chainflip.io/)

## Related Documentation

- [Chainflip Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Chainflip API Fixes](./API_FIXES_APPLIED.md)
- [Arbitrum Configuration](../../apps/web/src/lib/config/kheopskit.ts)
