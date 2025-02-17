//main function to test the asset service

import { AssetService } from './AssetService';
import { initializeSDK } from '../index';
import { ConnectionManager } from '../network/ConnectionManager';
import { AssetHubRouter } from './router/AssetHubRouter';
import { CACHE_KEYS } from '../constants';
import { CacheService } from '../cache/CacheService';
import { TokenGraph } from './router/TokenGraph';
import { Asset } from './types';
import { TradeRouterService } from '../network/TradeRouterService';
// await CacheService.getInstance().initializeAllCaches();
// const assetService = AssetService.getInstance();
// await assetService.getAssets();

// add main function        
async function testAssetHubQuotes() {
    try {
        // Get required services
        const assetService = AssetService.getInstance();
        const connectionManager = ConnectionManager.getInstance();
        const cacheManager = CacheService.getInstance();

        // Get assets and API
        const assets = await assetService.getAssets();
        const api = connectionManager.getAssetHubApi();
        if (!api) throw new Error('Asset Hub API not initialized');

        // Get cached token graph
        const tokenGraph = cacheManager.get<TokenGraph>(CACHE_KEYS.TOKEN_GRAPH);
        if (!tokenGraph) throw new Error('Token graph not initialized');
        
        const router = new AssetHubRouter(api, tokenGraph);

        // Helper function to find asset by symbol
        const findAssetBySymbol = (symbol: string): [string, Asset] | undefined => {
            return Array.from(assets.entries()).find(([_, asset]) => 
                asset.metadata.symbol.toLowerCase() === symbol.toLowerCase()
            );
        };

        // Find actual assets for testing
        const dotAsset = findAssetBySymbol('DOT');
        const usdcAsset = findAssetBySymbol('USDC');
        const mythAsset = findAssetBySymbol('MYTH');

        console.log('\n=== Testing Asset Hub Router Quotes ===\n');
        
            const route = await router.findBestRoute(
                { id: dotAsset?.[0] ?? '' },
                { id: mythAsset?.[0] ?? '' },
                BigInt(1)
            );

            if (route) {
                console.log('\nRoute found:');
                console.log('Path:', route.path.map(id => {
                    const asset = assets.get(id);
                    return asset ? asset.metadata.symbol : id;
                }).join(' -> '));
                
                console.log('Expected Output:', route.expectedOutput.toString());
                
                console.log('\nDEX Used:', route.dex);
            } else {
                console.log('No route found!');
            }
            console.log('\n-------------------\n');

            //print hydradx quote
            const tradeRouter = TradeRouterService.getInstance().getTradeRouter();
            //  tradeRouter.getBestSell with hydradx assetId
            const trade = await tradeRouter.getBestSell(
                "5",
                "30",
                "1"
            );

            console.log('HydraDx Quote:', trade?.toHuman());

    } catch (error) {
        console.error('Error testing Asset Hub quotes:', error);
    }
}


// Main function to test the asset service
async function main() {
    try {
        await initializeSDK();
        await testAssetHubQuotes();

    } catch (error) {
        console.error('Error in main:', error);
    }
}

main();