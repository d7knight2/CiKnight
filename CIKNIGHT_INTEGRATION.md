# CiKnight Integration Guide

This guide provides comprehensive information on integrating CiKnight into your development workflow, including best practices, advanced configuration, and troubleshooting.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Integration Patterns](#integration-patterns)
3. [Best Practices](#best-practices)
4. [API Reference](#api-reference)
5. [Webhook Events](#webhook-events)
6. [Advanced Configuration](#advanced-configuration)
7. [Monitoring and Observability](#monitoring-and-observability)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting Guide](#troubleshooting-guide)

## Architecture Overview

CiKnight is built on a modern, scalable architecture:

```
┌─────────────┐
│   GitHub    │
│   Events    │
└──────┬──────┘
       │ Webhooks
       │
       ▼
┌─────────────────┐
│   Express.js    │◄──── Rate Limiting
│   Web Server    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Webhook Router │
└────────┬────────┘
         │
    ┌────┴────┬────────┬──────────┐
    │         │        │          │
    ▼         ▼        ▼          ▼
┌────────┐ ┌────┐ ┌────────┐ ┌────────┐
│   PR   │ │ CI │ │ Check  │ │Status  │
│Handler │ │Fix │ │ Suite  │ │Handler │
└────────┘ └────┘ └────────┘ └────────┘
    │         │        │          │
    └────────┬┴────────┴──────────┘
             │
             ▼
      ┌─────────────┐
      │  Octokit    │
      │  GitHub API │
      └─────────────┘
```

### Key Components

1. **Express.js Server**: Handles HTTP requests and webhooks
2. **Webhook Router**: Distributes events to appropriate handlers
3. **Event Handlers**: Process specific GitHub events (PR, CI, etc.)
4. **GitHub Client**: Interacts with GitHub API using Octokit
5. **Rate Limiter**: Protects against abuse and excessive requests

## Integration Patterns

### Pattern 1: Standalone Deployment

Deploy CiKnight as a standalone service on Google Cloud Run, AWS Lambda, or similar platforms.

**Pros**:
- Independent scaling
- Isolated resources
- Easy updates

**Cons**:
- Requires separate infrastructure
- Additional operational overhead

**Use Case**: Large organizations with multiple repositories

### Pattern 2: Integrated Deployment

Run CiKnight alongside your existing CI/CD infrastructure.

**Pros**:
- Shared infrastructure
- Simplified deployment
- Lower cost

**Cons**:
- Resource contention
- Coupled updates

**Use Case**: Small to medium teams with existing infrastructure

### Pattern 3: Multi-Instance Deployment

Deploy multiple CiKnight instances for different purposes or environments.

**Pros**:
- Environment isolation
- Flexible scaling
- Fault tolerance

**Cons**:
- Complex configuration
- Higher costs

**Use Case**: Enterprise organizations with strict compliance requirements

## Best Practices

### 1. Environment Configuration

**Development**:
```env
NODE_ENV=development
PORT=3000
# Use test credentials
GITHUB_APP_ID=test_app_id
GITHUB_WEBHOOK_SECRET=development_secret
```

**Production**:
```env
NODE_ENV=production
PORT=8080
# Use production credentials from secret manager
```

### 2. Secret Management

**Never** store secrets in code or `.env` files in production:

```bash
# Google Cloud Secret Manager
gcloud secrets create github-private-key --data-file=private-key.pem

# AWS Secrets Manager
aws secretsmanager create-secret \
  --name github-private-key \
  --secret-string file://private-key.pem

# Azure Key Vault
az keyvault secret set \
  --vault-name MyKeyVault \
  --name github-private-key \
  --file private-key.pem
```

### 3. Webhook Security

Always verify webhook signatures:

```typescript
// Built into CiKnight's webhook handler
const signature = req.headers['x-hub-signature-256'];
await webhooks.verifyAndReceive({
  id,
  name: event,
  signature,
  payload: rawBody,
});
```

### 4. Error Handling

Implement robust error handling:

```typescript
try {
  // Your code
} catch (error: any) {
  console.error('❌ Error:', error.message);
  // Don't throw - log and continue
  // Report to monitoring service
}
```

### 5. Rate Limiting

CiKnight includes built-in rate limiting:

```typescript
// 100 requests per minute per IP
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});
```

Adjust based on your needs:
- High-traffic repos: Increase limit
- Security-sensitive: Decrease limit
- Development: Disable or increase significantly

### 6. Logging Best Practices

Use structured logging for better debugging:

```typescript
// Good: Structured and searchable
console.log('🔍 Processing PR', {
  pr_number: prNumber,
  repo: `${owner}/${repo}`,
  action,
  timestamp: new Date().toISOString(),
});

// Avoid: Unstructured strings
console.log('Processing PR ' + prNumber);
```

### 7. Testing Strategy

Implement comprehensive testing:

1. **Unit Tests**: Test individual functions
   ```bash
   npm test
   ```

2. **Integration Tests**: Test API endpoints
   ```bash
   npm run test:e2e
   ```

3. **Manual Testing**: Use smee.io for webhook testing

4. **Load Testing**: Simulate high traffic
   ```bash
   # Example with Apache Bench
   ab -n 1000 -c 10 http://localhost:3000/health
   ```

## API Reference

### Endpoints

#### `GET /`
Returns service information and health status.

**Response**:
```json
{
  "name": "CiKnight",
  "version": "1.0.0",
  "status": "running",
  "description": "GitHub App for resolving merge conflicts and fixing CI failures"
}
```

#### `GET /health`
Health check endpoint for monitoring and load balancers.

**Response**:
```json
{
  "status": "healthy"
}
```

#### `POST /webhook`
Receives GitHub webhook events.

**Headers** (required):
- `x-hub-signature-256`: Webhook signature for verification
- `x-github-event`: Event type (e.g., "pull_request")
- `x-github-delivery`: Unique delivery ID

**Response**:
```json
{
  "message": "Webhook received"
}
```

### Testing API Endpoints

#### Using curl

```bash
# Health check
curl http://localhost:3000/health

# Service info
curl http://localhost:3000/

# Webhook (requires valid signature)
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=..." \
  -H "x-github-event: ping" \
  -H "x-github-delivery: test-123" \
  -d '{"zen":"Test webhook"}'
```

#### Using Playwright Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/api.test.ts
```

## Webhook Events

### Pull Request Events

CiKnight listens to these PR events:

#### `pull_request.opened`
Triggered when a PR is created.

**Actions**:
- Post welcome comment
- Check initial mergeable state
- Register for monitoring

#### `pull_request.synchronize`
Triggered when commits are pushed to the PR.

**Actions**:
- Re-check mergeable state
- Analyze new commits
- Update status

#### `pull_request.reopened`
Triggered when a closed PR is reopened.

**Actions**:
- Re-evaluate PR status
- Check for conflicts
- Resume monitoring

### Check Run Events

#### `check_run.completed`
Triggered when a CI check completes.

**Actions**:
- Analyze check result
- If failed, post diagnostic comment
- Attempt automatic fixes (planned)

### Check Suite Events

#### `check_suite.completed`
Triggered when all checks in a suite complete.

**Actions**:
- Evaluate overall PR health
- Update status comment

### Status Events

#### `status`
Triggered when commit status changes.

**Actions**:
- Track status changes
- Correlate with check runs

## Advanced Configuration

### Custom Event Handlers

Add custom handlers in `src/webhook.ts`:

```typescript
webhooks.on('issue_comment.created', async ({ payload }) => {
  if (payload.comment.body.includes('@ciknight')) {
    // Handle mentions
    await handleMention(payload);
  }
});
```

### Environment-Specific Configuration

Use different configurations per environment:

```typescript
const config = {
  development: {
    logLevel: 'debug',
    rateLimitMax: 1000,
  },
  production: {
    logLevel: 'info',
    rateLimitMax: 100,
  },
};

const env = process.env.NODE_ENV || 'development';
const activeConfig = config[env];
```

### Custom GitHub API Calls

Extend functionality with custom API calls:

```typescript
import { createGitHubClient } from './github/client';

const octokit = createGitHubClient(installationId);

// Get issue comments
const { data: comments } = await octokit.issues.listComments({
  owner,
  repo,
  issue_number: prNumber,
});

// Create a review
await octokit.pulls.createReview({
  owner,
  repo,
  pull_number: prNumber,
  event: 'COMMENT',
  body: 'CiKnight analysis complete',
});
```

## Monitoring and Observability

### Logging

CiKnight uses console logging with emojis for visual scanning:

```
🚀 CiKnight is running on port 3000
📬 Pull request opened: #42
🔍 Processing PR #42 in owner/repo (action: opened)
✅ PR #42 is in good state (clean)
⚠️  PR #42 has merge conflicts
❌ Error handling pull request: ...
```

### Metrics to Track

1. **Webhook Processing Time**: Time to process each webhook
2. **API Call Latency**: Time for GitHub API calls
3. **Success Rate**: Percentage of successfully processed events
4. **Error Rate**: Number of errors per minute
5. **Rate Limit Usage**: Remaining API calls

### Google Cloud Monitoring

For Cloud Run deployments:

```bash
# View logs
gcloud run logs read ciknight --region us-central1

# Stream logs
gcloud run logs tail ciknight --region us-central1

# View metrics
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

### Health Checks

Configure health checks for your deployment:

```yaml
# Kubernetes
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Security Considerations

### 1. Webhook Verification

Always verify webhook signatures to prevent spoofing:

```typescript
// CiKnight automatically verifies signatures
await webhooks.verifyAndReceive({ signature, payload });
```

### 2. Rate Limiting

Protect against abuse with rate limiting:

```typescript
const limiter = rateLimit({
  windowMs: 60000,  // 1 minute
  max: 100,         // 100 requests per window
  message: 'Too many requests',
});
```

### 3. Input Validation

Validate all inputs from webhooks:

```typescript
if (!signature || !event || !id) {
  return res.status(400).json({ error: 'Missing required headers' });
}
```

### 4. Least Privilege

Grant only necessary permissions to the GitHub App:

- ✅ Pull requests: Read & Write (required)
- ✅ Checks: Read & Write (required)
- ❌ Administration: Not needed
- ❌ Secrets: Not needed

### 5. Secret Rotation

Rotate secrets regularly:

```bash
# Generate new webhook secret
openssl rand -hex 20

# Update in GitHub App settings
# Update in your deployment environment
```

### 6. HTTPS Only

Always use HTTPS for webhook URLs:

```
✅ https://ciknight.example.com/webhook
❌ http://ciknight.example.com/webhook
```

## Troubleshooting Guide

### Node.js Dependency Issues

#### Problem: Package lock conflicts

```bash
# Solution 1: Clean install
rm -rf node_modules package-lock.json
npm install

# Solution 2: Use specific npm version
npm install -g npm@9
npm install

# Solution 3: Clear cache
npm cache clean --force
npm install
```

#### Problem: Version mismatch

```bash
# Check Node.js version
node --version  # Should be 18.x or higher

# Use nvm to switch versions
nvm install 18
nvm use 18
```

### Connectivity Testing

#### Test Webhook Endpoint

```bash
# Test health endpoint
curl -v http://localhost:3000/health

# Expected response:
# HTTP/1.1 200 OK
# {"status":"healthy"}
```

#### Test Webhook Signature Validation

Use the included E2E tests:

```bash
npm run test:e2e -- tests/e2e/webhook.test.ts
```

#### Test GitHub API Connectivity

```typescript
// Add to your test file
const octokit = createGitHubClient(installationId);
const { data: user } = await octokit.users.getAuthenticated();
console.log('✅ Connected as:', user.login);
```

### Common Issues

#### Issue: "ECONNREFUSED" on webhook

**Cause**: Server not running or wrong port

**Solution**:
```bash
# Check if server is running
lsof -i :3000

# Start server
npm run dev
```

#### Issue: "Invalid signature"

**Cause**: Webhook secret mismatch

**Solution**:
1. Verify secret in GitHub App settings
2. Check `.env` file has correct secret
3. Restart server after changing `.env`

#### Issue: "Rate limit exceeded"

**Cause**: Too many API calls

**Solution**:
1. Implement caching
2. Reduce frequency of API calls
3. Use conditional requests with ETags

#### Issue: Build fails with TypeScript errors

**Cause**: Type errors or configuration issues

**Solution**:
```bash
# Clean build
rm -rf dist

# Check for errors
npm run lint

# Rebuild
npm run build
```

### Debugging Tips

1. **Enable verbose logging**:
   ```typescript
   console.log('🐛 Debug:', JSON.stringify(payload, null, 2));
   ```

2. **Use VS Code debugger**:
   - Set breakpoints in code
   - Press F5 to start debugging
   - Trigger webhook events

3. **Test webhooks locally**:
   ```bash
   # Use smee.io
   smee --url https://smee.io/YOUR_CHANNEL --path /webhook --port 3000
   ```

4. **Check GitHub webhook deliveries**:
   - Go to GitHub App settings
   - Click "Advanced" → "Recent Deliveries"
   - Check status codes and responses

## Performance Optimization

### 1. Caching

Implement caching for frequently accessed data:

```typescript
const cache = new Map();

async function getCachedPR(owner, repo, number) {
  const key = `${owner}/${repo}/${number}`;
  if (cache.has(key)) {
    return cache.get(key);
  }
  const pr = await octokit.pulls.get({ owner, repo, pull_number: number });
  cache.set(key, pr.data);
  return pr.data;
}
```

### 2. Concurrent Processing

Process independent operations concurrently:

```typescript
// Sequential (slow)
await handlePR1();
await handlePR2();

// Concurrent (fast)
await Promise.all([
  handlePR1(),
  handlePR2(),
]);
```

### 3. Database for State

For complex workflows, consider adding a database:

```typescript
// PostgreSQL, MongoDB, or Redis
await db.pr.upsert({
  where: { number: prNumber },
  data: { status: 'processing' },
});
```

## Resources

- [GitHub Apps API Reference](https://docs.github.com/en/rest/apps)
- [Octokit Documentation](https://octokit.github.io/rest.js/)
- [Webhook Events](https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Node.js Production Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Need help?** Open an issue on [GitHub](https://github.com/d7knight2/CiKnight/issues) or check our [Quick Start Guide](CIKNIGHT_QUICKSTART.md).
