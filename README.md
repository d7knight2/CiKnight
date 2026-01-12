# 🛡️ CiKnight

A GitHub App that automatically resolves merge conflicts, fixes CI failures, applies patches, and keeps PRs mergeable.

## Features

- 🔀 **Automatic Merge Conflict Resolution**: Detects and attempts to resolve merge conflicts automatically
- 🔧 **CI Failure Fixes**: Analyzes failed CI runs and applies fixes automatically
- 📝 **Patch Application**: Applies patches and updates to keep PRs current
- 📡 **Real-time Monitoring**: Listens to GitHub webhooks for instant updates
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
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY="your_private_key"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
PORT=3000
NODE_ENV=development
```

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
│       └── helpers.ts
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
  --set-env-vars "GITHUB_APP_ID=your_app_id,GITHUB_WEBHOOK_SECRET=your_secret,PORT=8080" \
  --set-secrets "GITHUB_PRIVATE_KEY=github-private-key:latest"
```

**Important Cloud Run Configuration:**
- `--port 8080`: Specifies the port the container listens on
- `--timeout 60`: Extended timeout for startup (default is 300s, but explicitly set for clarity)
- `PORT=8080`: Environment variable that the app uses to bind to the correct port

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

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions, please open an issue on GitHub.