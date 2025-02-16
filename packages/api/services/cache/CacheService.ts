import CacheManager from './CacheManager';
import { AssetService } from '../assets/AssetService';
import { CACHE_KEYS } from '../constants';

export class CacheService {
    private static instance: CacheService;
    private intervals: { [key: string]: NodeJS.Timer } = {};
    private cacheManager: CacheManager;
    private assetService: AssetService;

    // Cache refresh intervals in milliseconds
    private static REFRESH_INTERVALS = {
        ASSETS: 30 * 60 * 1000  // 30 minutes
    };

    private constructor() {
        this.cacheManager = CacheManager.getInstance();
        this.assetService = AssetService.getInstance();
    }

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    public get<T>(key: string): T | undefined {
        return this.cacheManager.get<T>(key);
    }

    public set<T>(key: string, value: T): void {
        this.cacheManager.set(key, value);
    }

    private async refreshAssetCache(): Promise<void> {
        try {
            await this.assetService.getAssets(true);
            console.log('Assets cache refreshed');
        } catch (error) {
            console.error('Failed to refresh Assets cache:', error);
            throw error;
        }
    }

    private startCacheRefresh(): void {
        // Start Assets refresh
        this.intervals['ASSETS'] = setInterval(
            () => this.refreshAssetCache().catch(error => {
                console.error('Error in refresh interval:', error);
            }),
            CacheService.REFRESH_INTERVALS.ASSETS
        );
    }

    public stopCacheRefresh(): void {
        Object.values(this.intervals).forEach(interval => {
            if (interval) {
                clearInterval(interval as NodeJS.Timeout);
            }
        });
        this.intervals = {};
        console.log('All cache refresh intervals stopped');
    }

    public async initializeAllCaches(): Promise<void> {
        try {
            console.log('Initializing all caches...');
            
            // Initialize asset cache
            await this.refreshAssetCache();
            
            console.log('All caches initialized');
            this.startCacheRefresh();
        } catch (error) {
            console.error('Failed to initialize caches:', error);
            this.stopCacheRefresh();
            throw error;
        }
    }

    public clearAllCaches(): void {
        this.cacheManager.clear();
        console.log('All caches cleared');
    }
} 