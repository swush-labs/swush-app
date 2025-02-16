import { AssetService } from './assets/AssetService';
import { Asset } from './assets/types';
import { CacheService } from './cache/CacheService';
import { ConnectionManager } from './network/ConnectionManager';
import { TradeRouterService } from './network/TradeRouterService';
import { base, degen } from './assets/external';
import { CACHE_KEYS } from './constants';

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

        // Step 3: Initialize Asset Service (which will set up caches)
        console.log('Initializing asset service...');
        await AssetService.getInstance().initialize();

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
        await TradeRouterService.getInstance().cleanup();
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