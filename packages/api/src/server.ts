import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { assetsRouter } from './routes/assets';
import { balancesRouter } from './routes/balances';
import { initializeSDK } from '../services';

const app = express();
const port = process.env.PORT || 3001;
const use_https = process.env.NEXT_PUBLIC_USE_HTTPS ? true : false;

// Middleware
app.use(helmet({
  // Trust proxy headers from nginx
  ...(process.env.TRUST_PROXY === 'true' && {
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  })
}));

app.use(cors());
app.use(express.json());

// Trust nginx proxy for real IP addresses
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    protocol: req.protocol,
    secure: req.secure,
    forwarded: req.get('X-Forwarded-Proto') || 'none',
    host: req.get('Host'),
    userAgent: req.get('User-Agent')
  });
});

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

// Start HTTP server (nginx handles HTTPS)
const server = app.listen(port, () => {
  console.log(`🌐 HTTP Server running on port ${port}`);
  if (use_https) {
    console.log(`📍 Development: https://localhost:${port}`);
    console.log(`📍 Health check: https://localhost:${port}/health`);
  } else {
    console.log(`📍 Production: Running behind nginx proxy`);
    console.log(`📍 Health check: http://localhost:${port}/health`);
  }
});

// Initialize SDK after server starts
(async () => {
  try {
    await initializeSDK();
    console.log('✅ SDK initialized successfully 🚀');
  } catch (error) {
    console.error('❌ Failed to initialize SDK:', error); 
    console.log('⚠️ Server will continue running with limited functionality');
    // Don't exit - let the server run even if SDK fails
  }
})(); 