import express, { Request, Response } from 'express';
import { z } from 'zod';
import { Asset, getAssets } from '../../services';
import { safeStringify } from '../../services/assets/utils';
import { AssetHubRouter } from '../../services/assets/router/AssetHubRouter';
import { CacheService } from '../../services/cache/CacheService';
import { ConnectionManager } from '../../services/network/ConnectionManager';
import { CACHE_KEYS } from '../../services/constants';
import { TokenGraph } from '../../services/assets/router/TokenGraph';

const router = express.Router();

// Validation schema for the request body
// const findRouteSchema = z.object({
//     fromAsset: z.object({
//         id: z.string()
//     }),
//     toAsset: z.object({
//         id: z.string()
//     }),
//     amountIn: z.string()
// });

// GET /api/v1/assets
router.get('/', async (req: Request, res: Response) => {
  try {
    const assets: Map<string, Asset> = await getAssets();
    
    // Convert Map to array and serialize using safeStringify
    const assetsArray = Array.from(assets.entries()).map(([id, asset]) => ({
      id,
      ...JSON.parse(safeStringify(asset))  // Use safeStringify consistently
    }));

    res.json({
      status: 'success',
      data: assetsArray
    });
  } catch (error: unknown) {
    console.error('Error fetching assets:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid query parameters',
        errors: error.errors
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch assets'
    });
  }
});

// POST /api/v1/assets/find-route
router.post('/find-route', async (req: Request, res: Response) => {
    try {
        // Validate request body
        const { fromAsset, toAsset, amountIn, dex } = req.body;

        // Get cached token graph
        const tokenGraph = CacheService.getInstance().get<TokenGraph>(CACHE_KEYS.TOKEN_GRAPH);
        if (!tokenGraph) {
            throw new Error('Token graph not initialized');
        }

        // Get API instance
        const api = ConnectionManager.getInstance().getAssetHubApi();
        if (!api) {
            throw new Error('Asset Hub API not initialized');
        }

        // Create router instance with cached graph
        const router = new AssetHubRouter(api, tokenGraph);
        
        // Find best route
        const route = await router.findBestRoute(
            fromAsset,
            toAsset,
            amountIn,
            dex
        );

        if (!route) {
            return res.status(404).json({
                status: 'error',
                message: 'No route found'
            });
        }

        // CHANGED: Use safeStringify instead of serializeKey for consistency
        res.json({
            status: 'success',
            data: JSON.parse(safeStringify(route))
        });
    } catch (error: unknown) {
        console.error('Error finding route:', error);
        
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid request body',
                errors: error.errors
            });
        }

        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to find route'
        });
    }
});

export const assetsRouter = router; 
