import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { CacheService } from '../CacheService';

describe('CacheService', () => {
    let cacheService: CacheService;

    beforeEach(() => {
        // Reset the singleton instance before each test
        // @ts-expect-error - accessing private static for testing
        CacheService['instance'] = undefined;
        cacheService = CacheService.getInstance();
        
        // Mock timers
        jest.useFakeTimers();
    });

    afterEach(() => {
        // Clean up after each test
        cacheService.stopAllRefresh();
        cacheService.clear();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe('Singleton Pattern', () => {
        test('should create only one instance', () => {
            const instance1 = CacheService.getInstance();
            const instance2 = CacheService.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('Basic Cache Operations', () => {
        test('should set and get values correctly', () => {
            cacheService.set('key1', 'value1');
            cacheService.set('key2', { complex: 'object' });

            expect(cacheService.get('key1')).toBe('value1');
            expect(cacheService.get('key2')).toEqual({ complex: 'object' });
        });

        test('should return undefined for non-existent keys', () => {
            expect(cacheService.get('nonexistent')).toBeUndefined();
        });

        test('should clear all values', () => {
            cacheService.set('key1', 'value1');
            cacheService.set('key2', 'value2');
            cacheService.clear();

            expect(cacheService.get('key1')).toBeUndefined();
            expect(cacheService.get('key2')).toBeUndefined();
        });
    });

    describe('Refresh Callbacks', () => {
        test('should register and execute refresh callbacks', async () => {
            const mockCallback = jest.fn<() => Promise<void>>().mockImplementation(async () => {});
            cacheService.registerRefreshCallback('test', mockCallback, 1000);

            // Fast-forward time
            jest.advanceTimersByTime(2500);

            expect(mockCallback).toHaveBeenCalledTimes(2);
        });

        test('should handle failed refresh callbacks', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const mockCallback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
                throw new Error('Refresh failed');
            });
            
            cacheService.registerRefreshCallback('test', mockCallback, 1000);
            
            // Wait for the timer to trigger
            await jest.advanceTimersByTimeAsync(1000);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error refreshing cache for test'),
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });

        test('should stop specific refresh interval', () => {
            const mockCallback = jest.fn<() => Promise<void>>().mockImplementation(async () => {});
            cacheService.registerRefreshCallback('test', mockCallback, 1000);
            
            jest.advanceTimersByTime(1000);
            expect(mockCallback).toHaveBeenCalledTimes(1);

            cacheService.stopRefresh('test');
            jest.advanceTimersByTime(2000);
            expect(mockCallback).toHaveBeenCalledTimes(1); // No additional calls
        });

        test('should stop all refresh intervals', () => {
            const mockCallback1 = jest.fn<() => Promise<void>>().mockImplementation(async () => {});
            const mockCallback2 = jest.fn<() => Promise<void>>().mockImplementation(async () => {});
            
            cacheService.registerRefreshCallback('test1', mockCallback1, 1000);
            cacheService.registerRefreshCallback('test2', mockCallback2, 1000);
            
            jest.advanceTimersByTime(1000);
            expect(mockCallback1).toHaveBeenCalledTimes(1);
            expect(mockCallback2).toHaveBeenCalledTimes(1);

            cacheService.stopAllRefresh();
            jest.advanceTimersByTime(2000);
            expect(mockCallback1).toHaveBeenCalledTimes(1);
            expect(mockCallback2).toHaveBeenCalledTimes(1);
        });
    });

    describe('Initialization', () => {
        test('should initialize all registered callbacks', async () => {
            const mockCallback1 = jest.fn<() => Promise<void>>().mockImplementation(async () => {});
            const mockCallback2 = jest.fn<() => Promise<void>>().mockImplementation(async () => {});
            
            cacheService.registerRefreshCallback('test1', mockCallback1, 1000);
            cacheService.registerRefreshCallback('test2', mockCallback2, 1000);
            
            await cacheService.initialize();

            expect(mockCallback1).toHaveBeenCalledTimes(1);
            expect(mockCallback2).toHaveBeenCalledTimes(1);
            expect(cacheService.isInitialized()).toBe(true);
        });

        test('should handle initialization failures', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const mockCallback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
                throw new Error('Init failed');
            });
            
            cacheService.registerRefreshCallback('test', mockCallback, 1000);
            
            await expect(cacheService.initialize()).rejects.toThrow('Init failed');
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to initialize cache for test'),
                expect.any(Error)
            );
            expect(cacheService.isInitialized()).toBe(false);
            
            consoleSpy.mockRestore();
        });

        test('should not reinitialize if already initialized', async () => {
            const mockCallback = jest.fn<() => Promise<void>>().mockImplementation(async () => {});
            cacheService.registerRefreshCallback('test', mockCallback, 1000);
            
            await cacheService.initialize();
            await cacheService.initialize(); // Second call

            expect(mockCallback).toHaveBeenCalledTimes(1);
        });
    });
}); 