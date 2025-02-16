import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { TokenGraph } from './TokenGraph';
import { XcmV4Location } from './types';
import { TradeRouterService } from '../network/TradeRouterService';

export interface RouterAsset {
    id: string;
    xcmLocation: XcmV4Location;
    metadata: {
        decimals: number;
    };
    hydradx?: {
        assetId: string;
    };
}

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

    constructor(
        api: TypedApi<typeof polkadot_asset_hub>,
        tokenGraph: TokenGraph
    ) {
        this.api = api;
        this.tokenGraph = tokenGraph;
    }

    public async findBestRoute(
        fromAsset: RouterAsset,
        toAsset: RouterAsset,
        amountIn: bigint
    ): Promise<RouteQuote | null> {
        try {
            // Get quotes from both DEXes in parallel
            const [assetHubQuote, hydraDxQuote] = await Promise.all([
                // Get Asset Hub quote
                this.getBestAssetHubQuote(fromAsset, toAsset, amountIn),
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

    private async calculatePathQuote(
        path: string[],
        fromAsset: RouterAsset,
        toAsset: RouterAsset,
        amountIn: bigint
    ): Promise<RouteQuote | null> {
        try {
            const hops: RouteQuote['hops'] = [];
            let currentAmount = amountIn;
            
            // Calculate quote for the path
            const quote = await this.api.apis.AssetConversionApi.quote_price_exact_tokens_for_tokens(
                fromAsset.xcmLocation,
                toAsset.xcmLocation,
                currentAmount,
                true // include_fee parameter
            );

            if (!quote) return null;

            hops.push({
                from: fromAsset.id,
                to: toAsset.id,
                amountIn: currentAmount,
                amountOut: quote
            });

            const finalAmount = quote / BigInt(10 ** toAsset.metadata.decimals);
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

    
    private async getHydraDxQuote(
        fromAsset: RouterAsset,
        toAsset: RouterAsset,
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

            return {
                path: [fromAsset.id, toAsset.id],
                expectedOutput: BigInt(trade.amountOut.toString()),
                hops: [{
                    from: fromAsset.id,
                    to: toAsset.id,
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

    private async getBestAssetHubQuote(fromAsset: RouterAsset, toAsset: RouterAsset, amountIn: bigint): Promise<RouteQuote | null> {
        try {
            const paths = this.tokenGraph.findAllPaths(fromAsset.id, toAsset.id, 3, 'assetHub');
            if (paths.length === 0) return null;

            const pathQuotes = await Promise.all(
                paths.map(path => this.calculatePathQuote(path, fromAsset, toAsset, amountIn))
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
    }

}