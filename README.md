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
├── .env.example              # Environment variables template
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