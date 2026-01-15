import { Request, Response } from 'express';
import { Webhooks } from '@octokit/webhooks';
import { handlePullRequest } from './github/pull-request';
import { handleCheckRun } from './github/check-run';
import { computeWebhookSignature } from './utils/helpers';

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
  try {
    console.log(`📬 Pull request opened: #${payload.pull_request.number}`);
    await handlePullRequest(payload, 'opened');
  } catch (error: any) {
    console.error(`❌ Error handling pull_request.opened event:`, error.message, error);
  }
});

webhooks.on('pull_request.synchronize', async ({ payload }) => {
  try {
    console.log(`🔄 Pull request synchronized: #${payload.pull_request.number}`);
    await handlePullRequest(payload, 'synchronize');
  } catch (error: any) {
    console.error(`❌ Error handling pull_request.synchronize event:`, error.message, error);
  }
});

webhooks.on('pull_request.reopened', async ({ payload }) => {
  try {
    console.log(`🔓 Pull request reopened: #${payload.pull_request.number}`);
    await handlePullRequest(payload, 'reopened');
  } catch (error: any) {
    console.error(`❌ Error handling pull_request.reopened event:`, error.message, error);
  }
});

// Check run events for CI failures
webhooks.on('check_run.completed', async ({ payload }) => {
  try {
    console.log(`✅ Check run completed: ${payload.check_run.name}`);
    await handleCheckRun(payload);
  } catch (error: any) {
    console.error(`❌ Error handling check_run.completed event:`, error.message, error);
  }
});

// Check suite events
webhooks.on('check_suite.completed', async ({ payload }) => {
  try {
    console.log(`📦 Check suite completed: ${payload.check_suite.head_branch}`);
    // Handle check suite completion if needed
  } catch (error: any) {
    console.error(`❌ Error handling check_suite.completed event:`, error.message, error);
  }
});

// Status events
webhooks.on('status', async ({ payload }) => {
  try {
    console.log(`📊 Status event: ${payload.context} - ${payload.state}`);
    // Handle status events if needed
  } catch (error: any) {
    console.error(`❌ Error handling status event:`, error.message, error);
  }
});

// Error handling
webhooks.onError((error) => {
  console.error('❌ Webhook error:', error);
});

// Webhook handler for Express
export const webhookHandler = async (req: Request, res: Response): Promise<void> => {
  let responded = false;

  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const id = req.headers['x-github-delivery'] as string;

    console.log(`🔍 [Webhook Debug] Delivery ID: ${id}, Event: ${event}`);

    if (!signature || !event || !id) {
      console.error('❌ [Webhook Debug] Missing required headers:', {
        hasSignature: !!signature,
        hasEvent: !!event,
        hasId: !!id,
      });
      responded = true;
      res.status(400).json({ error: 'Missing required webhook headers' });
      return;
    }

    // Use rawBody for signature verification, req.body is already parsed JSON
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.error('❌ [Webhook Debug] Missing raw body for verification');
      responded = true;
      res.status(400).json({ error: 'Missing raw body for verification' });
      return;
    }

    // Debug logging for signature validation
    console.log(`🔍 [Webhook Debug] Payload length: ${rawBody.length} bytes`);
    console.log(`🔍 [Webhook Debug] Received signature: ${signature}`);
    console.log(`🔍 [Webhook Debug] Webhook secret configured: ${webhookSecret ? 'Yes' : 'No'}`);

    // Compute expected signature for debugging
    if (webhookSecret) {
      const computedSignature = computeWebhookSignature(webhookSecret, rawBody);
      const signaturesMatch = signature === computedSignature;
      console.log(`🔍 [Webhook Debug] Signatures match: ${signaturesMatch ? '✅ Yes' : '❌ No'}`);

      // Only log computed signature in development/staging when there's a mismatch
      if (!signaturesMatch && process.env.NODE_ENV !== 'production') {
        console.log(`🔍 [Webhook Debug] Computed signature: ${computedSignature}`);
        console.log(
          '🔍 [Webhook Debug] Note: Computed signature is only logged in non-production environments'
        );
      }
    }

    // Owner verification for pull_request events (before signature verification for efficiency)
    // Note: This check happens before signature verification to quickly reject unauthorized
    // webhooks and reduce processing overhead. GitHub's signature is still verified after this check.
    if (event.startsWith('pull_request')) {
      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch (parseError) {
        console.error('❌ Error parsing webhook payload:', parseError);
        responded = true;
        res.status(400).json({ error: 'Invalid JSON payload' });
        return;
      }

      const repoOwner = payload.repository?.owner?.login;

      if (!repoOwner) {
        console.warn('⚠️  Missing repository owner in payload');
        responded = true;
        res.status(400).json({ error: 'Missing repository owner information' });
        return;
      }

      if (repoOwner !== 'd7knight2') {
        console.warn(`🚫 Unauthorized webhook: Repository owner '${repoOwner}' is not 'd7knight2'`);
        responded = true;
        res.status(403).json({
          error: 'Forbidden',
          message:
            'This GitHub App only processes pull requests for repositories owned by d7knight2',
        });
        return;
      }
    }

    await webhooks.verifyAndReceive({
      id,
      name: event as any, // GitHub sends various event names, type system can't enumerate all
      signature,
      payload: rawBody,
    });

    console.log(`✅ Webhook verified and processed successfully: ${event} (${id})`);
    responded = true;
    res.status(200).json({ message: 'Webhook received' });
  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);

    // Additional debug logging for signature verification errors
    if (error.message && error.message.includes('signature')) {
      console.error('🔍 [Webhook Debug] Signature verification failed!');
      console.error(`🔍 [Webhook Debug] Error details: ${error.message}`);
      console.error('🔍 [Webhook Debug] Possible causes:');
      console.error('  1. Webhook secret mismatch between GitHub and application');
      console.error('  2. Payload was modified before signature verification');
      console.error('  3. Encoding issues with the payload');
      console.error('  4. Trailing spaces or newlines in the webhook secret');
    }

    if (!responded) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
};

export { webhooks };
