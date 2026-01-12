import express from 'express';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { webhookHandler } from './webhook';
import { getClientIp } from './utils/security';

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
  console.log(`📍 Webhook request from IP: ${clientIp} (validation disabled)`);
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

// Health check endpoint for Cloud Run
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Healthz endpoint with webhook secret validation
app.get('/healthz', (_req, res) => {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      webhookSecret: !!webhookSecret,
      appId: !!appId,
      privateKey: !!privateKey,
    },
  };

  // Return 503 if critical configuration is missing
  if (!webhookSecret || !appId || !privateKey) {
    res.status(503).json({
      ...checks,
      status: 'unhealthy',
      message: 'Missing required configuration',
    });
    return;
  }

  res.status(200).json(checks);
});

// GitHub webhook endpoint with rate limiting and IP restriction
app.post('/webhook', webhookLimiter, ipRestrictionMiddleware, webhookHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 CiKnight is running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check endpoint: http://localhost:${PORT}/health`);
  console.log(`🏥 Healthz endpoint: http://localhost:${PORT}/healthz`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 IP Restriction: DISABLED (all IPs accepted)`);
  console.log(
    `🔍 Webhook Debug Mode: ${process.env.WEBHOOK_DEBUG === 'true' ? 'ENABLED' : 'DISABLED'}`
  );
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

export default app;
