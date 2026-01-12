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
 * Regex pattern for matching IPv6-mapped IPv4 addresses (::ffff:X.X.X.X)
 * Each octet is validated to be in the range 0-255
 */
const IPV6_MAPPED_IPV4_REGEX = (() => {
  // Pattern to match a single IPv4 octet (0-255)
  const octet = '(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';
  return new RegExp(`^::ffff:${octet}\\.${octet}\\.${octet}\\.${octet}$`, 'i');
})();

/**
 * Normalizes IPv6-mapped IPv4 addresses to their IPv4 equivalents
 * Converts addresses like ::ffff:192.0.2.1 to 192.0.2.1
 */
function normalizeIpv6MappedIpv4(ip: string): string {
  // Check if it's an IPv6-mapped IPv4 address (::ffff:X.X.X.X format)
  const match = ip.match(IPV6_MAPPED_IPV4_REGEX);

  if (match) {
    // Return the IPv4 part (octets 1-4 from regex capture groups)
    return `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
  }

  return ip; // Return original IP if not IPv6-mapped IPv4
}

/**
 * Checks if an IP address is within a CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  // Handle IPv4
  if (ip.includes('.') && cidr.includes('.')) {
    const [range, bits] = cidr.split('/');
    // Calculate IPv4 CIDR mask: ~(2^(32-prefix_bits) - 1) converts prefix to netmask
    // Example: /24 -> ~(2^8 - 1) = ~255 = 0xFFFFFF00
    // Using bit shifting for more explicit unsigned integer handling
    const mask = bits ? (-1 << (32 - parseInt(bits))) >>> 0 : 0xffffffff;

    const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;

    return (ipNum & mask) === (rangeNum & mask);
  }

  // Handle IPv6 (basic implementation)
  // Note: This handles standard IPv6 CIDR matching for GitHub's webhook IP ranges.
  // IPv4-mapped IPv6 addresses (e.g., ::ffff:192.0.2.1) are normalized to IPv4
  // by the normalizeIpv6MappedIpv4 function before reaching this point.
  if (ip.includes(':') && cidr.includes(':')) {
    // For simplicity, we'll do a basic prefix match
    const [range, bits] = cidr.split('/');
    if (!bits) return ip === range;

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

    const normalizedIp = normalizeIPv6(ip);
    const normalizedRange = normalizeIPv6(range);

    // Compare based on prefix length
    const prefixLength = parseInt(bits);
    const hexGroups = Math.floor(prefixLength / 16);
    const remainingBits = prefixLength % 16;

    const ipParts = normalizedIp.split(':');
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
 * Checks if an IP address is invalid/restricted (private, loopback, link-local, etc.)
 * Returns true if the IP should be rejected
 */
function isInvalidIp(ip: string): boolean {
  // Handle IPv4
  if (ip.includes('.') && !ip.includes(':')) {
    const octets = ip.split('.').map((octet) => parseInt(octet, 10));
    if (octets.length !== 4 || octets.some((octet) => isNaN(octet) || octet < 0 || octet > 255)) {
      return true; // Malformed IPv4
    }

    // Loopback: 127.0.0.0/8
    if (octets[0] === 127) return true;

    // Link-local: 169.254.0.0/16
    if (octets[0] === 169 && octets[1] === 254) return true;

    // Private ranges
    // 10.0.0.0/8
    if (octets[0] === 10) return true;
    // 172.16.0.0/12
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) return true;

    // Unspecified: 0.0.0.0
    if (octets.every((octet) => octet === 0)) return true;

    // Broadcast: 255.255.255.255
    if (octets.every((octet) => octet === 255)) return true;

    // Multicast: 224.0.0.0/4
    if (octets[0] >= 224 && octets[0] <= 239) return true;
  }

  // Handle IPv6
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();

    // Loopback: ::1
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

    // Unspecified: ::
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;

    // Link-local: fe80::/10
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9'))
      return true;

    // Unique local addresses (private): fc00::/7
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

    // Multicast: ff00::/8
    if (lower.startsWith('ff')) return true;
  }

  return false;
}

/**
 * Validates if the request IP is from GitHub's webhook IP ranges
 */
export async function isValidGitHubIp(ip: string): Promise<boolean> {
  if (!ip) return false;

  try {
    // Normalize IPv6-mapped IPv4 addresses to their IPv4 equivalents
    const normalizedIp = normalizeIpv6MappedIpv4(ip);

    // Reject invalid/restricted IP addresses
    if (isInvalidIp(normalizedIp)) {
      console.log(`🚫 Rejected invalid/restricted IP address: ${normalizedIp}`);
      return false;
    }

    const ipRanges = await fetchGitHubIpRanges();

    // Check if IP is in any of the allowed ranges
    for (const cidr of ipRanges) {
      if (isIpInCidr(normalizedIp, cidr)) {
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

  let clientIp = '';

  // Only trust forwarding headers if explicitly configured
  if (trustProxy) {
    // Check for X-Forwarded-For header (common in proxied environments)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      clientIp = ips.split(',')[0].trim();
    }

    // Check for X-Real-IP header
    if (!clientIp) {
      const realIp = req.headers['x-real-ip'];
      if (realIp) {
        clientIp = Array.isArray(realIp) ? realIp[0] : realIp;
      }
    }
  }

  // Fall back to socket address (always trusted)
  if (!clientIp) {
    clientIp = req.socket.remoteAddress || '';
  }

  // Normalize IPv6-mapped IPv4 addresses to their IPv4 equivalents
  return normalizeIpv6MappedIpv4(clientIp);
}

// Note: Webhook signature verification is handled by @octokit/webhooks.verifyAndReceive
// in src/webhook.ts, which provides built-in HMAC SHA-256 validation.
