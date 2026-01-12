import express from 'express';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { webhookHandler } from './webhook';
import { getClientIp, isValidGitHubIp } from './utils/security';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for IP restriction (optional, controlled by environment variable)
const ipRestrictionMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // Parse boolean environment variable
  // Treats 'false', '0', 'no', 'off' as disabled; anything else (including undefined) as enabled
  const envValue = process.env.WEBHOOK_IP_RESTRICTION_ENABLED?.toLowerCase();
  const enableIpRestriction = !['false', '0', 'no', 'off'].includes(envValue || '');

  if (!enableIpRestriction) {
    return next();
  }

  try {
    const clientIp = getClientIp(req);
    console.log(`📍 Webhook request from IP: ${clientIp}`);

    const isValid = await isValidGitHubIp(clientIp);
    if (!isValid) {
      console.log(`🚫 Rejected webhook from unauthorized IP: ${clientIp}`);
      return res.status(403).json({ error: 'Forbidden: IP not in GitHub webhook ranges' });
    }

    console.log(`✅ Webhook from authorized GitHub IP: ${clientIp}`);
    next();
  } catch (error) {
    console.error('❌ Error checking IP restriction:', error);
    // Fail based on configuration
    const failOpen = process.env.WEBHOOK_IP_FAIL_OPEN === 'true';
    if (failOpen) {
      console.log('⚠️  IP restriction check failed, allowing request (fail-open mode)');
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  }
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

// GitHub webhook endpoint with rate limiting and IP restriction
app.post('/webhook', webhookLimiter, ipRestrictionMiddleware, webhookHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 CiKnight is running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check endpoint: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  const ipRestrictionEnabled = process.env.WEBHOOK_IP_RESTRICTION_ENABLED !== 'false';
  console.log(`🔒 IP Restriction: ${ipRestrictionEnabled ? 'ENABLED' : 'DISABLED'}`);

  if (ipRestrictionEnabled) {
    const failOpen = process.env.WEBHOOK_IP_FAIL_OPEN === 'true';
    console.log(`⚡ IP Restriction Fail Mode: ${failOpen ? 'FAIL-OPEN' : 'FAIL-CLOSED'}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

export default app;
