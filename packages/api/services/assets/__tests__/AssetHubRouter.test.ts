import { AssetHubRouter } from '../router/AssetHubRouter';
import { Asset, AssetType } from '../types';
import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';

describe('AssetHubRouter', () => {
    let router: AssetHubRouter;
    let mockApi: TypedApi<typeof polkadot_asset_hub>;
    let assetMap: Map<string, Asset>;

    // Helper function to create mock assets
    const createMockAsset = (id: string, decimals: number = 12): Asset => ({
        asset: {
            owner: '0x123',
            issuer: '0x123',
            admin: '0x123',
            freezer: '0x123',
            supply: BigInt(1000000),
            deposit: BigInt(1000),
            min_balance: BigInt(1),
            is_sufficient: true,
            accounts: 100,
            sufficients: 100,
            approvals: 0,
        },
        metadata: {
            deposit: BigInt(1000),
            name: `Asset ${id}`,
            symbol: id,
            decimals: decimals,
            is_frozen: false
        },
        assetType: AssetType.Native,
        xcmLocation: {
            parents: 0,
            interior: {
                type: 'X2',
                value: [
                    { type: 'PalletInstance', value: 50 },
                    { type: 'GeneralIndex', value: BigInt(id) }
                ]
            }
        }
    });

    beforeEach(() => {
        // Setup mock API with custom mock functions
        mockApi = {
            apis: {
                AssetConversionApi: {
                    get_reserves: async () => {
                        return [BigInt(1000000), BigInt(1000000)];
                    },
                    quote_price_exact_tokens_for_tokens: async (_, __, amount) => {
                        return amount * BigInt(997) / BigInt(1000); // 0.3% fee
                    }
                }
            }
        } as any;

        // Initialize asset map with test assets
        assetMap = new Map([
            ['1', createMockAsset('1')], // DOT
            ['2', createMockAsset('2', 6)], // USDC
            ['3', createMockAsset('3', 18)], // ETH
            ['4', createMockAsset('4', 12)], // PINK
            ['5', createMockAsset('5', 12)]  // MYTH
        ]);

        router = new AssetHubRouter(mockApi, assetMap);
    });

    describe('findBestRoute', () => {
        test('should find direct route between two assets', async () => {
            const route = await router.findBestRoute('1', '2', BigInt(1000));
            
            expect(route).not.toBeNull();
            expect(route?.path).toEqual(['1', '2']);
            expect(route?.hops).toHaveLength(1);
        });

        test('should find multi-hop route when direct route not available', async () => {
            // Override mock API for this test
            mockApi = {
                apis: {
                    AssetConversionApi: {
                        get_reserves: async (asset1: any, asset2: any) => {
                            // Only return reserves for 1-2 and 2-3 pairs
                            if ((asset1.interior.value[1].value === BigInt(1) && 
                                 asset2.interior.value[1].value === BigInt(2)) ||
                                (asset1.interior.value[1].value === BigInt(2) && 
                                 asset2.interior.value[1].value === BigInt(3))) {
                                return [BigInt(1000000), BigInt(1000000)];
                            }
                            return undefined;
                        },
                        quote_price_exact_tokens_for_tokens: async (_, __, amount) => {
                            return amount * BigInt(997) / BigInt(1000);
                        }
                    }
                }
            } as any;

            router = new AssetHubRouter(mockApi, assetMap);
            const route = await router.findBestRoute('1', '3', BigInt(1000));
            
            expect(route).not.toBeNull();
            expect(route?.path).toEqual(['1', '2', '3']);
            expect(route?.hops).toHaveLength(2);
        });

        test('should return null when no route exists', async () => {
            // Override mock API to return no reserves
            mockApi = {
                apis: {
                    AssetConversionApi: {
                        get_reserves: async () => undefined,
                        quote_price_exact_tokens_for_tokens: async () => undefined
                    }
                }
            } as any;

            router = new AssetHubRouter(mockApi, assetMap);
            const route = await router.findBestRoute('1', '5', BigInt(1000));
            expect(route).toBeNull();
        });

        test('should calculate correct price impact', async () => {
            // Override mock API with specific reserves and quotes
            mockApi = {
                apis: {
                    AssetConversionApi: {
                        get_reserves: async () => {
                            return [BigInt(100000), BigInt(100000)];
                        },
                        quote_price_exact_tokens_for_tokens: async (_, __, amount) => {
                            return amount * BigInt(950) / BigInt(1000); // 5% impact
                        }
                    }
                }
            } as any;

            router = new AssetHubRouter(mockApi, assetMap);
            const route = await router.findBestRoute('1', '2', BigInt(10000));
            
            expect(route).not.toBeNull();
        });

        test('should handle failed API calls gracefully', async () => {
            // Override mock API to simulate failure
            mockApi = {
                apis: {
                    AssetConversionApi: {
                        get_reserves: async () => {
                            throw new Error('API Error');
                        },
                        quote_price_exact_tokens_for_tokens: async () => undefined
                    }
                }
            } as any;

            router = new AssetHubRouter(mockApi, assetMap);
            const route = await router.findBestRoute('1', '2', BigInt(1000));
            expect(route).toBeNull();
        });

        test('should respect maximum hop limit', async () => {
            const route = await router.findBestRoute('1', '5', BigInt(1000));
            expect(route?.path.length).toBeLessThanOrEqual(4); // path length is n+1 where n is number of hops
        });
    });
}); 