import express, { Request, Response } from 'express';
import { z } from 'zod';
import { BalanceService } from '../../services/balances/BalanceService';

const router = express.Router();

// Validation schema for route parameters
const balanceParamsSchema = z.object({
    address: z.string().regex(/^[0-9a-zA-Z]{47,48}$/, 'Invalid address format'),
    assetId: z.string()
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

export const balancesRouter = router; 