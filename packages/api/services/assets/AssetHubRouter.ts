import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { TokenGraph } from './TokenGraph';
import { Asset } from './types';
import { TradeRouterService } from '../network/TradeRouterService';

export interface RouteQuote {
    path: string[];
    expectedOutput: bigint;
    hops: {
        from: string;
        to: string;
        amountIn: bigint;
        amountOut: bigint;
    }[];
    dex: 'assetHub' | 'hydraDx';
}

export class AssetHubRouter {
    private tokenGraph: TokenGraph;
    private api: TypedApi<typeof polkadot_asset_hub>;
    private assetMap: Map<string, Asset>;

    constructor(
        api: TypedApi<typeof polkadot_asset_hub>,
        assetMap: Map<string, Asset>
    ) {
        this.api = api;
        this.assetMap = assetMap;
        this.tokenGraph = new TokenGraph();
        
        // Initialize graph with ALL assets
        for (const [assetId, asset] of assetMap) {
            this.tokenGraph.addNode(assetId, asset);
        }
        return this;
    }

    // Add method to expose graph
    public getTokenGraph(): TokenGraph {
        return this.tokenGraph;
    }

    // Method to initialize from cached graph
    public static fromCachedGraph(
        api: TypedApi<typeof polkadot_asset_hub>,
        assetMap: Map<string, Asset>,
        cachedGraph: TokenGraph
    ): AssetHubRouter {
        const router = new AssetHubRouter(api, assetMap);
        router.tokenGraph = cachedGraph;
        return router;
    }

    public addPool(assetOneId: string, assetTwoId: string): void {
        // Add edge without liquidity - we'll fetch it real-time when needed
        this.tokenGraph.addEdge(
            assetOneId,
            assetTwoId,
            `${assetOneId}-${assetTwoId}`,
            BigInt(0), // Placeholder liquidity
            0.003,
            'assetHub'
        );
    }

    private async getHydraDxQuote(
        fromAsset: Asset,
        toAsset: Asset,
        amountIn: bigint
    ): Promise<RouteQuote | null> {
        try {
            if (!fromAsset.hydradx || !toAsset.hydradx) {
                return null;
            }

            const tradeRouter = TradeRouterService.getInstance().getTradeRouter();
            const trade = await tradeRouter.getBestSell(
                fromAsset.hydradx.assetId,
                toAsset.hydradx.assetId,
                amountIn.toString()
            );

            if (!trade) {
                return null;
            }

            // Convert the trade to our RouteQuote format
            return {
                path: [fromAsset.hydradx.assetId, toAsset.hydradx.assetId],
                expectedOutput: BigInt(trade.amountOut.toString()),
                hops: [{
                    from: fromAsset.hydradx.assetId,
                    to: toAsset.hydradx.assetId,
                    amountIn: BigInt(trade.amountIn.toString()),
                    amountOut: BigInt(trade.amountOut.toString())
                }],
                dex: 'hydraDx'
            };
        } catch (error) {
            console.error('Error getting HydraDX quote:', error);
            return null;
        }
    }

    public async findBestRoute(
        fromAssetId: string,
        toAssetId: string,
        amountIn: bigint
    ): Promise<RouteQuote | null> {
        try {
            const fromAsset = this.assetMap.get(fromAssetId);
            const toAsset = this.assetMap.get(toAssetId);

            if (!fromAsset || !toAsset) {
                throw new Error('Assets not found');
            }

            // Get quotes from both DEXes in parallel
            const [assetHubQuote, hydraDxQuote] = await Promise.all([
                // Get Asset Hub quote
                (async () => {
                    try {
                        const paths = this.tokenGraph.findAllPaths(fromAssetId, toAssetId, 3, 'assetHub');
                        if (paths.length === 0) return null;

                        const pathQuotes = await Promise.all(
                            paths.map(path => this.calculatePathQuoteWithBatch(path, amountIn))
                        );

                        const validQuotes = pathQuotes.filter((quote): quote is RouteQuote => quote !== null);
                        if (validQuotes.length === 0) return null;

                        const bestAssetHubQuote = validQuotes.reduce((best, current) => 
                            current.expectedOutput > best.expectedOutput ? current : best
                        );
                        
                        return { ...bestAssetHubQuote, dex: 'assetHub' as const };
                    } catch (error) {
                        console.error('Error getting Asset Hub quote:', error);
                        return null;
                    }
                })(),
                // Get HydraDX quote if both assets support it
                this.getHydraDxQuote(fromAsset, toAsset, amountIn)
            ]);

            // Compare quotes and return the best one
            if (!assetHubQuote && !hydraDxQuote) {
                return null;
            }

            if (!assetHubQuote) return hydraDxQuote;
            if (!hydraDxQuote) return assetHubQuote;

            // Return the quote with higher expected output
            return assetHubQuote.expectedOutput > hydraDxQuote.expectedOutput
                ? assetHubQuote
                : hydraDxQuote;

        } catch (error) {
            console.error('Error finding best route:', error);
            return null;
        }
    }

    private async calculatePathQuoteWithBatch(
        path: string[],
        amountIn: bigint
    ): Promise<RouteQuote | null> {
        try {
            const hops: RouteQuote['hops'] = [];
            
            // Prepare pathAssets of type Asset
            const pathAssets: { from: Asset, to: Asset }[] = [];

            for (let i = 0; i < path.length - 1; i++) {
                const fromAsset = this.assetMap.get(path[i]);
                const toAsset = this.assetMap.get(path[i + 1]);
                
                if (!fromAsset || !toAsset) return null;
                pathAssets.push({ from: fromAsset, to: toAsset });
            }

            // Calculate quotes for each hop
            let currentAmount = amountIn;
            let toAssetDecimals = 0;
            
            for (let i = 0; i < pathAssets.length; i++) {
                const { from: fromAsset, to: toAsset } = pathAssets[i];

                // Get quote for this hop including fee calculation
                const quote = await this.api.apis.AssetConversionApi.quote_price_exact_tokens_for_tokens(
                    fromAsset.xcmLocation,
                    toAsset.xcmLocation,
                    currentAmount,
                    true // include_fee parameter
                );

                if (!quote) return null;

                hops.push({
                    from: path[i],
                    to: path[i + 1],
                    amountIn: currentAmount,
                    amountOut: quote
                });

                toAssetDecimals = toAsset.metadata.decimals;
                currentAmount = quote;
            }

            const finalAmount = currentAmount / BigInt(10 ** toAssetDecimals);
            return {
                path,
                expectedOutput: finalAmount,
                hops,
                dex: 'assetHub'
            };

        } catch (error) {
            console.error('Error calculating path quote:', error);
            return null;
        }
    }

    // private calculateHopPriceImpact(
    //     amountIn: bigint,
    //     amountOut: bigint,
    //     reserves: [bigint, bigint]
    // ): number {
    //     // Calculate price impact based on reserves and amounts
    //     const k = reserves[0] * reserves[1];
    //     const newReserve0 = reserves[0] + amountIn;
    //     const newReserve1 = k / newReserve0;
    //     const expectedOut = reserves[1] - newReserve1;
        
    //     return Number((expectedOut - amountOut) * BigInt(10000) / expectedOut) / 10000;
    // }

    // // Helper method to execute the multi-hop swap
    // public async executeSwap(
    //     route: RouteQuote,
    //     recipient: string,
    //     slippageTolerance: number = 0.01 // 1% default slippage
    // ) {
    //     const minOutput = route.expectedOutput * BigInt(Math.floor((1 - slippageTolerance) * 1000)) / BigInt(1000);
        
    //     // For multi-hop swaps, we use swap_exact_tokens_for_tokens with the full path
    //     const path = route.path.map(assetId => {
    //         const asset = this.assetMap.get(assetId);
    //         if (!asset) throw new Error(`Asset not found: ${assetId}`);
    //         return asset.xcmLocation;
    //     });

    //     return this.api.tx.AssetConversion.swap_exact_tokens_for_tokens({
    //         path,
    //         amount_in: route.hops[0].amountIn,
    //         amount_out_min: minOutput,
    //         send_to: recipient,
    //         keep_alive: true
    //     });
    // }
}


/*

// In your application code

// In your application code
async function findRoute(
    fromAssetId: string,
    toAssetId: string,
    amount: bigint
): Promise<RouteQuote | null> {
    const assetService = AssetService.getInstance();
    const cacheManager = CacheManager.getInstance();
    const connectionManager = ConnectionManager.getInstance();
    
    // Get cached graph and assets
    const cachedGraph = cacheManager.get('token_graph');
    const assets = await assetService.getAssets();
    const api = connectionManager.getAssetHubApi();
    
    if (!cachedGraph || !api) {
        throw new Error('Graph or API not initialized');
    }

    // Create router with cached graph
    const router = AssetHubRouter.fromCachedGraph(api, assets, cachedGraph);
    
    // Get real-time route
    return router.findBestRoute(fromAssetId, toAssetId, amount);
}
} */