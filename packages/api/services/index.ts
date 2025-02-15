import { AssetService } from './assets/AssetService';
import { Asset } from './assets/types';
import { CacheService } from './cache/CacheService';
import { ConnectionManager } from './network/ConnectionManager';
import { TradeRouterService } from './network/TradeRouterService';
import { base, degen } from './assets/external';

let isInitialized = false;

export async function initializeSDK(): Promise<void> {
    if (isInitialized) {
        console.log('SDK already initialized');
        return;
    }
    
    try {
        // Step 1: Initialize network connections
        console.log('Initializing network connections...');
        await ConnectionManager.getInstance().initialize();
        
        // Step 2: Initialize TradeRouter with external assets
        console.log('Initializing trade router...');
        const externalAssets = [...base, ...degen];
        await TradeRouterService.getInstance().initialize(externalAssets);
        
        // Step 3: Initialize caches
        console.log('Initializing caches...');
        await CacheService.getInstance().initializeAllCaches();
        
        isInitialized = true;
        console.log('SDK initialized successfully');
    } catch (error) {
        console.error('SDK initialization failed:', error);
        // Attempt cleanup on failure
        try {
            await cleanupSDK();
        } catch (cleanupError) {
            console.error('Cleanup after failed initialization failed:', cleanupError);
        }
        throw error;
    }
}

export async function cleanupSDK(): Promise<void> {
    if (!isInitialized) {
        console.log('SDK not initialized, nothing to clean up');
        return;
    }
    
    try {
        console.log('Starting SDK cleanup...');
        // Cleanup in reverse order of initialization
        CacheService.getInstance().stopCacheRefresh();
        TradeRouterService.getInstance().cleanup();
        await ConnectionManager.getInstance().disconnect();
        isInitialized = false;
        console.log('SDK cleanup complete');
    } catch (error) {
        console.error('SDK cleanup failed:', error);
        throw error;
    }
}

export async function getAssets(forceRefresh = false): Promise<Map<string, Asset>> {
    if (!isInitialized) {
        throw new Error('SDK not initialized. Call initializeSDK() first');
    }
    return await AssetService.getInstance().getAssets(forceRefresh);
}

export * from './assets/types';
export * from './assets/utils'; 