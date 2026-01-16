'use client';

/**
 * Lazy-loaded XCM Router functions to prevent WASM memory issues
 * 
 * By dynamically importing @paraspell/xcm-router only when needed,
 * we avoid initializing @polkadot/wasm-crypto during initial page load.
 * 
 * This prevents the "Out of memory: Cannot allocate Wasm memory" error
 * caused by multiple WASM instances being created simultaneously through
 * the @paraspell/xcm-router → @acala-network/sdk dependency chain.
 */

// Cached module reference to avoid multiple imports
let xcmRouterModule: typeof import('@paraspell/xcm-router') | null = null;
let xcmRouterImportPromise: Promise<typeof import('@paraspell/xcm-router')> | null = null;

/**
 * Get the xcm-router module (lazy loaded)
 * Uses caching to ensure we only import once
 */
export async function getXcmRouter() {
  if (!xcmRouterModule) {
    if (!xcmRouterImportPromise) {
      xcmRouterImportPromise = import('@paraspell/xcm-router');
    }
    xcmRouterModule = await xcmRouterImportPromise;
  }
  return xcmRouterModule;
}


/**
 * Lazy RouterBuilder
 * Returns the RouterBuilder function for creating routes
 * 
 * Usage:
 * const RouterBuilder = await getRouterBuilder();
 * const route = RouterBuilder({ abstractDecimals: true }).from(...).to(...)
 */
export async function getRouterBuilder() {
  const router = await getXcmRouter();
  return router.RouterBuilder;
}