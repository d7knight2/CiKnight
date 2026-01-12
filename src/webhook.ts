import { Request, Response } from 'express';
import { Webhooks } from '@octokit/webhooks';
import { createHmac } from 'crypto';
import { handlePullRequest } from './github/pull-request';
import { handleCheckRun } from './github/check-run';

// Validate required environment variables
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error('GITHUB_WEBHOOK_SECRET environment variable is required');
}

/**
 * Calculate the expected signature for webhook verification
 */
function calculateExpectedSignature(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Detect common causes of signature mismatches and provide actionable suggestions
 */
function detectSignatureMismatch(
  receivedSignature: string,
  expectedSignature: string,
  payload: string
): string[] {
  const suggestions: string[] = [];

  // Check if signatures are completely different (likely wrong secret)
  if (receivedSignature && expectedSignature && receivedSignature !== expectedSignature) {
    suggestions.push('❌ Signature mismatch detected');
    suggestions.push(
      '💡 Possible causes:\n' +
        '   1. Incorrect GITHUB_WEBHOOK_SECRET - Verify the secret matches your GitHub App configuration\n' +
        '   2. Payload mutation - Check if body-parser middleware is modifying the request body\n' +
        '   3. Double-parsing - Ensure only one JSON parser is processing the webhook'
    );
  }

  // Check for signs of payload mutation (missing rawBody or empty payload)
  if (!payload || payload.length === 0) {
    suggestions.push(
      '⚠️  Empty or missing payload detected\n' +
        '💡 This usually indicates double-parsing or missing rawBody middleware'
    );
  }

  // Check if payload looks like it was parsed and re-stringified
  // Check if payload looks like it was parsed and re-stringified
  // Note: This comparison may have false positives due to JSON key ordering differences
  // or whitespace variations. It's intended as a heuristic to detect obvious mutations.
  try {
    const parsed = JSON.parse(payload);
    const reStringified = JSON.stringify(parsed);
    if (reStringified !== payload) {
      suggestions.push(
        '⚠️  Payload appears to have been modified (spacing/formatting changes)\n' +
          '💡 Ensure express.json middleware uses the "verify" option to preserve rawBody'
      );
    }
  } catch {
    suggestions.push(
      '⚠️  Payload is not valid JSON - this will cause signature verification to fail'
    );
  }

  return suggestions;
}

/**
 * Log structured debugging information for webhook verification
 */
function logDebugInfo(
  event: string,
  deliveryId: string,
  receivedSignature: string,
  expectedSignature: string,
  payloadHash: string
): void {
  // Check debug mode at runtime to allow dynamic enabling
  const isDebugMode = process.env.WEBHOOK_DEBUG === 'true';
  if (!isDebugMode) return;

  console.log('🔍 [DEBUG] Webhook Verification Details:');
  console.log(`   Event: ${event}`);
  console.log(`   Delivery ID: ${deliveryId}`);
  console.log(`   Received Signature: ${receivedSignature}`);
  console.log(`   Expected Signature: ${expectedSignature}`);
  console.log(`   Payload Hash (SHA-256): ${payloadHash}`);
  console.log(`   Signatures Match: ${receivedSignature === expectedSignature}`);
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
export const webhookHandler = async (req: Request, res: Response): Promise<Response> => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const event = req.headers['x-github-event'] as string;
  const id = req.headers['x-github-delivery'] as string;

  // Enhanced logging: Log all webhook attempts with event and delivery ID
  console.log(`📬 Webhook received: event=${event}, delivery_id=${id}`);

  try {
    if (!signature || !event || !id) {
      console.warn(
        `⚠️  Missing required headers: signature=${!!signature}, event=${!!event}, id=${!!id}`
      );
      return res.status(400).json({ error: 'Missing required webhook headers' });
    }

    // Use rawBody for signature verification, req.body is already parsed JSON
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.error(
        '❌ Missing raw body for verification - check body-parser middleware configuration'
      );
      console.error('💡 Ensure express.json() uses the "verify" option to preserve rawBody');
      return res.status(400).json({ error: 'Missing raw body for verification' });
    }

    // Debug mode: Log verification details
    const isDebugMode = process.env.WEBHOOK_DEBUG === 'true';
    if (isDebugMode) {
      const expectedSignature = calculateExpectedSignature(rawBody, webhookSecret);
      const payloadHash = createHmac('sha256', rawBody).digest('hex');
      logDebugInfo(event, id, signature, expectedSignature, payloadHash);
    }

    // Owner verification for pull_request events (before signature verification for efficiency)
    // Note: This check happens before signature verification to quickly reject unauthorized
    // webhooks and reduce processing overhead. GitHub's signature is still verified after this check.
    if (event.startsWith('pull_request')) {
      const payload = JSON.parse(rawBody);
      const repoOwner = payload.repository?.owner?.login;

      if (!repoOwner) {
        console.warn('⚠️  Missing repository owner in payload');
        return res.status(400).json({ error: 'Missing repository owner information' });
      }

      if (repoOwner !== 'd7knight2') {
        console.warn(
          `🚫 Unauthorized webhook: event=${event}, delivery_id=${id}, owner=${repoOwner} (expected: d7knight2)`
        );
        return res.status(403).json({
          error: 'Forbidden',
          message:
            'This GitHub App only processes pull requests for repositories owned by d7knight2',
        });
      }
    }

    // Verify signature and process webhook
    await webhooks.verifyAndReceive({
      id,
      name: event as any, // GitHub sends various event names, type system can't enumerate all
      signature,
      payload: rawBody,
    });

    console.log(`✅ Webhook verified and processed: event=${event}, delivery_id=${id}`);
    return res.status(200).json({ message: 'Webhook received' });
  } catch (error: any) {
    // Enhanced error logging for signature verification failures
    console.error(`❌ Webhook processing failed: event=${event}, delivery_id=${id}`);
    console.error(`   Error: ${error.message}`);

    // Detect and log common signature mismatch causes
    if (error.message && error.message.includes('signature')) {
      const rawBody = (req as any).rawBody || '';
      const expectedSignature = calculateExpectedSignature(rawBody, webhookSecret);
      const suggestions = detectSignatureMismatch(signature, expectedSignature, rawBody);

      suggestions.forEach((suggestion) => console.error(suggestion));

      // Suggest enabling debug mode if not already enabled
      if (process.env.WEBHOOK_DEBUG !== 'true') {
        console.error('💡 Enable WEBHOOK_DEBUG=true for detailed signature verification logs');
      }
    }

    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

export { webhooks };
