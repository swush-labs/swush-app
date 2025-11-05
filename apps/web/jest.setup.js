// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock ParaSpell XCM Router to avoid network calls in tests
jest.mock('@paraspell/xcm-router', () => ({
  RouterBuilder: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    to: jest.fn().mockReturnThis(),
    exchange: jest.fn().mockReturnThis(),
    currencyFrom: jest.fn().mockReturnThis(),
    currencyTo: jest.fn().mockReturnThis(),
    amount: jest.fn().mockReturnThis(),
    slippagePct: jest.fn().mockReturnThis(),
    senderAddress: jest.fn().mockReturnThis(),
    recipientAddress: jest.fn().mockReturnThis(),
    signer: jest.fn().mockReturnThis(),
    onStatusChange: jest.fn().mockReturnThis(),
    getBestAmountOut: jest.fn().mockResolvedValue({
      amountOut: BigInt('1000000000'),
      exchange: 'HydrationDex',
    }),
    getXcmFees: jest.fn().mockResolvedValue({
      origin: {
        fee: '1000000000',
        currency: 'DOT',
        feeType: 'dryRun',
        asset: { decimals: 10 },
      },
      destination: {
        fee: '500000',
        currency: 'USDC',
        feeType: 'dryRun',
        asset: { decimals: 6 },
      },
      hops: [],
    }),
    build: jest.fn().mockResolvedValue(undefined),
  })),
  getSupportedAssetsFrom: jest.fn(() => []),
  getSupportedAssetsTo: jest.fn(() => []),
  EXCHANGE_CHAINS: ['HydrationDex', 'AcalaDex', 'BifrostDex'],
}))

// Mock ParaSpell SDK
jest.mock('@paraspell/sdk', () => ({
  // Add minimal mocks as needed
}))

// Mock next/navigation for Next.js 13+ App Router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
}))

// Mock nuqs (query params library)
jest.mock('nuqs', () => ({
  parseAsString: jest.fn(() => ({
    withDefault: jest.fn((defaultValue) => defaultValue),
  })),
  useQueryState: jest.fn((key) => {
    const [state, setState] = require('react').useState(null)
    return [state, setState]
  }),
}))

// Mock Kheopskit wallet - using virtual mock to avoid resolution issues
jest.mock('@kheopskit/react', () => ({
  KheopskitProvider: ({ children }) => children,
  useWallets: jest.fn(() => ({
    wallets: [],
    selectedWallet: null,
    selectWallet: jest.fn(),
  })),
  useSelectedAccount: jest.fn(() => ({
    selectedAccount: null,
  })),
}), { virtual: true })

// Mock Sodazone Ocelloids Client to avoid ES module issues
jest.mock('@sodazone/ocelloids-client', () => ({
  createXcmAgent: jest.fn(() => ({
    health: jest.fn().mockResolvedValue({ status: 'ok' }),
    subscribe: jest.fn().mockResolvedValue({
      close: jest.fn(),
    }),
  })),
  xcm: {
    isXcmSent: jest.fn(() => false),
    isXcmRelayed: jest.fn(() => false),
    isXcmHop: jest.fn(() => false),
    isXcmReceived: jest.fn(() => false),
    isXcmTimeout: jest.fn(() => false),
  },
}), { virtual: true })

// Mock lodash.debounce to execute immediately in tests
jest.mock('lodash.debounce', () => {
  return jest.fn((fn) => {
    const debouncedFn = (...args) => fn(...args)
    debouncedFn.cancel = jest.fn()
    return debouncedFn
  })
})

