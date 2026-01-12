import express from 'express';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { webhookHandler } from './webhook';
import { getClientIp } from './utils/security';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for IP restriction (disabled - all IPs are now accepted)
const ipRestrictionMiddleware = async (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
) => {
  // IP validation is disabled - all incoming requests are accepted
  const clientIp = getClientIp(req);
  logger.debug('Webhook request received', {
    clientIp,
    ipValidation: 'disabled',
  });
  next();
};

// Middleware for parsing JSON and raw body for webhook verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// Rate limiter for webhook endpoint
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: 'Too many webhook requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'CiKnight',
    version: '1.0.0',
    status: 'running',
    description: 'GitHub App for resolving merge conflicts and fixing CI failures',
  });
});

// Enhanced health check endpoint
app.get('/healthz', (_req, res) => {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    configuration: {
      webhookSecretConfigured: !!webhookSecret,
      appIdConfigured: !!appId,
      privateKeyConfigured: !!privateKey,
      debugMode: logger.isDebugEnabled(),
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  };

  // Check if critical configuration is missing
  if (!webhookSecret) {
    logger.warn('Health check failed: webhook secret not configured');
    return res.status(503).json({
      ...health,
      status: 'unhealthy',
      error: 'GITHUB_WEBHOOK_SECRET is not configured',
      suggestion: 'Set GITHUB_WEBHOOK_SECRET environment variable',
    });
  }

  logger.debug('Health check passed', health.configuration);
  return res.status(200).json(health);
});

// Compatibility endpoint (same as /healthz)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// GitHub webhook endpoint with rate limiting and IP restriction
app.post('/webhook', webhookLimiter, ipRestrictionMiddleware, webhookHandler);

// Start the server
app.listen(PORT, () => {
  logger.info('CiKnight started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    ipRestriction: 'disabled',
    debugMode: logger.isDebugEnabled(),
    webhookSecretConfigured: !!process.env.GITHUB_WEBHOOK_SECRET,
  });
  logger.info('Endpoints available', {
    webhook: `/webhook`,
    health: `/health`,
    healthz: `/healthz`,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

export default app;
