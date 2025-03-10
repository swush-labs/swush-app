import express, { Request, Response } from 'express';
import { z } from 'zod';
import { BalanceService } from '../../services/balances/BalanceService';

const router = express.Router();

// Validation schemas
const balanceParamsSchema = z.object({
    address: z.string().regex(/^[0-9a-zA-Z]{47,48}$/, 'Invalid address format'),
    assetId: z.string()
});

const batchBalanceRequestSchema = z.object({
    requests: z.array(z.object({
        address: z.string().regex(/^[0-9a-zA-Z]{47,48}$/, 'Invalid address format'),
        assetId: z.string()
    })).min(1).max(50) // Limit batch size
});

// GET /api/v1/balances/:address/:assetId
router.get('/:address/:assetId', async (req: Request, res: Response) => {
    try {
        // Validate parameters
        const { address, assetId } = balanceParamsSchema.parse(req.params);

        // Get balance
        const balanceService = BalanceService.getInstance();
        const balance = await balanceService.getBalance({ address, assetId });

        res.json({
            status: 'success',
            data: balance
        });
    } catch (error: unknown) {
        console.error('Error fetching balance:', error);
        
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid parameters',
                errors: error.errors
            });
        }

        // Handle specific error cases
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        if (errorMessage.includes('not found') || errorMessage.includes('Invalid')) {
            return res.status(400).json({
                status: 'error',
                message: errorMessage
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch balance'
        });
    }
});

// POST /api/v1/balances/batch
router.post('/batch', async (req: Request, res: Response) => {
    try {
        // Validate batch request body
        const { requests } = batchBalanceRequestSchema.parse(req.body);

        // Get balance service
        const balanceService = BalanceService.getInstance();

        // Process all requests in parallel with error handling for each
        const results = await Promise.all(
            requests.map(async (request) => {
                try {
                    const balance = await balanceService.getBalance(request);
                    return {
                        status: 'success',
                        request,
                        data: balance
                    };
                } catch (error) {
                    return {
                        status: 'error',
                        request,
                        error: error instanceof Error ? error.message : 'Failed to fetch balance'
                    };
                }
            })
        );

        // Return all results, including any individual failures
        res.json({
            status: 'success',
            data: results
        });
    } catch (error: unknown) {
        console.error('Error processing batch balance request:', error);
        
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid request body',
                errors: error.errors
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to process batch request'
        });
    }
});

export const balancesRouter = router; 