import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { TokenGraph } from './TokenGraph';
import { TradeRouterService } from '../../network/TradeRouterService';
import { CacheService } from '../../cache/CacheService';
import { CACHE_KEYS } from '../../constants';
import { Asset } from '../types';

export interface RouteQuote {
    path: string[];
    expectedOutput: {
        raw: string;        // Original amount (planck/raw format)
        decimal: string;    // Decimal formatted amount for display/comparison
    };
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
    private assets: Map<string, Asset> | undefined;

    constructor(
        api: TypedApi<typeof polkadot_asset_hub>,
        tokenGraph: TokenGraph
    ) {
        this.api = api;
        this.tokenGraph = tokenGraph;
        const cacheService = CacheService.getInstance();
        this.assets = cacheService.get<Map<string, Asset>>(CACHE_KEYS.MERGED_ASSETS);
    }

    private formatAmount(amount: string | bigint, decimals: number): { raw: string; decimal: string } {
        try {
            const rawBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
            const raw = rawBigInt.toString();
            const decimal = (Number(rawBigInt) / Math.pow(10, decimals)).toFixed(decimals);
            
            return {
                raw,
                decimal
            };
        } catch (error) {
            console.error('Error formatting amount:', error);
            return {
                raw: '0',
                decimal: '0'
            };
        }
    }

    private convertToPlank(amount: string | number, decimals: number): bigint {
        try {
            // Convert amount to a number first to handle both string and number inputs
            const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
            // Use Math.round to avoid floating point precision issues
            const planckAmount = Math.round(numAmount * Math.pow(10, decimals));
            return BigInt(planckAmount);
        } catch (error) {
            console.error('Error converting to planck:', error);
            return BigInt(0);
        }
    }

    public async findBestRoute(
        fromAsset: string,
        toAsset: string,
        amountIn: string | number
    ): Promise<RouteQuote | null> {
        try {
            console.log('Starting findBestRoute:', {
                fromAsset,
                toAsset,
                amountIn
            });

            // Get asset details from cache
            const fromAssetDetails = this.assets?.get(fromAsset);
            const toAssetDetails = this.assets?.get(toAsset);

            if (!fromAssetDetails || !toAssetDetails) {
                console.error(`Asset details not found in cache: ${fromAsset} or ${toAsset}`);
                return null;
            }

            // Convert input amount to planck
            const amountInPlanck = this.convertToPlank(amountIn, fromAssetDetails.metadata.decimals);

            // Check if assets exist in token graph for routing
            const fromInGraph = this.tokenGraph.getNode(fromAsset);
            const toInGraph = this.tokenGraph.getNode(toAsset);

            // Get quotes from both DEXes in parallel
            const [assetHubQuote, hydraDxQuote] = await Promise.all([
                // For Asset Hub, check if both assets are in the graph first
                fromInGraph && toInGraph ? 
                    this.getBestAssetHubQuote(
                        fromAsset,
                        toAsset,
                        amountInPlanck
                    ) : null,
                // For HydraDX, check if both assets have HydraDX info
                fromAssetDetails.hydradx && toAssetDetails.hydradx ?
                    this.getHydraDxQuote(fromAsset, toAsset, amountInPlanck) : null
            ]);

            if (!assetHubQuote && !hydraDxQuote) return null;
            if (!assetHubQuote) return hydraDxQuote;
            if (!hydraDxQuote) return assetHubQuote;

            // Compare using decimal format
            const assetHubAmount = parseFloat(assetHubQuote.expectedOutput.decimal);
            const hydraDxAmount = parseFloat(hydraDxQuote.expectedOutput.decimal);

            return assetHubAmount > hydraDxAmount ? assetHubQuote : hydraDxQuote;

        } catch (error) {
            console.error('Error finding best route:', error);
            return null;
        }
    }

    public async getHydraDxQuote(
        fromAssetId: string,
        toAssetId: string,
        amountIn: bigint
    ): Promise<RouteQuote | null> {
        try {
            const fromAsset = this.assets?.get(fromAssetId);
            const toAsset = this.assets?.get(toAssetId);

            if (!fromAsset?.hydradx || !toAsset?.hydradx) {
                return null;
            }

            const tradeRouter = TradeRouterService.getInstance().getTradeRouter();
            const trade = await tradeRouter.getBestSell(
                fromAsset.hydradx.assetId,
                toAsset.hydradx.assetId,
                amountIn.toString()
            );

            console.log('HydraDx Quote:', trade?.toHuman());

            if (!trade) return null;

            return {
                path: [fromAssetId, toAssetId],
                expectedOutput: this.formatAmount(trade.amountOut.toString(), toAsset.metadata.decimals),
                hops: [{
                    from: fromAssetId,
                    to: toAssetId,
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

    private async getBestAssetHubQuote(
        fromAssetId: string,
        toAssetId: string,
        amountInPlanck: bigint
    ): Promise<RouteQuote | null> {
        try {
            const paths = this.tokenGraph.findAllPaths(fromAssetId, toAssetId, 3, 'assetHub');
            if (paths.length === 0) return null;

            const pathQuotes = await Promise.all(
                paths.map(path => this.calculatePathQuote(path, amountInPlanck))
            );

            const validQuotes = pathQuotes.filter((quote): quote is RouteQuote => quote !== null);
            if (validQuotes.length === 0) return null;

            // Compare using decimal format
            return validQuotes.reduce((best, current) =>
                parseFloat(current.expectedOutput.decimal) > parseFloat(best.expectedOutput.decimal) ? current : best
            );

        } catch (error) {
            console.error('Error getting Asset Hub quote:', error);
            return null;
        }
    }

    private async calculatePathQuote(
        path: string[],
        amountInPlanck: bigint
    ): Promise<RouteQuote | null> {
        try {
            const hops: RouteQuote['hops'] = [];
            let currentAmount = amountInPlanck;

            // Get all asset details from cache
            const pathAssets = path.map(id => this.assets?.get(id));
            if (pathAssets.some(asset => !asset)) {
                console.error('One or more assets not found in path');
                return null;
            }

            // Calculate quotes for each hop
            for (let i = 0; i < path.length - 1; i++) {
                const fromAsset = pathAssets[i]!;
                const toAsset = pathAssets[i + 1]!;

                const quote = await this.api.apis.AssetConversionApi.quote_price_exact_tokens_for_tokens(
                    fromAsset.xcmLocation,
                    toAsset.xcmLocation,
                    currentAmount,
                    true
                );

                if (!quote) {
                    console.error(`No quote available for hop ${path[i]} to ${path[i + 1]}`);
                    return null;
                }

                hops.push({
                    from: path[i],
                    to: path[i + 1],
                    amountIn: currentAmount,
                    amountOut: quote
                });

                currentAmount = quote;
            }

            // Get final asset for decimals calculation
            const finalAsset = pathAssets[pathAssets.length - 1]!;
            
            return {
                path,
                expectedOutput: this.formatAmount(currentAmount, finalAsset.metadata.decimals),
                hops,
                dex: 'assetHub'
            };

        } catch (error) {
            console.error('Error calculating path quote:', error);
            return null;
        }
    }
}

