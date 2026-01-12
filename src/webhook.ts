import { Request, Response } from 'express';
import { Webhooks } from '@octokit/webhooks';
import crypto from 'crypto';
import { handlePullRequest } from './github/pull-request';
import { handleCheckRun } from './github/check-run';
import { logger } from './utils/logger';

// Validate required environment variables
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error('GITHUB_WEBHOOK_SECRET environment variable is required');
}

logger.info('Webhook handler initialized', {
  secretConfigured: !!webhookSecret,
  debugMode: logger.isDebugEnabled(),
});

// Initialize webhooks
const webhooks = new Webhooks({
  secret: webhookSecret,
});

// Pull Request events
webhooks.on('pull_request.opened', async ({ payload }) => {
  logger.webhook('Pull request opened', {
    event: 'pull_request.opened',
    prNumber: payload.pull_request.number,
    repoOwner: payload.repository.owner.login,
    repoName: payload.repository.name,
  });
  await handlePullRequest(payload, 'opened');
});

webhooks.on('pull_request.synchronize', async ({ payload }) => {
  logger.webhook('Pull request synchronized', {
    event: 'pull_request.synchronize',
    prNumber: payload.pull_request.number,
    repoOwner: payload.repository.owner.login,
    repoName: payload.repository.name,
  });
  await handlePullRequest(payload, 'synchronize');
});

webhooks.on('pull_request.reopened', async ({ payload }) => {
  logger.webhook('Pull request reopened', {
    event: 'pull_request.reopened',
    prNumber: payload.pull_request.number,
    repoOwner: payload.repository.owner.login,
    repoName: payload.repository.name,
  });
  await handlePullRequest(payload, 'reopened');
});

// Check run events for CI failures
webhooks.on('check_run.completed', async ({ payload }) => {
  logger.webhook('Check run completed', {
    event: 'check_run.completed',
    checkRunName: payload.check_run.name,
    conclusion: payload.check_run.conclusion,
  });
  await handleCheckRun(payload);
});

// Check suite events
webhooks.on('check_suite.completed', async ({ payload }) => {
  logger.webhook('Check suite completed', {
    event: 'check_suite.completed',
    headBranch: payload.check_suite.head_branch,
    conclusion: payload.check_suite.conclusion,
  });
  // Handle check suite completion if needed
});

// Status events
webhooks.on('status', async ({ payload }) => {
  logger.webhook('Status event', {
    event: 'status',
    context: payload.context,
    state: payload.state,
  });
  // Handle status events if needed
});

// Error handling
webhooks.onError((error) => {
  logger.error('Webhook processing error', {
    error: error.message,
    stack: error.stack,
  });
});

/**
 * Computes HMAC SHA-256 signature for debugging purposes
 */
function computeSignature(secret: string, payload: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

/**
 * Diagnose common signature mismatch causes
 */
function diagnoseSignatureMismatch(
  receivedSignature: string,
  expectedSignature: string,
  rawBody: string
): string[] {
  const suggestions: string[] = [];

  // Check if signature format is correct
  if (!receivedSignature.startsWith('sha256=')) {
    suggestions.push('❌ Received signature is not in sha256 format (should start with "sha256=")');
  }

  // Check if webhook secret might be incorrect
  if (receivedSignature !== expectedSignature) {
    suggestions.push(
      '🔑 Webhook secret mismatch detected. Possible causes:',
      '   • GITHUB_WEBHOOK_SECRET environment variable is incorrect',
      '   • Webhook secret in GitHub App settings does not match',
      '   • Webhook secret was recently changed'
    );
  }

  // Check for payload mutation issues
  if (rawBody.includes('\r\n')) {
    suggestions.push(
      '⚠️  Payload contains CRLF line endings which may indicate line ending conversion',
      '   • This can happen with certain body parsers or proxy configurations'
    );
  }

  // Check for body parser issues
  if (!rawBody || rawBody.length === 0) {
    suggestions.push(
      '📦 Empty payload detected - body parser may have consumed the request body',
      '   • Ensure express.json() has the verify callback to preserve rawBody',
      '   • Check that no middleware is consuming the body before webhook handler'
    );
  }

  // General recommendations
  suggestions.push(
    '💡 Troubleshooting steps:',
    '   1. Verify GITHUB_WEBHOOK_SECRET matches your GitHub App settings',
    '   2. Ensure no middleware is modifying the request body',
    '   3. Check that rawBody is correctly preserved by express.json() verify callback',
    '   4. Enable DEBUG=true to see detailed signature information'
  );

  return suggestions;
}

// Webhook handler for Express
export const webhookHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const id = req.headers['x-github-delivery'] as string;

    // Log incoming webhook with event name and delivery ID
    logger.webhook('Incoming webhook', {
      event,
      deliveryId: id,
      hasSignature: !!signature,
    });

    if (!signature || !event || !id) {
      logger.security('Missing required webhook headers', {
        hasSignature: !!signature,
        hasEvent: !!event,
        hasDeliveryId: !!id,
      });
      return res.status(400).json({ error: 'Missing required webhook headers' });
    }

    // Use rawBody for signature verification, req.body is already parsed JSON
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      logger.security('Missing raw body for verification', {
        event,
        deliveryId: id,
        suggestion: 'Ensure express.json() middleware has verify callback to preserve rawBody',
      });
      return res.status(400).json({
        error: 'Missing raw body for verification',
        suggestion: 'Body parser configuration issue - rawBody not preserved',
      });
    }

    // Debug mode: Log detailed signature information
    if (logger.isDebugEnabled()) {
      const expectedSignature = computeSignature(webhookSecret, rawBody);
      const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

      logger.debug('Webhook signature verification details', {
        receivedSignature: signature,
        expectedSignature,
        payloadHash,
        payloadLength: rawBody.length,
        signatureMatch: signature === expectedSignature,
      });
    }

    // Owner verification for pull_request events (before signature verification for efficiency)
    // Note: This check happens before signature verification to quickly reject unauthorized
    // webhooks and reduce processing overhead. GitHub's signature is still verified after this check.
    if (event.startsWith('pull_request')) {
      const payload = JSON.parse(rawBody);
      const repoOwner = payload.repository?.owner?.login;

      if (!repoOwner) {
        logger.security('Missing repository owner in payload', { event, deliveryId: id });
        return res.status(400).json({ error: 'Missing repository owner information' });
      }

      if (repoOwner !== 'd7knight2') {
        logger.security('Unauthorized repository owner', {
          repoOwner,
          event,
          deliveryId: id,
        });
        return res.status(403).json({
          error: 'Forbidden',
          message:
            'This GitHub App only processes pull requests for repositories owned by d7knight2',
        });
      }
    }

    // Verify signature using Octokit's verifyAndReceive
    try {
      await webhooks.verifyAndReceive({
        id,
        name: event as any, // GitHub sends various event names, type system can't enumerate all
        signature,
        payload: rawBody,
      });

      logger.webhook('Webhook processed successfully', {
        event,
        deliveryId: id,
      });

      return res.status(200).json({ message: 'Webhook received' });
    } catch (verifyError: any) {
      // Enhanced signature verification error handling
      const expectedSignature = computeSignature(webhookSecret, rawBody);
      const isSignatureError =
        verifyError.message?.includes('signature') || verifyError.message?.includes('verify');

      if (isSignatureError) {
        logger.security('Webhook signature verification failed', {
          event,
          deliveryId: id,
          error: verifyError.message,
          receivedSignature: signature,
        });

        // In debug mode, provide detailed diagnostics
        if (logger.isDebugEnabled()) {
          const diagnostics = diagnoseSignatureMismatch(signature, expectedSignature, rawBody);
          logger.debug('Signature mismatch diagnostics', {
            suggestions: diagnostics.join('\n'),
          });
        }

        // Provide actionable error message
        return res.status(401).json({
          error: 'Webhook signature verification failed',
          message: 'The webhook signature could not be verified',
          suggestions: [
            'Verify that GITHUB_WEBHOOK_SECRET matches your GitHub App settings',
            'Ensure the webhook is being sent from GitHub',
            'Check that no middleware is modifying the request body',
            'Enable DEBUG=true for detailed signature information',
          ],
        });
      }

      // Re-throw non-signature errors
      throw verifyError;
    }
  } catch (error: any) {
    logger.error('Error processing webhook', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

export { webhooks };
