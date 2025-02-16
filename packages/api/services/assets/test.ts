//main function to test the asset service

import { AssetService } from './AssetService';
import { initializeSDK } from '../index';
import fs from 'fs';
import path from 'path';
import { ConnectionManager } from '../network/ConnectionManager';
import { AssetHubRouter } from './AssetHubRouter';
import { Asset } from './types';
import { saveAssetsToFile } from '../utils';
import { CACHE_KEYS } from '../constants';
import { CacheService } from '../cache/CacheService';
import { TokenGraph } from './TokenGraph';
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

        // Get cached router or create new one
        const tokenGraph = cacheManager.get<TokenGraph>(CACHE_KEYS.TOKEN_GRAPH);
        const router = AssetHubRouter.fromCachedGraph(api, assets, tokenGraph);

        // Helper function to find asset by symbol
        const findAssetBySymbol = (symbol: string): [string, Asset] | undefined => {
            return Array.from(assets.entries()).find(([_, asset]) => 
                asset.metadata.symbol.toLowerCase() === symbol.toLowerCase()
            );
        };

        // Find actual assets for testing
        //TODO: add DOT to the list of assets
        const dotAsset = findAssetBySymbol('DOT');
        const usdcAsset = findAssetBySymbol('USDC');
        const mythAsset = findAssetBySymbol('MYTH');

        if (!dotAsset || !usdcAsset || !mythAsset) {
            //saveAssetsToFile(assets, 'assetList.json');
            throw new Error('Could not find required test assets');
        }

        // Test cases using actual asset IDs
        const testCases = [
            {
                from: dotAsset[0],
                to: usdcAsset[0],
                fromSymbol: dotAsset[1].metadata.symbol,
                toSymbol: usdcAsset[1].metadata.symbol,
                amount: BigInt(1) * BigInt(10 ** dotAsset[1].metadata.decimals), // 1 DOT
                decimals: dotAsset[1].metadata.decimals
            },
            {
                from: usdcAsset[0],
                to: mythAsset[0],
                fromSymbol: usdcAsset[1].metadata.symbol,
                toSymbol: mythAsset[1].metadata.symbol,
                amount: BigInt(1) * BigInt(10 ** usdcAsset[1].metadata.decimals), // 1 USDC
                decimals: usdcAsset[1].metadata.decimals
            }
        ];

        console.log('\n=== Testing Asset Hub Router Quotes ===\n');

        for (const test of testCases) {
            console.log(`Finding route for 1 ${test.fromSymbol} to ${test.toSymbol}...`);
            console.log(`Amount In: ${test.amount} (${test.decimals} decimals)`);
            
            const route = await router.findBestRoute(
                test.from,
                test.to,
                test.amount
            );

            if (route) {
                console.log('\nRoute found:');
                console.log('Path:', route.path.map(id => {
                    const asset = assets.get(id);
                    return asset ? asset.metadata.symbol : id;
                }).join(' -> '));
                
                console.log('Expected Output:', route.expectedOutput.toString());
                
                // console.log('\nHops:');
                // for (const hop of route.hops) {
                //     const fromAsset = assets.get(hop.from);
                //     const toAsset = assets.get(hop.to);
                    
                //     console.log(`\nFrom ${fromAsset?.metadata.symbol || hop.from} to ${toAsset?.metadata.symbol || hop.to}:`);
                //     console.log('Amount In:', formatAmount(hop.amountIn, fromAsset?.metadata.decimals));
                //     console.log('Amount Out:', formatAmount(hop.amountOut, toAsset?.metadata.decimals));
                // }
            } else {
                console.log('No route found!');
            }
            console.log('\n-------------------\n');
        }

    } catch (error) {
        console.error('Error testing Asset Hub quotes:', error);
    }
}

// Helper function to format amounts with decimals
function formatAmount(amount: bigint, decimals: number = 0): string {
    const strAmount = amount.toString();
    if (decimals === 0) return strAmount;
    
    const integerPart = strAmount.slice(0, -decimals) || '0';
    const decimalPart = strAmount.slice(-decimals).padStart(decimals, '0');
    
    return `${integerPart}.${decimalPart}`;
}

// Main function to test the asset service
async function main() {
    try {
        await initializeSDK();
        // Test router quotes
        await testAssetHubQuotes();

    } catch (error) {
        console.error('Error in main:', error);
    }
}

main();