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

// GitHub webhook endpoint with rate limiting and IP restriction
app.post('/webhook', webhookLimiter, ipRestrictionMiddleware, webhookHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 CiKnight is running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check endpoint: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 IP Restriction: DISABLED (all IPs accepted)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

export default app;
