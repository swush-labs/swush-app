import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { TokenGraph } from './TokenGraph';
import { TradeRouterService } from './TradeRouterService';
import { CacheService } from '../../cache/CacheService';
import { CACHE_KEYS, NETWORKS_SUPPORTED, NUMBER_FORMAT_OPTIONS } from '../../constants';
import { Asset } from '../types';
import { convertToPlank, formatAmount } from '../utils';

export interface RouteQuote {
    path: string[];
    expectedOutput: {
        raw: string;        // Original amount (planck/raw format)
        decimal: string;    // Decimal formatted amount for display/comparison
    };
    hops: {
        from: string;
        to: string;
        amountIn: string;
        amountOut: string;
    }[];
    dex: typeof NETWORKS_SUPPORTED.ASSET_HUB | typeof NETWORKS_SUPPORTED.HYDRA_DX;
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

    public async findBestRoute(
        fromAsset: string,
        toAsset: string,
        amountIn: string | number,
        dex?: typeof NETWORKS_SUPPORTED.ASSET_HUB | typeof NETWORKS_SUPPORTED.HYDRA_DX
    ): Promise<RouteQuote | null> {
        try {
            console.log('--------------------------------');
            console.log('Starting findBestRoute:', {
                fromAsset,
                toAsset,
                amountIn,
                dex
            });

            // Get asset details from cache
            const fromAssetDetails = this.assets?.get(fromAsset);
            const toAssetDetails = this.assets?.get(toAsset);

            if (!fromAssetDetails || !toAssetDetails) {
                console.error(`Asset details not found in cache: ${fromAsset} or ${toAsset}`);
                return null;
            }

            // Convert input amount to planck
            const amountInPlanck = convertToPlank(amountIn, fromAssetDetails.metadata.decimals);

            // Check if assets exist in token graph for routing
            const fromInGraph = this.tokenGraph.getNode(fromAsset);
            const toInGraph = this.tokenGraph.getNode(toAsset);

            // Get quotes from both DEXes in parallel if no specific DEX is requested
            const [assetHubQuote, hydraDxQuote] = await Promise.all([
                // For Asset Hub, check if both assets are in the graph first
                (!dex || dex === NETWORKS_SUPPORTED.ASSET_HUB) && fromInGraph && toInGraph ?
                    this.getBestAssetHubQuote(
                        fromAsset,
                        toAsset,
                        amountInPlanck
                    ) : null,
                // For HydraDX, check if both assets have HydraDX info
                (!dex || dex === NETWORKS_SUPPORTED.HYDRA_DX) && fromAssetDetails.hydradx && toAssetDetails.hydradx ?
                    this.getHydraDxQuote(fromAsset, toAsset, amountIn.toString()) : null
            ]);

            // Return based on dex preference and availability
            if (dex === NETWORKS_SUPPORTED.ASSET_HUB) return assetHubQuote;
            if (dex === NETWORKS_SUPPORTED.HYDRA_DX) return hydraDxQuote;

            // If no specific dex requested, compare available quotes
            if (!assetHubQuote && !hydraDxQuote) return null;
            if (!assetHubQuote) return hydraDxQuote;
            if (!hydraDxQuote) return assetHubQuote;

            // Compare using decimal format
            const assetHubAmount = parseFloat(assetHubQuote.expectedOutput.decimal);
            const hydraDxAmount = parseFloat(hydraDxQuote.expectedOutput.decimal);

            //print the amount in and amount out for each quote 
            console.log('Asset Hub Amount:', assetHubAmount);
            console.log('HydraDX Amount:', hydraDxAmount);

            return assetHubAmount > hydraDxAmount ? assetHubQuote : hydraDxQuote;

        } catch (error) {
            console.error('Error finding best route:', error);
            return null;
        }
    }

    public async getHydraDxQuote(
        fromAssetId: string,
        toAssetId: string,
        amountIn: string
    ): Promise<RouteQuote | null> {
        try {
            const fromAsset = this.assets?.get(fromAssetId);
            const toAsset = this.assets?.get(toAssetId);

            if (!fromAsset?.hydradx || !toAsset?.hydradx) {
                return null;
            }

            const tradeRouter = await TradeRouterService.getInstance().getTradeRouter();
            const trade = await tradeRouter.getBestSell(
                fromAsset.hydradx.assetId,
                toAsset.hydradx.assetId,
                amountIn
            );

            console.log('HydraDx Quote:', trade?.toHuman());

            if (!trade) return null;

            // Use constant format options
            const formatOptions = NUMBER_FORMAT_OPTIONS;

            // const formattedAmountIn = formatAmount(trade.amountIn.toString(), fromAsset.metadata.decimals, formatOptions);
            const formattedAmountOut = formatAmount(trade.amountOut.toString(), toAsset.metadata.decimals, formatOptions);

            // if (!formattedAmountIn || !formattedAmountOut) {
            //     console.error('Error formatting amounts for HydraDX quote');
            //     return null;
            // }

            return {
                path: [fromAssetId, toAssetId],
                expectedOutput: {
                    raw: trade.amountOut.toString(),
                    decimal: formattedAmountOut.decimal
                },
                hops: [{
                    from: fromAssetId,
                    to: toAssetId,
                    amountIn: amountIn,
                    amountOut: formattedAmountOut.decimal
                }],
                dex: NETWORKS_SUPPORTED.HYDRA_DX
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

            console.log(`\n=== Starting path calculation ===`);
            console.log(`Path: ${path.map((p, i) => pathAssets[i]?.metadata.symbol || p).join(' → ')}`);
            console.log(`Initial amount: ${currentAmount.toString()} planck`);

            // Calculate quotes for each hop
            for (let i = 0; i < path.length - 1; i++) {
                const fromAsset = pathAssets[i]!;
                const toAsset = pathAssets[i + 1]!;
                const fromXcmLocation = fromAsset.rawXcmLocation;
                const toXcmLocation = toAsset.rawXcmLocation;

                const quote = await this.api.apis.AssetConversionApi.quote_price_exact_tokens_for_tokens(
                    fromXcmLocation,
                    toXcmLocation,
                    currentAmount,
                    true
                );

                console.log(`Quote result (planck): ${quote?.toString()}` + " " + fromAsset.metadata.symbol + " → " + toAsset.metadata.symbol);

                if (!quote) {
                    console.error(`No quote available for ${fromAsset.metadata.symbol} → ${toAsset.metadata.symbol}`);
                    return null;
                }

                const formattedAmountIn = formatAmount(currentAmount.toString(), fromAsset.metadata.decimals, NUMBER_FORMAT_OPTIONS);
                const formattedAmountOut = formatAmount(quote.toString(), toAsset.metadata.decimals, NUMBER_FORMAT_OPTIONS);

                if (!formattedAmountIn || !formattedAmountOut) {
                    console.error('Error formatting amounts for hop');
                    return null;
                }

                hops.push({
                    from: path[i],
                    to: path[i + 1],
                    amountIn: formattedAmountIn.decimal,
                    amountOut: formattedAmountOut.decimal
                });

                // update the current amount to the quote for next hop
                currentAmount = quote;
            }

            // Get final asset for decimals calculation
            const finalAsset = pathAssets[pathAssets.length - 1]!;

            const finalAmount = formatAmount(currentAmount.toString(), finalAsset.metadata.decimals, NUMBER_FORMAT_OPTIONS);
            if (!finalAmount) {
                console.error('Error formatting final amount');
                return null;
            }

            return {
                path,
                expectedOutput: finalAmount,
                hops,
                dex: NETWORKS_SUPPORTED.ASSET_HUB
            };

        } catch (error) {
            console.error('Error calculating path quote:', error);
            return null;
        }
    }
}

