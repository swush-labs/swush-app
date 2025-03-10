import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { assetsRouter } from './routes/assets';
import { balancesRouter } from './routes/balances';
import { initializeSDK } from '../services';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize SDK
(async () => {
  try {
    await initializeSDK();
    console.log('SDK initialized successfully');
  } catch (error) {
    console.error('Failed to initialize SDK:', error);
    process.exit(1);
  }
})();

// Routes
app.use('/api/v1/assets', assetsRouter);
app.use('/api/v1/balances', balancesRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 