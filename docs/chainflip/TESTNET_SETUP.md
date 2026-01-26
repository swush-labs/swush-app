# Chainflip Testnet Setup Guide

## Overview

This guide explains how to use the Chainflip testnet (Perseverance) with Sepolia Ethereum for testing cross-chain swaps.

## Important Information

**The testnet is already configured!** When you see "Ethereum" in the Chainflip testnet environment, it refers to **Sepolia Ethereum**, not mainnet.

### Network Mapping

| Mainnet Network | Testnet Network |
|----------------|-----------------|
| Ethereum Mainnet | Sepolia Ethereum |
| Arbitrum One | Arbitrum Sepolia |
| Bitcoin Mainnet | Bitcoin Testnet |
| Polkadot Asset Hub | Polkadot Asset Hub (same) |
| Solana Mainnet | Solana Devnet |

## Supported Testnet Assets

Based on the Perseverance testnet API, the following assets are available:

### Sepolia Ethereum (Network: "Ethereum")
| Asset | Chainflip ID | Decimals | Contract Address |
|-------|--------------|----------|-----------------|
| ETH | `eth.eth` | 18 | Native |
| USDC | `usdc.eth` | 6 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| USDT | `usdt.eth` | 6 | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| FLIP | `flip.eth` | 18 | `0x826180541412D574cf1336d22c0C0a287822678A` |

### Arbitrum (Network: "Arbitrum")
| Asset | Chainflip ID | Decimals | Contract Address |
|-------|--------------|----------|-----------------|
| ETH | `eth.arb` | 18 | Native |
| USDC | `usdc.arb` | 6 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |

### Polkadot Asset Hub (Network: "Assethub")
| Asset | Chainflip ID | Decimals | Asset ID |
|-------|--------------|----------|----------|
| DOT | `dot.hub` | 10 | Native |
| USDC | `usdc.hub` | 6 | 1337 |
| USDT | `usdt.hub` | 6 | 1984 |

### Solana Devnet (Network: "Solana")
| Asset | Chainflip ID | Decimals | Contract Address |
|-------|--------------|----------|-----------------|
| SOL | `sol.sol` | 9 | Native |
| USDC | `usdc.sol` | 6 | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |

### Bitcoin Testnet (Network: "Bitcoin")
| Asset | Chainflip ID | Decimals |
|-------|--------------|----------|
| BTC | `btc.btc` | 8 |

## Environment Configuration

Your `.env.local` is already configured correctly:

```bash
# Chainflip Testnet (Perseverance)
NEXT_PUBLIC_CHAINFLIP_BROKER_URL=https://perseverance.chainflip-broker.io/
NEXT_PUBLIC_CHAINFLIP_API_KEY=b1db0633eb6b4035a28f3d2a608588b3
```

## Getting Testnet Funds

### 1. Sepolia ETH (for gas fees)
- **Faucet**: https://sepoliafaucet.com/
- **Alternative**: https://www.alchemy.com/faucets/ethereum-sepolia
- **Usage**: You need Sepolia ETH for gas fees when sending tokens

### 2. Sepolia FLIP (to fund your broker account)
According to the [Chainflip docs](https://docs.chainflip-broker.io/environments/testing/):
- You need Sepolia FLIP to fund your broker account
- **This is required before you can execute swaps**
- Contact Chainflip team or community for testnet FLIP tokens

### 3. Testnet Tokens (USDC, USDT, etc.)
For ERC20 testnet tokens on Sepolia:
- USDC Sepolia: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- USDT Sepolia: `0xdAC17F958D2ee523a2206206994597C13D831ec7`

You may need to:
1. Find a faucet for these tokens
2. Or mint them if they have a public mint function
3. Or request from Chainflip community

## Testing Swap Routes

### Example 1: Sepolia ETH → USDC (same network)
```
URL: http://localhost:3000/?from=ETH&fromNetwork=Ethereum&to=USDC&toNetwork=Ethereum
```

### Example 2: Sepolia ETH → Arbitrum USDC (cross-network)
```
URL: http://localhost:3000/?from=ETH&fromNetwork=Ethereum&to=USDC&toNetwork=Arbitrum
```

### Example 3: Sepolia USDC → Polkadot Asset Hub DOT
```
URL: http://localhost:3000/?from=USDC&fromNetwork=Ethereum&to=DOT&toNetwork=AssetHubPolkadot
```

### Example 4: Sepolia FLIP → Any supported token
```
URL: http://localhost:3000/?from=FLIP&fromNetwork=Ethereum&to=USDC&toNetwork=Arbitrum
```

## Wallet Configuration

Your wallet is already set up to support Sepolia:

```typescript
// From apps/web/src/lib/config/kheopskit.ts
export const sepolia = defineChain({
  id: "11155111",
  name: "Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.sepolia.org"],
    },
  },
  // ...
});
```

## How Swaps Work on Testnet

1. **Connect Wallet**: Connect your Sepolia wallet using kheopskit
2. **Select Tokens**: Choose tokens from the supported list above
3. **Get Quote**: The app calls Perseverance API for a quote
4. **Execute Swap**:
   - App requests a deposit address from Chainflip
   - Your wallet signs the transaction
   - App automatically submits the deposit to Sepolia
   - Chainflip processes the swap
   - Destination tokens arrive at your destination address

## Transaction Signing

The `signerUtils.ts` already supports Sepolia:

- **Native ETH**: Uses `sendEvmNativeDeposit()` - works with any EVM chain
- **ERC20 Tokens**: Uses `sendEvmTokenDeposit()` - encodes ERC20 `transfer()` call
- **No changes needed** - the functions are chain-agnostic

## Important Notes

### Broker Account Funding
From the [Chainflip docs](https://docs.chainflip-broker.io/environments/testing/):
> "You will need Ethereum Sepolia FLIP to fund your broker account."

**This means:**
- You need to fund your broker account with FLIP tokens first
- This is a one-time setup step
- Without this, swaps may fail

### Asset Registry Updates
The asset registry has been updated with:
- ✅ FLIP token support (`flip.eth`)
- ✅ All testnet assets with correct contract addresses
- ✅ Proper decimals for all tokens

## API Endpoints

### Get Available Assets
```bash
curl https://perseverance.chainflip-broker.io/assets
```

### Get Quote (Sepolia ETH → USDC)
```bash
curl "https://perseverance.chainflip-broker.io/quotes?sourceAsset=eth.eth&destinationAsset=usdc.eth&amount=0.1&apikey=YOUR_API_KEY"
```

### Check Balance
```bash
curl "https://perseverance.chainflip-broker.io/balance?apikey=YOUR_API_KEY"
```

## Troubleshooting

### "Insufficient balance" error
- Make sure you have enough Sepolia ETH for gas fees
- Check if your broker account is funded with FLIP

### "Token not found" error
- Verify the token is in the supported assets list above
- Check if the network name matches exactly ("Ethereum" for Sepolia)

### Transaction fails
- Ensure you're connected to Sepolia network in your wallet
- Check if you have enough balance of the source token
- Verify the contract address is correct for testnet

## Resources

- **Testnet API**: https://perseverance.chainflip-broker.io/
- **API Docs**: https://perseverance.chainflip-broker.io/docs/ui/
- **Chainflip Testnet Docs**: https://docs.chainflip-broker.io/environments/testing/
- **Perseverance Explorer**: https://scan.perseverance.chainflip.io/
- **Sepolia Etherscan**: https://sepolia.etherscan.io/

## Next Steps

1. ✅ Configuration is complete
2. 🔲 Get Sepolia ETH from faucet
3. 🔲 Get Sepolia FLIP to fund broker account
4. 🔲 Get testnet tokens (USDC, USDT) for testing
5. 🔲 Connect wallet and test a swap

## Summary

Your integration is **ready for testnet**! The key points:

- **"Ethereum" in testnet = Sepolia Ethereum** (not mainnet)
- All contract addresses are already configured correctly
- `signerUtils.ts` works with Sepolia out of the box
- You need Sepolia FLIP to fund your broker account
- All supported testnet assets are listed above
