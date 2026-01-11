import { Request, Response } from 'express';
import { Webhooks } from '@octokit/webhooks';
import { handlePullRequest } from './github/pull-request';
import { handleCheckRun } from './github/check-run';

// Validate required environment variables
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error('GITHUB_WEBHOOK_SECRET environment variable is required');
}

// Initialize webhooks
const webhooks = new Webhooks({
  secret: webhookSecret,
});

// Pull Request events
webhooks.on('pull_request.opened', async ({ payload }) => {
  console.log(`📬 Pull request opened: #${payload.pull_request.number}`);
  await handlePullRequest(payload, 'opened');
});

webhooks.on('pull_request.synchronize', async ({ payload }) => {
  console.log(`🔄 Pull request synchronized: #${payload.pull_request.number}`);
  await handlePullRequest(payload, 'synchronize');
});

webhooks.on('pull_request.reopened', async ({ payload }) => {
  console.log(`🔓 Pull request reopened: #${payload.pull_request.number}`);
  await handlePullRequest(payload, 'reopened');
});

// Check run events for CI failures
webhooks.on('check_run.completed', async ({ payload }) => {
  console.log(`✅ Check run completed: ${payload.check_run.name}`);
  await handleCheckRun(payload);
});

// Check suite events
webhooks.on('check_suite.completed', async ({ payload }) => {
  console.log(`📦 Check suite completed: ${payload.check_suite.head_branch}`);
  // Handle check suite completion if needed
});

// Status events
webhooks.on('status', async ({ payload }) => {
  console.log(`📊 Status event: ${payload.context} - ${payload.state}`);
  // Handle status events if needed
});

// Error handling
webhooks.onError((error) => {
  console.error('❌ Webhook error:', error);
});

// Webhook handler for Express
export const webhookHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const id = req.headers['x-github-delivery'] as string;

    if (!signature || !event || !id) {
      return res.status(400).json({ error: 'Missing required webhook headers' });
    }

    // Use rawBody for signature verification, req.body is already parsed JSON
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      return res.status(400).json({ error: 'Missing raw body for verification' });
    }

    await webhooks.verifyAndReceive({
      id,
      name: event as any, // GitHub sends various event names, type system can't enumerate all
      signature,
      payload: rawBody,
    });

    return res.status(200).json({ message: 'Webhook received' });
  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

export { webhooks };
