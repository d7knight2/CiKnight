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

The server will start on `http://localhost:8080`.

## Development

### Quick Start for Contributors

Before making any changes, ensure your development environment is properly set up:

```bash
# 1. Install dependencies
npm install

# 2. Verify the build works
npm run build

# 3. Run linting to catch any issues
npm run lint

# 4. Run tests to ensure everything works
npm test

# 5. (Optional) Start development server
npm run dev
```

**Pre-submission Checklist:**
- [ ] Code builds successfully (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Docker builds successfully (if Dockerfile changes: `docker build -t ciknight:test .`)

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

The project uses ESLint for code linting and Prettier for code formatting. All code must pass linting checks before being committed.

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

**Important Linting Rules:**
- No `any` types are allowed - use proper TypeScript types
- All functions must have explicit return types for public APIs
- Unused variables are not permitted (except those prefixed with `_`)
- Code must follow consistent formatting as defined in `.prettierrc.json`

### Building the Project

Before submitting changes, ensure your code builds successfully:

```bash
# Build TypeScript to JavaScript
npm run build

# The compiled output will be in the dist/ directory
```

The build process:
1. Compiles TypeScript files from `src/` directory
2. Outputs JavaScript files to `dist/` directory
3. Uses `tsconfig.build.json` for build-specific TypeScript configuration
4. Must complete without errors for CI to pass

### Docker Build

To build and test the Docker container locally:

```bash
# Build the Docker image
docker build -t ciknight:local .

# Run the container (requires environment variables)
docker run -p 8080:8080 \
  -e GITHUB_APP_ID=your_app_id \
  -e GITHUB_PRIVATE_KEY="your_private_key" \
  -e GITHUB_WEBHOOK_SECRET=your_webhook_secret \
  ciknight:local

# Test the health endpoint
curl http://localhost:8080/health
```

**Docker Configuration:**
- **Port**: Container exposes port 8080 (configurable via PORT environment variable)
- **Multi-stage build**: Uses separate builder and production stages for optimization
- **Health check**: Included for container orchestration systems
- **Build dependencies**: All dependencies are installed during the build process

### Git Hooks

The project uses Husky to run checks before commits and pushes:

- **Pre-commit**: Runs `lint-staged` to lint and format staged files
- **Pre-push**: Runs tests and build to ensure code quality

These hooks are automatically installed when you run `npm install`.

**If Pre-push Fails:**
1. Check the error messages - they'll indicate which step failed (test, build, or lint)
2. Fix the issues locally before pushing again
3. Run the failing command manually to debug: `npm test`, `npm run build`, or `npm run lint`

### Continuous Integration

The CI pipeline runs automatically on push and pull request events:

1. **Lint Job**: Checks code style with ESLint and Prettier
   - Must pass with zero errors or warnings
   - Uses Node.js 18.20.8
   - Includes npm dependency caching for faster builds

2. **Test Job**: Runs unit tests and generates coverage reports
   - All tests must pass
   - Coverage reports are uploaded as artifacts
   - Tests run against Node.js 18.20.8

3. **Build Job**: Compiles TypeScript and uploads build artifacts
   - TypeScript compilation must succeed
   - Build artifacts are uploaded for verification
   - Uses the same Node.js version as production

4. **Docker Job**: Builds Docker image for deployment
   - Validates Dockerfile configuration
   - Ensures all dependencies install correctly
   - Uses Docker layer caching to speed up builds

All jobs must pass before code can be merged.

**Troubleshooting CI Failures:**
- Check the GitHub Actions logs for detailed error messages
- Reproduce the failure locally by running the same commands
- Common issues: missing dependencies, type errors, test failures
- The CI uses the exact same commands as local development

## Deployment

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
  --set-env-vars "GITHUB_APP_ID=your_app_id,GITHUB_WEBHOOK_SECRET=your_secret" \
  --set-secrets "GITHUB_PRIVATE_KEY=github-private-key:latest"
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

- Store your GitHub App private key securely (use Secret Manager in production)
- Always verify webhook signatures
- Use environment variables for sensitive configuration
- Never commit `.env` files to version control

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