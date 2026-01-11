# CiKnight Quick Start Guide

Welcome to **CiKnight**! This guide will help you get started with CiKnight, a powerful GitHub App that automatically resolves merge conflicts, fixes CI failures, and keeps your PRs mergeable.

## Table of Contents

1. [What is CiKnight?](#what-is-ciknight)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [First Steps](#first-steps)
6. [Common Use Cases](#common-use-cases)
7. [Troubleshooting](#troubleshooting)

## What is CiKnight?

CiKnight is a GitHub App designed to automate common PR maintenance tasks:

- **🔀 Automatic Merge Conflict Resolution**: Detects and helps resolve merge conflicts
- **🔧 CI Failure Fixes**: Analyzes and attempts to fix common CI failures
- **📝 Patch Application**: Keeps PRs up-to-date with the latest changes
- **📡 Real-time Monitoring**: Responds instantly to GitHub events via webhooks

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18 or higher** installed on your development machine
- A **GitHub account** with admin access to create GitHub Apps
- A **Google Cloud account** (for production deployment) or any cloud platform supporting Docker
- Basic knowledge of Git, GitHub, and command-line tools

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/d7knight2/CiKnight.git
cd CiKnight
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required Node.js dependencies including:
- Express.js for the web server
- Octokit for GitHub API interactions
- TypeScript for type-safe development
- Testing frameworks (Jest and Playwright)

### Step 3: Create a GitHub App

1. Navigate to your GitHub account settings
2. Go to **Developer settings** → **GitHub Apps** → **New GitHub App**
3. Fill in the required information:
   - **Name**: Choose a unique name (e.g., "CiKnight-YourOrg")
   - **Homepage URL**: Your repository or organization URL
   - **Webhook URL**: Will be updated after deployment (use a placeholder for now)
   - **Webhook secret**: Generate a secure random string
   
   ```bash
   # Generate a webhook secret
   openssl rand -hex 20
   ```

4. Set the required **permissions**:
   - **Checks**: Read & Write
   - **Contents**: Read & Write
   - **Issues**: Read & Write
   - **Pull requests**: Read & Write
   - **Statuses**: Read

5. Subscribe to **events**:
   - ✅ Pull request
   - ✅ Check run
   - ✅ Check suite
   - ✅ Status

6. Click **Create GitHub App**
7. **Save your App ID** (you'll see it on the settings page)
8. Generate a **private key** (download the `.pem` file)

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
GITHUB_APP_ID=your_app_id_here
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
Your private key content here (from the .pem file)
-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
PORT=3000
NODE_ENV=development
```

**Important**: 
- The private key should include the BEGIN and END lines
- Keep the quotes around the multi-line private key
- Never commit the `.env` file to version control

## Configuration

### Build the Project

Before running CiKnight, build the TypeScript code:

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Verify the Installation

Run the linter and tests to ensure everything is set up correctly:

```bash
# Check code style
npm run lint

# Run unit tests
npm test

# Run all checks
npm run format:check
```

## First Steps

### 1. Run Locally

Start the development server:

```bash
npm run dev
```

You should see:
```
🚀 CiKnight is running on port 3000
📡 Webhook endpoint: http://localhost:3000/webhook
```

### 2. Set Up Webhook Forwarding (for local testing)

To test webhooks locally, use a service like [smee.io](https://smee.io/):

1. Go to https://smee.io/ and click **Start a new channel**
2. Copy the webhook proxy URL
3. Install the smee client:
   ```bash
   npm install -g smee-client
   ```
4. Forward webhooks to your local server:
   ```bash
   smee --url https://smee.io/YOUR_CHANNEL --path /webhook --port 3000
   ```
5. Update your GitHub App's webhook URL to the smee.io URL

### 3. Install the GitHub App

1. Go to your GitHub App settings
2. Click **Install App** in the sidebar
3. Choose the account/organization to install on
4. Select repositories (all or specific ones)
5. Click **Install**

### 4. Test with a Pull Request

Create a test pull request in a repository where CiKnight is installed:

1. Create a new branch and push some changes
2. Open a pull request
3. CiKnight should post a welcome comment automatically
4. Check your server logs to see the webhook processing

## Common Use Cases

### Monitoring Pull Requests

CiKnight automatically monitors PRs for:
- **Merge conflicts**: Posts a comment when conflicts are detected
- **CI failures**: Analyzes failed checks and provides information
- **Status changes**: Tracks PR health and notifies about issues

### Handling Merge Conflicts

When CiKnight detects a merge conflict:
1. It posts a comment on the PR explaining the conflict
2. It analyzes the conflict complexity
3. For simple conflicts, it may attempt automatic resolution (future feature)
4. For complex conflicts, it provides guidance for manual resolution

### CI Failure Analysis

When a CI check fails:
1. CiKnight receives the check_run.completed event
2. It analyzes the failure logs
3. It posts a comment with failure details and a link to the logs
4. For common issues (linting, formatting), it may suggest or apply fixes

## Troubleshooting

### Node.js Dependency Lock Issues

If you encounter dependency conflicts or lock file issues:

1. **Clear npm cache**:
   ```bash
   npm cache clean --force
   ```

2. **Remove node_modules and lock file**:
   ```bash
   rm -rf node_modules package-lock.json
   ```

3. **Reinstall dependencies**:
   ```bash
   npm install
   ```

4. **Verify Node.js version**:
   ```bash
   node --version  # Should be 18.x or higher
   ```

### Webhook Not Received

If webhooks aren't being processed:

1. **Check webhook secret**: Ensure it matches in both GitHub App settings and `.env`
2. **Verify webhook URL**: Make sure it's correct and accessible
3. **Check logs**: Look for error messages in the console
4. **Test signature verification**: Ensure the webhook signature is valid

To debug webhook issues:
```bash
# Check recent webhook deliveries in GitHub App settings
# Look for HTTP status codes and error messages
```

### Authentication Errors

If you see authentication errors:

1. **Verify App ID**: Check that `GITHUB_APP_ID` is correct
2. **Check private key format**: Ensure it includes BEGIN/END lines
3. **Verify installation**: Make sure the app is installed on the repository
4. **Check permissions**: Ensure all required permissions are granted

### Build Errors

If TypeScript compilation fails:

1. **Check TypeScript version**:
   ```bash
   npm list typescript
   ```

2. **Verify tsconfig.json**: Ensure configuration is correct
3. **Check for syntax errors**: Review error messages carefully
4. **Clean build**:
   ```bash
   rm -rf dist
   npm run build
   ```

### API Endpoint Connectivity Testing

To verify CiKnight endpoints are working:

1. **Health check**:
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"healthy"}
   ```

2. **Service information**:
   ```bash
   curl http://localhost:3000/
   # Expected: JSON with name, version, status
   ```

3. **Webhook endpoint** (requires valid signature):
   ```bash
   # Use the test script from tests/e2e/webhook.test.ts
   npm run test:e2e
   ```

### Common Error Messages

**"GITHUB_WEBHOOK_SECRET environment variable is required"**
- Solution: Ensure `.env` file exists with `GITHUB_WEBHOOK_SECRET` set

**"Missing GitHub App credentials"**
- Solution: Check `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` in `.env`

**"Missing required webhook headers"**
- Solution: Ensure webhooks include x-hub-signature-256, x-github-event, and x-github-delivery headers

**Port 3000 already in use**
- Solution: Change the port in `.env` or stop the process using port 3000:
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```

## Next Steps

Once you have CiKnight running locally:

1. **Deploy to production**: See [SETUP.md](SETUP.md) for deployment instructions
2. **Customize behavior**: Explore the source code to understand and extend functionality
3. **Integrate with your workflow**: Configure CiKnight for your team's specific needs
4. **Monitor and improve**: Use logs and GitHub insights to optimize performance

## Getting Help

If you need assistance:

- **Documentation**: Check [README.md](README.md) and [SETUP.md](SETUP.md)
- **Issues**: Open an issue on [GitHub Issues](https://github.com/d7knight2/CiKnight/issues)
- **Logs**: Enable debug logging by setting `NODE_ENV=development`
- **Community**: Join discussions and share your experience

## Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Octokit.js Documentation](https://octokit.github.io/rest.js/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Happy coding with CiKnight! 🛡️**
