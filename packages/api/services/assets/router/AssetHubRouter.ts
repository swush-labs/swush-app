import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { TokenGraph } from './TokenGraph';
import { XcmV4Location } from '../types';
import { TradeRouterService } from '../../network/TradeRouterService';

// Simplified to just contain the asset ID
export interface RouterAsset {
    id: string;
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

    private async getHydraDxQuote(
        fromAsset: RouterAsset,
        toAsset: RouterAsset,
        amountIn: bigint
    ): Promise<RouteQuote | null> {
        try {
            // Get complete asset info from graph
            const fromNode = this.tokenGraph.getNode(fromAsset.id);
            const toNode = this.tokenGraph.getNode(toAsset.id);

            if (!fromNode?.asset.hydradx || !toNode?.asset.hydradx) {
                return null;
            }

            const tradeRouter = TradeRouterService.getInstance().getTradeRouter();
            const trade = await tradeRouter.getBestSell(
                fromNode.asset.hydradx.assetId,
                toNode.asset.hydradx.assetId,
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

    private async calculatePathQuote(
        path: string[],
        fromAsset: RouterAsset,
        toAsset: RouterAsset,
        amountIn: bigint
    ): Promise<RouteQuote | null> {
        try {
            const hops: RouteQuote['hops'] = [];
            let currentAmount = amountIn;

            // Handle multi-hop paths
            for (let i = 0; i < path.length - 1; i++) {
                const fromId = path[i];
                const toId = path[i + 1];

                // Get node information from the graph
                const fromNode = this.tokenGraph.getNode(fromId);
                const toNode = this.tokenGraph.getNode(toId);

                if (!fromNode || !toNode) {
                    console.error(`Node not found for ${fromId} or ${toId}`);
                    return null;
                }

                // Calculate quote for this hop
                const quote = await this.api.apis.AssetConversionApi.quote_price_exact_tokens_for_tokens(
                    fromNode.asset.xcmLocation,
                    toNode.asset.xcmLocation,
                    currentAmount,
                    true // include_fee parameter
                );

                if (!quote) {
                    console.error(`No quote available for hop ${fromId} to ${toId}`);
                    return null;
                }

                hops.push({
                    from: fromId,
                    to: toId,
                    amountIn: currentAmount,
                    amountOut: quote
                });

                // Update current amount for next hop
                currentAmount = quote;
            }

            // Get final asset info for decimals calculation
            const toNode = this.tokenGraph.getNode(toAsset.id);
            if (!toNode) {
                console.error(`Final asset node not found: ${toAsset.id}`);
                return null;
            }

            // Calculate final amount considering the last asset's decimals
            const finalAmount = currentAmount / BigInt(10 ** toNode.asset.metadata.decimals);
            
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
    
}