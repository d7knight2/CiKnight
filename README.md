# 🛡️ CiKnight

A GitHub App that automatically resolves merge conflicts, fixes CI failures, applies patches, and keeps PRs mergeable.

## Features

- 🔀 **Automatic Merge Conflict Resolution**: Detects and attempts to resolve merge conflicts automatically
- 🔧 **CI Failure Fixes**: Analyzes failed CI runs and applies fixes automatically
- 📝 **Patch Application**: Applies patches and updates to keep PRs current
- 📡 **Real-time Monitoring**: Listens to GitHub webhooks for instant updates
- 🔒 **Enhanced Security**: Webhook signature verification (IP validation disabled)
- ☁️ **Cloud-Ready**: Designed to run on Google Cloud Run

## Prerequisites

- Node.js 18 or higher
- A GitHub App with the following permissions:
  - **Pull requests**: Read & Write
  - **Checks**: Read & Write
  - **Contents**: Read & Write
  - **Issues**: Read & Write (for comments)
- GitHub App subscribed to these events:
  - `pull_request`
  - `check_run`
  - `check_suite`
  - `status`

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/d7knight2/CiKnight.git
cd CiKnight
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your GitHub App credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# GitHub App Configuration
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY="your_private_key"
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Server Configuration
PORT=3000
NODE_ENV=development

# Webhook Security
# Note: IP validation is currently DISABLED in the codebase
# All incoming webhook requests are accepted regardless of IP address
# Webhook signature verification is still performed by the @octokit/webhooks library
```

**Environment Variables Explained:**

- `GITHUB_APP_ID`: Your GitHub App's ID (found in app settings)
- `GITHUB_PRIVATE_KEY`: Your GitHub App's private key (use quotes if it contains newlines)
- `GITHUB_WEBHOOK_SECRET`: Secret used to verify webhook signatures (set when creating the app)
- `PORT`: Port number for the server (default: 3000)
- `NODE_ENV`: Environment mode (`development` or `production`)

### 4. Build the Project

```bash
npm run build
```

### 5. Run Locally

For development with hot reload:
```bash
npm run dev
```

For production:
```bash
npm start
```

The server will start on `http://localhost:3000`.

## Development

### Project Structure

```
CiKnight/
├── src/
│   ├── index.ts              # Express server entry point
│   ├── webhook.ts            # GitHub webhook handler
│   ├── github/               # GitHub API integrations
│   │   ├── client.ts         # GitHub client factory
│   │   ├── pull-request.ts   # PR event handlers
│   │   └── check-run.ts      # CI check handlers
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts
│   └── utils/                # Utility functions
│       ├── helpers.ts        # General helper functions
│       └── security.ts       # Webhook security utilities
├── tests/                    # Test files
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── .env.example              # Environment variables template
├── .husky/                   # Git hooks
├── Dockerfile                # Container configuration
├── package.json              # Dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

### Available Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run the production server
- `npm run dev` - Run development server with hot reload
- `npm run lint` - Lint code with ESLint
- `npm run lint:fix` - Fix linting issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm test` - Run unit tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:e2e` - Run Playwright integration tests
- `npm run test:e2e:ui` - Run Playwright tests with UI

### Running Tests

#### Unit Tests

Unit tests are written using Jest and located in the `tests/unit` directory:

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

#### Integration Tests

Integration tests use Playwright and are located in `tests/integration`:

```bash
# Run integration tests
npm run test:e2e

# Run with UI mode for debugging
npm run test:e2e:ui
```

### Linting and Formatting

The project uses ESLint for code linting and Prettier for code formatting:

```bash
# Check for linting issues
npm run lint

# Automatically fix linting issues
npm run lint:fix

# Check code formatting
npm run format:check

# Format all code
npm run format
```

### Git Hooks

The project uses Husky to run checks before commits and pushes:

- **Pre-commit**: Runs `lint-staged` to lint and format staged files
- **Pre-push**: Runs tests and build to ensure code quality

These hooks are automatically installed when you run `npm install`.

### Continuous Integration

The CI pipeline runs automatically on push and pull request events:

1. **Lint Job**: Checks code style with ESLint and Prettier
2. **Test Job**: Runs unit tests and generates coverage reports
3. **Build Job**: Compiles TypeScript and uploads build artifacts
4. **Docker Job**: Builds Docker image for deployment

All jobs must pass before code can be merged.

## Deployment

### Testing Docker Locally

Before deploying to Cloud Run, you can test the Docker container locally to ensure it works correctly:

#### Quick Test

```bash
# Test with default port (8080)
./scripts/test-docker.sh

# Test with custom port
TEST_PORT=3000 ./scripts/test-docker.sh
```

The test script will:
- Build the Docker image
- Start a container with the specified port
- Verify the application starts and responds correctly
- Check that the application binds to the expected port
- Run health checks

#### Manual Docker Testing

You can also manually test the Docker container:

```bash
# Build the image
docker build -t ciknight .

# Run the container on port 8080 (Cloud Run default)
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e NODE_ENV=production \
  -e GITHUB_APP_ID=your_app_id \
  -e GITHUB_PRIVATE_KEY="your_private_key" \
  -e GITHUB_WEBHOOK_SECRET=your_webhook_secret \
  ciknight

# Test the endpoints
curl http://localhost:8080/health
curl http://localhost:8080/
```

**Note:** The application dynamically binds to the PORT environment variable. Cloud Run automatically sets PORT=8080, but you can test with any port locally.

### Google Cloud Run

1. **Build the Docker image:**

```bash
docker build -t gcr.io/YOUR_PROJECT_ID/ciknight .
```

2. **Push to Google Container Registry:**

```bash
docker push gcr.io/YOUR_PROJECT_ID/ciknight
```

3. **Deploy to Cloud Run:**

```bash
gcloud run deploy ciknight \
  --image gcr.io/YOUR_PROJECT_ID/ciknight \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 60 \
  --set-env-vars "GITHUB_APP_ID=your_app_id,GITHUB_WEBHOOK_SECRET=your_secret,PORT=8080,WEBHOOK_IP_RESTRICTION_ENABLED=true,WEBHOOK_IP_FAIL_OPEN=false,TRUST_PROXY=true" \
  --set-secrets "GITHUB_PRIVATE_KEY=github-private-key:latest"
```

**Important Cloud Run Configuration:**
- `--port 8080`: Specifies the port the container listens on
- `--timeout 60`: Extended timeout for startup (default is 300s, but explicitly set for clarity)
- `PORT=8080`: Environment variable that the app uses to bind to the correct port
- `WEBHOOK_IP_RESTRICTION_ENABLED=true`: Enable IP restrictions for production security
- `WEBHOOK_IP_FAIL_OPEN=false`: Use fail-closed mode for maximum security
- `TRUST_PROXY=true`: **REQUIRED** for Cloud Run - trusts X-Forwarded-For header to extract real client IP

Alternatively, use the provided deployment script:

```bash
export GITHUB_APP_ID=your_app_id
export GITHUB_WEBHOOK_SECRET=your_webhook_secret
./deploy.sh
```

4. **Configure GitHub App webhook URL:**
   - Go to your GitHub App settings
   - Set the Webhook URL to your Cloud Run service URL + `/webhook`
   - Example: `https://ciknight-xxxxx-uc.a.run.app/webhook`

## API Endpoints

- `GET /` - Service information and health status
- `GET /health` - Health check endpoint
- `POST /webhook` - GitHub webhook receiver

## How It Works

1. **Webhook Reception**: CiKnight receives webhook events from GitHub when:
   - A pull request is opened, synchronized, or reopened
   - A check run completes
   - A status changes

2. **Event Processing**: Based on the event type, CiKnight:
   - Analyzes PR mergeable state
   - Detects merge conflicts
   - Identifies CI failures
   - Determines appropriate actions

3. **Automatic Actions**: CiKnight can:
   - Post informative comments on PRs
   - Attempt to resolve merge conflicts
   - Fix common CI failures (linting, formatting, etc.)
   - Apply patches and updates

## Security

CiKnight implements multiple layers of security to ensure only legitimate GitHub webhook events are processed:

### Webhook Signature Verification

All incoming webhook requests are automatically verified using HMAC SHA-256 signatures. The application:

- Validates the `X-Hub-Signature-256` header against the computed HMAC of the request body
- Uses timing-safe comparison to prevent timing attacks
- Rejects requests with invalid or missing signatures

**Setup:**
1. When creating your GitHub App, set a webhook secret
2. Add the secret to your `.env` file:
   ```env
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   ```

### IP Address Restrictions

CiKnight can restrict webhook requests to only GitHub's official IP ranges, providing an additional layer of security:

- Automatically fetches GitHub's webhook IP ranges from the [GitHub Meta API](https://api.github.com/meta)
- Validates both IPv4 and IPv6 addresses against GitHub's CIDR ranges
- Caches IP ranges for 1 hour to reduce API calls
- Returns `403 Forbidden` for requests from unauthorized IPs

**Configuration:**

Enable IP restrictions (enabled by default):
```env
WEBHOOK_IP_RESTRICTION_ENABLED=true
```

Disable IP restrictions if needed (e.g., for local testing):
```env
# Any of these values will disable IP restrictions
WEBHOOK_IP_RESTRICTION_ENABLED=false
# or
WEBHOOK_IP_RESTRICTION_ENABLED=0
# or
WEBHOOK_IP_RESTRICTION_ENABLED=no
# or
WEBHOOK_IP_RESTRICTION_ENABLED=off
```

**Fail-Open vs Fail-Closed Mode:**

Configure behavior when IP validation encounters errors:

```env
# Fail-closed (default, recommended for production)
# Rejects requests when IP validation fails
WEBHOOK_IP_FAIL_OPEN=false

# Fail-open (use with caution)
# Allows requests when IP validation fails
WEBHOOK_IP_FAIL_OPEN=true
```

**Note:** For local development, you may want to disable IP restrictions since your local server won't receive requests from GitHub's IP ranges. When deploying to production, keep IP restrictions enabled for maximum security.

### Rate Limiting

The webhook endpoint includes rate limiting to prevent abuse:
- Maximum 100 requests per minute per IP address
- Automatically returns `429 Too Many Requests` when limit is exceeded

### Best Practices

- **Store secrets securely**: Use Secret Manager or similar services in production
- **Use environment variables**: Never commit `.env` files to version control
- **Monitor logs**: Watch for rejected webhook requests that might indicate attacks
- **Keep dependencies updated**: Regularly update npm packages to patch security vulnerabilities
- **Enable IP restrictions**: Always enable IP restrictions in production environments
- **Use HTTPS**: Ensure your webhook endpoint uses HTTPS in production
- **Verify webhook signatures**: Signature validation is enabled by default and should never be disabled
### Webhook Security

CiKnight implements multiple layers of security to protect against unauthorized webhook usage:

#### 1. Webhook Signature Verification
- All incoming webhooks are verified using the `GITHUB_WEBHOOK_SECRET`
- Invalid signatures are automatically rejected
- This ensures webhooks are genuinely from GitHub

#### 2. Repository Owner Verification
- **CiKnight only processes pull requests for repositories owned by `d7knight2`**
- Pull request webhooks from other repository owners are rejected with a `403 Forbidden` status
- This prevents unauthorized use of the webhook by other users or projects

**How it works:**
- When a `pull_request` event is received, CiKnight checks the repository owner (`payload.repository.owner.login`)
- If the owner is not `d7knight2`, the webhook is immediately rejected
- This check happens before any event processing or API calls

**Testing the owner verification:**

To verify that CiKnight properly rejects unauthorized webhooks:

1. **Using curl (simulated webhook):**
```bash
# This will be rejected (403 Forbidden)
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "x-github-event: pull_request" \
  -H "x-github-delivery: test-123" \
  -H "x-hub-signature-256: sha256=test" \
  -d '{
    "pull_request": {"number": 1},
    "repository": {
      "owner": {"login": "unauthorized-user"},
      "name": "test-repo"
    }
  }'
```

2. **Checking logs:**
When an unauthorized webhook is received, you'll see in the logs:
```
🚫 Unauthorized webhook: Repository owner 'unauthorized-user' is not 'd7knight2'
```

3. **Expected responses:**
- `200 OK` - Webhook from `d7knight2` repository processed successfully
- `403 Forbidden` - Webhook from non-`d7knight2` repository rejected
- `400 Bad Request` - Missing required headers or invalid payload structure

#### 3. Additional Security Best Practices

- Store your GitHub App private key securely (use Secret Manager in production)
- Always verify webhook signatures
- Use environment variables for sensitive configuration
- Never commit `.env` files to version control
- Enable rate limiting on the webhook endpoint (configured to 100 requests/minute)

### Security Testing

Run the comprehensive test suite to verify all security features:

```bash
# Run all tests including security tests
npm test

# Run specific webhook security tests
npm test -- webhook.test.ts
```

The test suite includes:
- Owner verification for various scenarios
- Webhook signature validation
- Malformed payload handling
- Edge cases and error conditions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Webhook IP Validation Issues

**Problem:** Webhooks are being rejected with `403 Forbidden: IP not in GitHub webhook ranges`, even though they're coming from GitHub.

**Common Causes:**

1. **Running behind a proxy/load balancer (most common)**
   - When your app runs behind a reverse proxy or load balancer (e.g., Google Cloud Run, AWS ALB, nginx, Cloudflare), the socket IP address will be an internal IP (like `169.254.x.x` or `10.x.x.x`) instead of the actual GitHub IP
   - The actual GitHub IP is in the `X-Forwarded-For` or `X-Real-IP` header

   **Solution:** Enable `TRUST_PROXY` in your environment:
   ```env
   TRUST_PROXY=true
   ```

   **For Google Cloud Run:**
   ```bash
   gcloud run services update ciknight \
     --update-env-vars TRUST_PROXY=true
   ```

2. **GitHub IP ranges have changed**
   - GitHub occasionally adds new IP ranges for webhooks
   - The app automatically fetches the latest ranges from `https://api.github.com/meta` and caches them for 1 hour

   **Solution:** Wait for the cache to refresh (up to 1 hour) or restart the application to force a fresh fetch

3. **Network issues preventing IP range fetch**
   - If the app can't fetch GitHub's IP ranges, it will fail closed by default (reject all requests)

   **Solution:** Enable fail-open mode temporarily:
   ```env
   WEBHOOK_IP_FAIL_OPEN=true
   ```
   ⚠️ **Warning:** This reduces security - only use temporarily for debugging

**Debugging Steps:**

1. **Check the logs** to see what IP address the app is seeing:
   ```
   📍 Webhook request from IP: 169.254.169.126
   ```

2. **If you see an internal IP** (169.254.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x):
   - You're running behind a proxy
   - Set `TRUST_PROXY=true`

3. **If you see a public GitHub IP** but it's still rejected:
   - Check if GitHub has added new IP ranges
   - Force a cache refresh by restarting the app
   - Temporarily disable IP restrictions for testing:
     ```env
     WEBHOOK_IP_RESTRICTION_ENABLED=false
     ```

4. **Verify GitHub's current webhook IP ranges:**
   ```bash
   curl -s https://api.github.com/meta | jq '.hooks'
   ```

### Webhook Signature Verification Issues

**Problem:** Webhooks are being rejected with error: `[@octokit/webhooks] signature does not match event payload and secret`

**Common Causes:**

1. **Webhook secret mismatch**
   - The secret configured in GitHub doesn't match `GITHUB_WEBHOOK_SECRET` in your environment
   - Check for trailing spaces or newlines in the secret
   
   **Solution:** 
   - Verify the secret in GitHub App settings matches exactly
   - Use quotes when setting the environment variable to preserve exact value
   - Check for hidden characters or encoding issues

2. **Payload transformation**
   - The payload is being modified before signature verification
   - Middleware is altering the request body
   
   **Solution:**
   - Ensure Express middleware captures raw body correctly
   - The application uses `express.json()` with a `verify` callback to capture raw body

3. **Encoding issues**
   - Character encoding mismatch between GitHub and the application
   
   **Solution:**
   - Verify UTF-8 encoding is used consistently
   - Check that no byte-order marks (BOM) or special characters are causing issues

**Debug Logging:**

When a webhook is received, the application logs detailed debug information to help diagnose signature issues:

```
🔍 [Webhook Debug] Delivery ID: <delivery-id>, Event: <event-type>
🔍 [Webhook Debug] Payload length: <bytes> bytes
🔍 [Webhook Debug] Payload preview: <first-100-chars>...
🔍 [Webhook Debug] Received signature: sha256=<signature>
🔍 [Webhook Debug] Webhook secret configured: Yes (length: <length>)
🔍 [Webhook Debug] Computed signature: sha256=<computed-signature>
🔍 [Webhook Debug] Signatures match: ✅ Yes / ❌ No
```

If signature verification fails, additional diagnostic information is logged:

```
🔍 [Webhook Debug] Signature verification failed!
🔍 [Webhook Debug] Error details: <error-message>
🔍 [Webhook Debug] Possible causes:
  1. Webhook secret mismatch between GitHub and application
  2. Payload was modified before signature verification
  3. Encoding issues with the payload
  4. Trailing spaces or newlines in the webhook secret
```

**Debugging Steps:**

1. **Check the logs** for the debug output above
2. **Compare signatures**: The received and computed signatures should match exactly
3. **Verify secret**: Check that the secret length matches your expectations
4. **Test locally**: Use tools like `ngrok` to forward webhooks to your local environment
5. **Simulate webhooks**: Create test payloads with known secrets to verify the signature computation

**Testing Signature Validation:**

```bash
# Test webhook signature computation manually
node -e "
const crypto = require('crypto');
const secret = 'your-webhook-secret';
const payload = '{\"test\":\"data\"}';
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload, 'utf8');
console.log('sha256=' + hmac.digest('hex'));
"
```

### Other Common Issues

**Problem:** Webhooks timeout or fail intermittently

**Solution:**
- Increase Cloud Run timeout: `--timeout 300`
- Check GitHub App permissions are correct
- Verify network connectivity to GitHub API

**Problem:** "Missing required webhook headers" error

**Solution:**
- Ensure your GitHub App webhook is configured correctly
- Webhook secret must match `GITHUB_WEBHOOK_SECRET`
- Content-Type should be `application/json`

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions, please open an issue on GitHub.