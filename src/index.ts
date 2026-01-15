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

// Track active resources for cleanup
const activeResources = new Set<string>();

// Add a resource to track
export function trackResource(resourceId: string): void {
  activeResources.add(resourceId);
  console.log(`📌 Resource tracked: ${resourceId}`);
}

// Remove a tracked resource
export function untrackResource(resourceId: string): void {
  activeResources.delete(resourceId);
  console.log(`✅ Resource cleaned: ${resourceId}`);
}

// Cleanup all tracked resources
async function cleanupResources(): Promise<void> {
  if (activeResources.size > 0) {
    console.log(`🧹 Cleaning up ${activeResources.size} active resources...`);
    // In a real scenario, this would cleanup database connections, file handles, etc.
    activeResources.clear();
    console.log('✅ All resources cleaned up');
  }
}

// Start the server and capture reference
const server = app.listen(PORT, () => {
  console.log(`🚀 CiKnight is running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check endpoint: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 IP Restriction: DISABLED (all IPs accepted)`);
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`📡 ${signal} signal received: initiating graceful shutdown`);

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      console.error('❌ Error closing server:', err);
      process.exit(1);
    }

    console.log('✅ Server closed - no longer accepting new connections');

    // Cleanup resources
    try {
      await cleanupResources();
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    console.error('⚠️  Forceful shutdown after timeout');
    process.exit(1);
  }, 10000); // 10 second timeout
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export server for testing
export { server };
export default app;
