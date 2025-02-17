import { TypedApi } from 'polkadot-api';
import { polkadot_asset_hub } from '@polkadot-api/descriptors';
import { TokenGraph, Node } from './TokenGraph';
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
            // Get both nodes upfront
            const fromNode = this.tokenGraph.getNode(fromAsset.id);
            const toNode = this.tokenGraph.getNode(toAsset.id);

            if (!fromNode || !toNode) {
                console.error(`Asset nodes not found: ${fromAsset.id} or ${toAsset.id}`);
                return null;
            }

            // Convert amount to planck (base units) for Asset Hub
            const amountInPlanck = amountIn * BigInt(10 ** fromNode.asset.metadata.decimals);

            // Get quotes from both DEXes in parallel
            const [assetHubQuote, hydraDxQuote] = await Promise.all([
                this.getBestAssetHubQuote(fromNode, toNode, amountInPlanck),
                this.getHydraDxQuote(fromNode, toNode, amountIn)
            ]);

            if (!assetHubQuote && !hydraDxQuote) return null;
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

    public async getHydraDxQuote(
        fromNode: Node,
        toNode: Node,
        amountIn: bigint
    ): Promise<RouteQuote | null> {
        try {
            if (!fromNode.asset.hydradx || !toNode.asset.hydradx) {
                return null;
            }

            const tradeRouter = TradeRouterService.getInstance().getTradeRouter();
            const trade = await tradeRouter.getBestSell(
                fromNode.asset.hydradx.assetId,
                toNode.asset.hydradx.assetId,
                amountIn.toString()
            );

            if (!trade) return null;

            return {
                path: [fromNode.assetId, toNode.assetId],
                expectedOutput: BigInt(trade.amountOut.toString()),
                hops: [{
                    from: fromNode.assetId,
                    to: toNode.assetId,
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
        fromNode: Node,
        toNode: Node,
        amountInPlanck: bigint
    ): Promise<RouteQuote | null> {
        try {
            const paths = this.tokenGraph.findAllPaths(fromNode.assetId, toNode.assetId, 3, 'assetHub');
            if (paths.length === 0) return null;

            const pathQuotes = await Promise.all(
                paths.map(path => this.calculatePathQuote(path, amountInPlanck))
            );

            const validQuotes = pathQuotes.filter((quote): quote is RouteQuote => quote !== null);
            if (validQuotes.length === 0) return null;

            return validQuotes.reduce((best, current) =>
                current.expectedOutput > best.expectedOutput ? current : best
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

            // Pre-fetch all nodes for the path
            const pathNodes = path.map(id => this.tokenGraph.getNode(id));
            if (pathNodes.some(node => !node)) {
                console.error('One or more nodes not found in path');
                return null;
            }

            // Calculate quotes for each hop
            for (let i = 0; i < path.length - 1; i++) {
                const fromNode = pathNodes[i]!;
                const toNode = pathNodes[i + 1]!;

                const quote = await this.api.apis.AssetConversionApi.quote_price_exact_tokens_for_tokens(
                    fromNode.asset.xcmLocation,
                    toNode.asset.xcmLocation,
                    currentAmount,
                    true
                );

                if (!quote) {
                    console.error(`No quote available for hop ${fromNode.assetId} to ${toNode.assetId}`);
                    return null;
                }

                hops.push({
                    from: fromNode.assetId,
                    to: toNode.assetId,
                    amountIn: currentAmount,
                    amountOut: quote
                });

                currentAmount = quote;
            }

            // Get final node for decimals calculation (already fetched in pathNodes)
            const finalNode = pathNodes[pathNodes.length - 1]!;
            const finalAmount = currentAmount / BigInt(10 ** finalNode.asset.metadata.decimals);
            
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