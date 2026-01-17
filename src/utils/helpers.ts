import crypto from 'crypto';

// Utilities for common operations
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parsePrivateKey(key: string): string {
  // Handle private keys with escaped newlines
  return key.replace(/\\n/g, '\n');
}

/**
 * Compute HMAC SHA-256 signature for webhook payload verification
 * @param secret - The webhook secret
 * @param payload - The raw payload string
 * @returns The computed signature in the format "sha256=<hex>"
 */
export function computeWebhookSignature(secret: string, payload: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}
