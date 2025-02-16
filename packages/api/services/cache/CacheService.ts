import { CACHE_KEYS } from '../constants';

export class CacheService {
    private static instance: CacheService;
    private cache: Map<string, any> = new Map();
    private refreshCallbacks: Map<string, () => Promise<void>> = new Map();
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private initialized: boolean = false;

    private constructor() {}

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public get<T>(key: string): T | undefined {
        return this.cache.get(key) as T;
    }

    public set<T>(key: string, value: T): void {
        this.cache.set(key, value);
    }

    public registerRefreshCallback(key: string, callback: () => Promise<void>, interval: number): void {
        this.refreshCallbacks.set(key, callback);
        this.startRefresh(key, interval);
    }

    private startRefresh(key: string, interval: number): void {
        const callback = this.refreshCallbacks.get(key);
        if (!callback) return;

        const timer = setInterval(async () => {
            try {
                await callback();
            } catch (error) {
                console.error(`Error refreshing cache for ${key}:`, error);
            }
        }, interval) as NodeJS.Timeout;

        this.intervals.set(key, timer);
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // Wait for all registered callbacks to complete their first run
        const initPromises = Array.from(this.refreshCallbacks.entries()).map(
            async ([key, callback]) => {
                try {
                    await callback();
                    console.log(`Cache initialized for ${key}`);
                } catch (error) {
                    console.error(`Failed to initialize cache for ${key}:`, error);
                    throw error;
                }
            }
        );

        await Promise.all(initPromises);
        this.initialized = true;
    }

    public stopRefresh(key: string): void {
        const timer = this.intervals.get(key);
        if (timer) {
            clearInterval(timer);
            this.intervals.delete(key);
        }
    }

    public stopAllRefresh(): void {
        this.intervals.forEach((timer) => {
            clearInterval(timer);
        });
        this.intervals.clear();
        console.log('All cache refresh intervals stopped');
    }

    public clear(): void {
        this.cache.clear();
        console.log('All caches cleared');
    }
} 