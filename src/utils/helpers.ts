# Utilities for common operations
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
