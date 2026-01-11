# CiKnight GitHub App Setup Guide

This guide will walk you through setting up your own instance of CiKnight as a GitHub App.

## Prerequisites

- A GitHub account
- Node.js 18 or higher installed locally (for testing)
- A Google Cloud account (for deployment)
- Git installed on your machine

## Step 1: Create a GitHub App

1. **Navigate to GitHub App Settings**
   - Go to your GitHub account settings
   - Click on "Developer settings" in the left sidebar
   - Click on "GitHub Apps"
   - Click "New GitHub App"

2. **Configure Basic Information**
   - **GitHub App name**: `CiKnight` (or your preferred name)
   - **Homepage URL**: `https://github.com/d7knight2/CiKnight`
   - **Webhook URL**: `https://your-cloud-run-url.run.app/webhook` (you'll update this after deployment)
   - **Webhook secret**: Generate a strong random string and save it securely
     ```bash
     # Generate a webhook secret
     ruby -rsecurerandom -e 'puts SecureRandom.hex(20)'
     ```

3. **Set Permissions**
   - **Repository permissions**:
     - Checks: Read & Write
     - Contents: Read & Write
     - Issues: Read & Write
     - Pull requests: Read & Write
     - Statuses: Read
   
4. **Subscribe to Events**
   - ✅ Pull request
   - ✅ Check run
   - ✅ Check suite
   - ✅ Status

5. **Where can this GitHub App be installed?**
   - Select "Any account" or "Only on this account" based on your needs

6. **Create the GitHub App**
   - Click "Create GitHub App"
   - **Save the App ID** - you'll need this for configuration

7. **Generate a Private Key**
   - On your newly created GitHub App page, scroll down to "Private keys"
   - Click "Generate a private key"
   - A `.pem` file will be downloaded
   - **Keep this file secure** - you'll need it for authentication

## Step 2: Install the GitHub App

1. Go to your GitHub App's page
2. Click "Install App" in the left sidebar
3. Choose the account/organization to install it on
4. Select which repositories to give the app access to:
   - All repositories, or
   - Select specific repositories
5. Click "Install"

## Step 3: Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
GITHUB_APP_ID=your_app_id_from_step_1
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
your_private_key_content_here
-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret_from_step_1
PORT=3000
NODE_ENV=development
```

**Important Notes:**
- The private key should be the entire content of the `.pem` file
- Include the `BEGIN` and `END` lines
- Keep the quotes around the private key
- For production, use environment variables or secrets management instead of `.env` files

## Step 4: Test Locally

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Project**
   ```bash
   npm run build
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```

4. **Test with a Webhook Proxy** (for local testing)
   
   Use a service like [smee.io](https://smee.io/) to forward GitHub webhooks to your local machine:
   
   ```bash
   # Install smee client
   npm install -g smee-client
   
   # Create a new channel at https://smee.io/
   # Then forward webhooks to your local server
   smee --url https://smee.io/your-unique-url --path /webhook --port 3000
   ```
   
   Update your GitHub App's webhook URL to the smee.io URL.

5. **Test by Creating a Pull Request**
   - Create a test pull request in a repository where the app is installed
   - Check your server logs for webhook events
   - The app should post a comment on the PR

## Step 5: Deploy to Google Cloud Run

1. **Set Up Google Cloud**
   ```bash
   # Install Google Cloud SDK if not already installed
   # https://cloud.google.com/sdk/docs/install
   
   # Login to Google Cloud
   gcloud auth login
   
   # Set your project
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable Required APIs**
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

3. **Store the Private Key in Secret Manager**
   ```bash
   # Enable Secret Manager API
   gcloud services enable secretmanager.googleapis.com
   
   # Create a secret with your private key
   gcloud secrets create github-private-key --data-file=path/to/your-private-key.pem
   
   # Grant Cloud Run access to the secret
   gcloud secrets add-iam-policy-binding github-private-key \
     --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
     --role=roles/secretmanager.secretAccessor
   ```

4. **Deploy Using the Provided Script**
   ```bash
   # Set environment variables
   export GOOGLE_CLOUD_PROJECT=your-project-id
   export GITHUB_APP_ID=your_app_id
   export GITHUB_WEBHOOK_SECRET=your_webhook_secret
   
   # Make the script executable and run it
   chmod +x deploy.sh
   ./deploy.sh
   ```

   Or deploy manually:
   ```bash
   # Build and push the Docker image
   docker build -t gcr.io/YOUR_PROJECT_ID/ciknight .
   docker push gcr.io/YOUR_PROJECT_ID/ciknight
   
   # Deploy to Cloud Run
   gcloud run deploy ciknight \
     --image gcr.io/YOUR_PROJECT_ID/ciknight \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "GITHUB_APP_ID=${GITHUB_APP_ID},GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET},NODE_ENV=production" \
     --set-secrets "GITHUB_PRIVATE_KEY=github-private-key:latest"
   ```

5. **Update GitHub App Webhook URL**
   - Get your Cloud Run service URL from the deployment output
   - Go to your GitHub App settings
   - Update the Webhook URL to: `https://your-service-url.run.app/webhook`
   - Save the changes

## Step 6: Verify the Deployment

1. **Check Service Health**
   ```bash
   curl https://your-service-url.run.app/health
   ```
   
   Should return:
   ```json
   {"status": "healthy"}
   ```

2. **Test with a Pull Request**
   - Create or update a pull request in a repository where the app is installed
   - CiKnight should post a comment on the PR
   - Check Cloud Run logs for any errors:
     ```bash
     gcloud run logs read ciknight --region us-central1
     ```

## Troubleshooting

### Webhook Not Received

1. Check that the webhook URL is correct in GitHub App settings
2. Verify the webhook secret matches in both GitHub and your environment
3. Check Cloud Run logs for any errors
4. Verify the service is running: `gcloud run services describe ciknight --region us-central1`

### Authentication Errors

1. Verify your App ID is correct
2. Check that the private key is properly formatted
3. Ensure Secret Manager is accessible by Cloud Run
4. Verify the installation ID is correct

### Build Errors

1. Run `npm run build` locally to check for TypeScript errors
2. Ensure all dependencies are listed in `package.json`
3. Check Docker build logs: `docker build -t test .`

## Monitoring and Logs

View Cloud Run logs:
```bash
# Real-time logs
gcloud run logs tail ciknight --region us-central1

# Recent logs
gcloud run logs read ciknight --region us-central1 --limit 50
```

## Security Best Practices

1. **Never commit `.env` files** - they contain sensitive information
2. **Use Secret Manager** for production credentials
3. **Rotate webhook secrets regularly**
4. **Limit repository access** to only what's needed
5. **Monitor logs** for suspicious activity
6. **Keep dependencies updated** - run `npm audit` regularly

## Updating the Deployment

To update your deployed app:

```bash
# Pull latest changes
git pull

# Build and deploy
./deploy.sh
```

## Cost Estimation

Google Cloud Run pricing is based on usage:
- **Free tier**: 2 million requests/month
- **After free tier**: ~$0.40 per million requests

For a typical small to medium project, CiKnight should stay within the free tier.

## Support

For issues or questions:
- Check the [GitHub Issues](https://github.com/d7knight2/CiKnight/issues)
- Review the [README.md](../README.md)
- Check Cloud Run logs for error messages

## Next Steps

Once deployed, CiKnight will:
- Monitor pull requests for merge conflicts
- Track CI check runs for failures
- Post helpful comments on PRs
- Prepare for automatic fixes (feature in development)

To extend CiKnight's capabilities, see the [Development Guide](../README.md#development).
