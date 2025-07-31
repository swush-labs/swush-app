import { FetchAssetService } from './assets/FetchAssetService';
import { Asset } from './assets/types';
import { ConnectionManager } from './network/ConnectionManager';
import { TradeRouterService } from './assets/router/TradeRouterService';

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

        // Step 2: Initialize Asset Service (which will fetch assets and set up caches)
        console.log('Initializing asset service...');
        try {
            await FetchAssetService.getInstance().initialize();
            console.log('Asset service initialized successfully');
        } catch (error) {
            console.warn('⚠️ Asset service initialization failed:', error instanceof Error ? error.message : error);
            // Don't throw - the server can still run with basic functionality
        }

        // Step 3: Initialize TradeRouter (self-contained, no asset dependency)
        console.log('Initializing trade router...');
        try {
            await TradeRouterService.getInstance().initialize();
            console.log('TradeRouter initialized successfully');
        } catch (error) {
            console.warn('⚠️ TradeRouter initialization failed, continuing without it:', error instanceof Error ? error.message : error);
            // Don't throw - continue with other services
        }

        isInitialized = true;
        console.log('SDK initialization completed (some services may have partial failures)');
    } catch (error) {
        console.error('❌ Critical SDK initialization failed:', error);
        // Still mark as initialized to prevent server crash
        isInitialized = true;
        console.log('⚠️ SDK marked as initialized despite failures - server will continue with limited functionality');
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
        try {
            await TradeRouterService.getInstance().cleanup();
        } catch (error) {
            console.warn('Error cleaning up TradeRouter:', error);
        }
        
        try {
            await ConnectionManager.getInstance().disconnect();
        } catch (error) {
            console.warn('Error disconnecting ConnectionManager:', error);
        }
        
        isInitialized = false;
        console.log('SDK cleanup complete');
    } catch (error) {
        console.error('SDK cleanup failed:', error);
        // Force reset
        isInitialized = false;
    }
}

export async function getAssets(forceRefresh = false): Promise<Map<string, Asset>> {
    if (!isInitialized) {
        throw new Error('SDK not initialized. Call initializeSDK() first');
    }
    return await FetchAssetService.getInstance().getAssets(forceRefresh);
}

export * from './assets/types';
export * from './assets/utils';

export * from './constants';
