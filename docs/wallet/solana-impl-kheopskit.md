## ✅ Implementation Complete!

I've successfully implemented Solana transaction signing for Chainflip deposits. Here's what was accomplished:

### **Part 1: Extended kheopskit-wallet-sdk** 

**1. Updated SolanaAccount Type** ([types.ts](kheopskit-wallet-sdk/packages/core/src/api/types.ts))
- Added `signAndSendTransaction` method to the `SolanaAccount` interface
- Signature: `(transaction: Uint8Array, options?: { minContextSlot?: number }) => Promise<{ signature: Uint8Array }>`

**2. Implemented Transaction Signing** ([accounts.ts](kheopskit-wallet-sdk/packages/core/src/api/solana/accounts.ts))
- Wired up `signAndSendTransaction` using Wallet Standard's `solana:signAndSendTransaction` feature
- Follows the same pattern as existing `signMessage` implementation
- Includes proper error handling and validation

**3. Built and Linked Package**
- Successfully built kheopskit-wallet-sdk
- Linked to swush-app using `link:` protocol in package.json

---

### **Part 2: Implemented Solana Deposits in swush-app**

**1. Installed Dependencies**
- `@solana/web3.js` - For transaction building and Solana RPC
- `@solana/spl-token` - For SPL token transfers
- `bs58` - For base58 signature encoding

**2. Implemented `sendSolanaDeposit()`** ([signerUtils.ts](swush-app/apps/web/src/services/chainflip/signerUtils.ts))
```typescript
export async function sendSolanaDeposit(
  account: SolanaAccount,
  depositAddress: string,
  amount: string,
  rpcUrl: string = 'https://api.mainnet-beta.solana.com'
): Promise<DepositResult>
```
- Creates SystemProgram.transfer instruction for native SOL
- Builds and serializes transaction with recent blockhash
- Signs and sends via kheopskit's `signAndSendTransaction`
- Returns base58-encoded transaction signature

**3. Implemented `sendSolanaTokenDeposit()`**
```typescript
export async function sendSolanaTokenDeposit(
  account: SolanaAccount,
  depositAddress: string,
  tokenMint: string,
  amount: string,
  decimals: number,
  rpcUrl: string = 'https://api.mainnet-beta.solana.com'
): Promise<DepositResult>
```
- Gets associated token accounts for sender and receiver
- Creates SPL token transfer instruction
- Handles transaction building and signing

**4. Enabled Solana Chain Support**
- Updated `isChainSupportedForDeposit()` to include `'Solana'`

---

### **Key Design Decisions**

1. **Used `@solana/web3.js`** instead of `@solana/kit` - While @solana/kit is modern, @solana/web3.js is more mature and has better ecosystem support. The functional patterns are still clean with dynamic imports.

2. **Dynamic imports** - Used `await import()` for Solana libraries to avoid bundling issues and improve code splitting.

3. **Wallet Standard integration** - Leverages the `solana:signAndSendTransaction` feature which handles both signing AND broadcasting, simplifying the flow.

4. **Configurable RPC** - Added optional `rpcUrl` parameter for flexibility (mainnet/devnet).

5. **Error handling** - Comprehensive try-catch blocks with detailed logging.

---

### **Next Steps to Test**

1. **Rebuild kheopskit if you make changes:**
```bash
cd kheopskit-wallet-sdk
pnpm build
```

2. **The swush-app will automatically pick up changes** since it's linked locally.

3. **Test with a Solana wallet** that supports Wallet Standard (Phantom, Solflare, etc.):
   - Connect wallet in your app
   - Try a SOL deposit
   - Try an SPL token deposit (USDC, USDT, etc.)

4. **Monitor console logs** for transaction details and signatures.

---

### **Files Modified**

**kheopskit-wallet-sdk:**
- ✅ `packages/core/src/api/types.ts`
- ✅ `packages/core/src/api/solana/accounts.ts`

**swush-app:**
- ✅ `apps/web/package.json` (linked kheopskit locally)
- ✅ `apps/web/src/services/chainflip/signerUtils.ts`

All TODOs completed! 🎉 The Solana signing integration is ready for testing.