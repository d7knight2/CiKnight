import { Request } from 'express';

// GitHub Meta API response type
interface GitHubMeta {
  hooks?: string[];
  web?: string[];
  api?: string[];
  git?: string[];
  packages?: string[];
  pages?: string[];
  importer?: string[];
  actions?: string[];
  dependabot?: string[];
}

// Cache for GitHub IP ranges
let ipRangesCache: string[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds
let fetchInProgress: Promise<string[]> | null = null;

/**
 * Clear the IP ranges cache (useful for testing)
 * @internal
 */
export function clearIpCache(): void {
  ipRangesCache = [];
  lastFetchTime = 0;
  fetchInProgress = null;
}

/**
 * Fetches GitHub's webhook IP ranges from the GitHub Meta API
 * Results are cached for 1 hour to reduce API calls
 * Prevents race conditions by ensuring only one fetch happens at a time
 */
export async function fetchGitHubIpRanges(): Promise<string[]> {
  const now = Date.now();

  // Return cached ranges if still valid
  if (ipRangesCache.length > 0 && now - lastFetchTime < CACHE_DURATION) {
    return ipRangesCache;
  }

  // If a fetch is already in progress, wait for it
  if (fetchInProgress) {
    return fetchInProgress;
  }

  // Start a new fetch and store the promise
  fetchInProgress = (async () => {
    try {
      const response = await fetch('https://api.github.com/meta');
      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const data = (await response.json()) as GitHubMeta;
      ipRangesCache = data.hooks || [];
      lastFetchTime = now;

      console.log(`✅ Fetched ${ipRangesCache.length} GitHub webhook IP ranges`);
      return ipRangesCache;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Error fetching GitHub IP ranges:', message);
      // If we have cached ranges, use them even if expired
      if (ipRangesCache.length > 0) {
        console.log('⚠️  Using cached IP ranges due to fetch error');
        return ipRangesCache;
      }
      throw error;
    } finally {
      fetchInProgress = null;
    }
  })();

  return fetchInProgress;
}

/**
 * Normalizes IPv6-mapped IPv4 addresses to their IPv4 representation
 * E.g., ::ffff:192.0.2.1 -> 192.0.2.1
 * @param ip - The IP address to normalize
 * @returns The normalized IP address
 * @internal
 */
export function normalizeIpv6MappedIpv4(ip: string): string {
  // IPv4 octet pattern: matches 0-255 only
  const ipv4Pattern =
    '(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';

  // Check for IPv6-mapped IPv4 address format: ::ffff:x.x.x.x or ::FFFF:x.x.x.x
  const mappedRegex = new RegExp(`^::ffff:(${ipv4Pattern})$`, 'i');
  const mappedMatch = ip.match(mappedRegex);
  if (mappedMatch) {
    return mappedMatch[1];
  }

  // Check for full IPv6-mapped IPv4 format: 0:0:0:0:0:ffff:x.x.x.x
  const fullMappedRegex = new RegExp(`^0:0:0:0:0:ffff:(${ipv4Pattern})$`, 'i');
  const fullMappedMatch = ip.match(fullMappedRegex);
  if (fullMappedMatch) {
    return fullMappedMatch[1];
  }

  // Check for IPv6-mapped IPv4 in hex notation: ::ffff:c000:0201 -> 192.0.2.1
  const hexMappedMatch = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMappedMatch) {
    const high = parseInt(hexMappedMatch[1], 16);
    const low = parseInt(hexMappedMatch[2], 16);
    const octet1 = (high >> 8) & 0xff;
    const octet2 = high & 0xff;
    const octet3 = (low >> 8) & 0xff;
    const octet4 = low & 0xff;
    return `${octet1}.${octet2}.${octet3}.${octet4}`;
  }

  // No mapping needed, return original
  return ip;
}

/**
 * Checks if an IP address is within a CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  // Normalize IPv6-mapped IPv4 addresses before checking
  const normalizedIp = normalizeIpv6MappedIpv4(ip);

  // Handle IPv4
  if (normalizedIp.includes('.') && cidr.includes('.')) {
    const [range, bits] = cidr.split('/');
    // Calculate IPv4 CIDR mask: ~(2^(32-prefix_bits) - 1) converts prefix to netmask
    // Example: /24 -> ~(2^8 - 1) = ~255 = 0xFFFFFF00
    // Using bit shifting for more explicit unsigned integer handling
    const mask = bits ? (-1 << (32 - parseInt(bits))) >>> 0 : 0xffffffff;

    const ipNum =
      normalizedIp.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;

    return (ipNum & mask) === (rangeNum & mask);
  }

  // Handle IPv6 (standard IPv6 addresses)
  // Note: IPv6-mapped IPv4 addresses are normalized to IPv4 format above.
  // This section handles standard IPv6 CIDR matching for GitHub's webhook IP ranges.
  if (normalizedIp.includes(':') && cidr.includes(':')) {
    // For simplicity, we'll do a basic prefix match
    const [range, bits] = cidr.split('/');
    if (!bits) return normalizedIp === range;

    // Normalize IPv6 addresses
    const normalizeIPv6 = (addr: string): string => {
      // Handle :: expansion
      if (addr.includes('::')) {
        const parts = addr.split('::');
        const leftParts = parts[0] ? parts[0].split(':') : [];
        const rightParts = parts[1] ? parts[1].split(':') : [];
        const missingZeros = 8 - leftParts.length - rightParts.length;
        const middle = Array(missingZeros).fill('0000');
        const allParts = [...leftParts, ...middle, ...rightParts];
        return allParts.map((p) => p.padStart(4, '0')).join(':');
      }
      return addr
        .split(':')
        .map((p) => p.padStart(4, '0'))
        .join(':');
    };

    const normalizedIpv6 = normalizeIPv6(normalizedIp);
    const normalizedRange = normalizeIPv6(range);

    // Compare based on prefix length
    const prefixLength = parseInt(bits);
    const hexGroups = Math.floor(prefixLength / 16);
    const remainingBits = prefixLength % 16;

    const ipParts = normalizedIpv6.split(':');
    const rangeParts = normalizedRange.split(':');

    // Compare full hex groups
    for (let i = 0; i < hexGroups; i++) {
      if (ipParts[i] !== rangeParts[i]) return false;
    }

    // Compare remaining bits if any
    if (remainingBits > 0 && hexGroups < 8) {
      // Bounds checking prevents undefined access when IPv6 addresses have
      // insufficient hex groups. This can happen with malformed addresses or
      // edge cases in the normalization logic.
      if (hexGroups >= ipParts.length || hexGroups >= rangeParts.length) {
        return false;
      }
      const ipHex = parseInt(ipParts[hexGroups], 16);
      const rangeHex = parseInt(rangeParts[hexGroups], 16);
      const mask = (0xffff << (16 - remainingBits)) & 0xffff;

      if ((ipHex & mask) !== (rangeHex & mask)) return false;
    }

    return true;
  }

  return false;
}

/**
 * Validates if the request IP is from GitHub's webhook IP ranges
 */
export async function isValidGitHubIp(ip: string): Promise<boolean> {
  if (!ip) return false;

  try {
    const ipRanges = await fetchGitHubIpRanges();

    // Check if IP is in any of the allowed ranges
    for (const cidr of ipRanges) {
      if (isIpInCidr(ip, cidr)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Error validating GitHub IP:', error);
    // Fail open if we can't validate (configurable via env var)
    const failOpen = process.env.WEBHOOK_IP_FAIL_OPEN === 'true';
    if (failOpen) {
      console.log('⚠️  IP validation failed, allowing request (fail-open mode)');
      return true;
    }
    return false;
  }
}

/**
 * Extracts the client IP from the request, considering proxies
 * Note: Only trusts proxy headers when TRUST_PROXY environment variable is set to 'true'.
 * This prevents header spoofing attacks in direct connections.
 */
export function getClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';

  // Only trust forwarding headers if explicitly configured
  if (trustProxy) {
    // Check for X-Forwarded-For header (common in proxied environments)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check for X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }
  }

  // Fall back to socket address (always trusted)
  return req.socket.remoteAddress || '';
}

// Note: Webhook signature verification is handled by @octokit/webhooks.verifyAndReceive
// in src/webhook.ts, which provides built-in HMAC SHA-256 validation.
