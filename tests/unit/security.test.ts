import {
  fetchGitHubIpRanges,
  isValidGitHubIp,
  getClientIp,
  clearIpCache,
  normalizeIpv6MappedIpv4,
} from '../../src/utils/security';
import { Request } from 'express';

// Mock fetch globally
global.fetch = jest.fn();

describe('Security Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.WEBHOOK_IP_FAIL_OPEN;
    delete process.env.TRUST_PROXY;
  });

  describe('fetchGitHubIpRanges', () => {
    it('should fetch IP ranges from GitHub API', async () => {
      clearIpCache();
      const mockIpRanges = ['192.30.252.0/22', '185.199.108.0/22'];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hooks: mockIpRanges }),
      });

      const ranges = await fetchGitHubIpRanges();
      expect(ranges).toEqual(mockIpRanges);
      expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/meta');
    });

    it('should cache IP ranges for 1 hour', async () => {
      clearIpCache();
      const mockIpRanges = ['192.30.252.0/22'];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ hooks: mockIpRanges }),
      });

      // First call should fetch
      const firstCall = await fetchGitHubIpRanges();
      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Second call should use cache (no additional fetch)
      const secondCall = await fetchGitHubIpRanges();
      const finalCallCount = (global.fetch as jest.Mock).mock.calls.length;

      expect(firstCall).toEqual(secondCall);
      expect(finalCallCount).toBe(initialCallCount); // No additional fetch
    });

    it('should handle API errors gracefully when no cache exists', async () => {
      clearIpCache();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchGitHubIpRanges()).rejects.toThrow('GitHub API returned 500');
    });

    it('should use cached ranges if fetch fails and cache exists', async () => {
      // Clear cache to start fresh
      clearIpCache();

      const mockIpRanges = ['192.30.252.0/22', '185.199.108.0/22'];

      // First call: successful fetch to populate cache
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hooks: mockIpRanges }),
      });

      const firstCallRanges = await fetchGitHubIpRanges();
      const fetchCallsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

      expect(firstCallRanges).toEqual(mockIpRanges);

      // Configure fetch to fail if it is called again
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Second call: should return cached ranges without invoking the failing fetch
      const secondCallRanges = await fetchGitHubIpRanges();
      const fetchCallsAfterSecond = (global.fetch as jest.Mock).mock.calls.length;

      expect(secondCallRanges).toEqual(mockIpRanges);
      // Verify no additional fetch was made (cache used instead)
      expect(fetchCallsAfterSecond).toBe(fetchCallsAfterFirst);
    });

    it('should prevent race conditions with concurrent fetches', async () => {
      clearIpCache();
      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockReset(); // Reset to remove any previous mockImplementations

      const mockIpRanges = ['192.30.252.0/22'];

      // Mock a slow fetch
      (global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ hooks: mockIpRanges }),
                }),
              100
            )
          )
      );

      // Start two concurrent fetches
      const promise1 = fetchGitHubIpRanges();
      const promise2 = fetchGitHubIpRanges();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return the same result
      expect(result1).toEqual(mockIpRanges);
      expect(result2).toEqual(mockIpRanges);
      // But fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Reset the mock to clean state for subsequent tests
      (global.fetch as jest.Mock).mockReset();
    });

    it('should clear cache when clearIpCache is called', async () => {
      clearIpCache();
      jest.clearAllMocks();

      // Populate cache
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hooks: ['192.30.252.0/22'] }),
      });
      await fetchGitHubIpRanges();
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);

      // Clear cache
      clearIpCache();
      jest.clearAllMocks();

      // Next call should fetch again
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hooks: ['185.199.108.0/22'] }),
      });
      const newRanges = await fetchGitHubIpRanges();

      // Should have made a new fetch call
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
      expect(newRanges).toEqual(['185.199.108.0/22']);
    });
  });

  describe('isValidGitHubIp', () => {
    beforeEach(async () => {
      // Clear cache to ensure fresh data
      clearIpCache();
      jest.clearAllMocks();

      // Mock successful fetch for each test with IPv6 range included
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          hooks: ['192.30.252.0/22', '185.199.108.0/22', '140.82.112.0/20', '2a0a:a440::/29'],
        }),
      });

      // Force a fresh fetch to populate cache with IPv6 range
      await fetchGitHubIpRanges();
    });

    it('should validate IP in GitHub range (IPv4)', async () => {
      const result = await isValidGitHubIp('192.30.252.1');
      expect(result).toBe(true);
    });

    it('should reject IP not in GitHub range (IPv4)', async () => {
      const result = await isValidGitHubIp('10.0.0.1');
      expect(result).toBe(false);
    });

    it('should validate IP in different GitHub range', async () => {
      const result = await isValidGitHubIp('185.199.108.50');
      expect(result).toBe(true);
    });

    it('should handle empty IP', async () => {
      const result = await isValidGitHubIp('');
      expect(result).toBe(false);
    });

    it('should validate IPv6 addresses in range', async () => {
      // 2a0a:a440::/29 means first 29 bits match
      // This is 2 full groups (32 bits) minus 3 bits
      // So addresses from 2a0a:a440:: to 2a0a:a447:ffff:... should match
      const result = await isValidGitHubIp('2a0a:a440:0:0:0:0:0:1');
      expect(result).toBe(true);
    });

    it('should reject IPv6 addresses not in range', async () => {
      const result = await isValidGitHubIp('2001:db8::1');
      expect(result).toBe(false);
    });

    it('should validate IPv6-mapped IPv4 addresses in GitHub range', async () => {
      // ::ffff:192.30.252.1 should map to 192.30.252.1 which is in 192.30.252.0/22
      const result = await isValidGitHubIp('::ffff:192.30.252.1');
      expect(result).toBe(true);
    });

    it('should validate IPv6-mapped IPv4 addresses in hex notation', async () => {
      // ::ffff:c01e:fc01 should map to 192.30.252.1 which is in 192.30.252.0/22
      const result = await isValidGitHubIp('::ffff:c01e:fc01');
      expect(result).toBe(true);
    });

    it('should validate full format IPv6-mapped IPv4 addresses', async () => {
      // 0:0:0:0:0:ffff:192.30.252.1 should map to 192.30.252.1
      const result = await isValidGitHubIp('0:0:0:0:0:ffff:192.30.252.1');
      expect(result).toBe(true);
    });

    it('should reject IPv6-mapped IPv4 addresses not in GitHub range', async () => {
      // ::ffff:10.0.0.1 should map to 10.0.0.1 which is not in any GitHub range
      const result = await isValidGitHubIp('::ffff:10.0.0.1');
      expect(result).toBe(false);
    });

    it('should reject IPv6-mapped IPv4 addresses in hex notation not in range', async () => {
      // ::ffff:0a00:0001 should map to 10.0.0.1 which is not in any GitHub range
      const result = await isValidGitHubIp('::ffff:0a00:0001');
      expect(result).toBe(false);
    });

    it('should handle case-insensitive IPv6-mapped IPv4 addresses', async () => {
      // ::FFFF:192.30.252.1 should map to 192.30.252.1
      const result = await isValidGitHubIp('::FFFF:192.30.252.1');
      expect(result).toBe(true);
    });

    it('should fail closed by default on error when no cache', async () => {
      // Ensure there is no cached IP data before simulating a network error
      clearIpCache();

      // Simulate a failure when attempting to fetch GitHub IP ranges
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Use an IP that would normally be valid if ranges were available
      const result = await isValidGitHubIp('192.30.252.1');

      // Should fail closed (return false) when no cache and fetch fails
      expect(result).toBe(false);
    });

    it('should fail open when configured', async () => {
      clearIpCache();
      process.env.WEBHOOK_IP_FAIL_OPEN = 'true';
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await isValidGitHubIp('192.30.252.1');
      expect(result).toBe(true);
    });
  });

  describe('normalizeIpv6MappedIpv4', () => {
    it('should normalize ::ffff:x.x.x.x format to IPv4', () => {
      expect(normalizeIpv6MappedIpv4('::ffff:192.0.2.1')).toBe('192.0.2.1');
      expect(normalizeIpv6MappedIpv4('::ffff:192.30.252.1')).toBe('192.30.252.1');
    });

    it('should normalize ::FFFF:x.x.x.x format (case insensitive)', () => {
      expect(normalizeIpv6MappedIpv4('::FFFF:192.0.2.1')).toBe('192.0.2.1');
      expect(normalizeIpv6MappedIpv4('::FfFf:192.0.2.1')).toBe('192.0.2.1');
    });

    it('should normalize full format 0:0:0:0:0:ffff:x.x.x.x', () => {
      expect(normalizeIpv6MappedIpv4('0:0:0:0:0:ffff:192.0.2.1')).toBe('192.0.2.1');
      expect(normalizeIpv6MappedIpv4('0:0:0:0:0:FFFF:192.30.252.1')).toBe('192.30.252.1');
    });

    it('should normalize hex notation ::ffff:xxxx:xxxx to IPv4', () => {
      // c000:0201 = 192.0.2.1
      expect(normalizeIpv6MappedIpv4('::ffff:c000:0201')).toBe('192.0.2.1');
      // c01e:fc01 = 192.30.252.1
      expect(normalizeIpv6MappedIpv4('::ffff:c01e:fc01')).toBe('192.30.252.1');
      // 0a00:0001 = 10.0.0.1
      expect(normalizeIpv6MappedIpv4('::ffff:0a00:0001')).toBe('10.0.0.1');
    });

    it('should handle standard IPv4 addresses (no normalization needed)', () => {
      expect(normalizeIpv6MappedIpv4('192.0.2.1')).toBe('192.0.2.1');
      expect(normalizeIpv6MappedIpv4('10.0.0.1')).toBe('10.0.0.1');
    });

    it('should handle standard IPv6 addresses (no normalization needed)', () => {
      expect(normalizeIpv6MappedIpv4('2001:db8::1')).toBe('2001:db8::1');
      expect(normalizeIpv6MappedIpv4('2a0a:a440:0:0:0:0:0:1')).toBe('2a0a:a440:0:0:0:0:0:1');
    });

    it('should handle edge cases', () => {
      // Empty string
      expect(normalizeIpv6MappedIpv4('')).toBe('');
      // Invalid formats remain unchanged
      expect(normalizeIpv6MappedIpv4('invalid')).toBe('invalid');
      // Non-mapped IPv6 with ffff in different position
      expect(normalizeIpv6MappedIpv4('ffff::1')).toBe('ffff::1');
    });

    it('should reject invalid IPv4 addresses (octets > 255)', () => {
      // IPv4 addresses with octets > 255 should not be normalized
      expect(normalizeIpv6MappedIpv4('::ffff:300.400.500.600')).toBe('::ffff:300.400.500.600');
      expect(normalizeIpv6MappedIpv4('::ffff:256.0.0.1')).toBe('::ffff:256.0.0.1');
      expect(normalizeIpv6MappedIpv4('0:0:0:0:0:ffff:300.1.2.3')).toBe('0:0:0:0:0:ffff:300.1.2.3');
    });

    it('should handle boundary IPv4 values (0 and 255)', () => {
      // Valid boundary values should normalize correctly
      expect(normalizeIpv6MappedIpv4('::ffff:0.0.0.0')).toBe('0.0.0.0');
      expect(normalizeIpv6MappedIpv4('::ffff:255.255.255.255')).toBe('255.255.255.255');
      expect(normalizeIpv6MappedIpv4('0:0:0:0:0:ffff:192.0.0.255')).toBe('192.0.0.255');
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from X-Forwarded-For header when TRUST_PROXY is enabled', () => {
      process.env.TRUST_PROXY = 'true';
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.1',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('203.0.113.1');
    });

    it('should extract IP from X-Real-IP header when TRUST_PROXY is enabled', () => {
      process.env.TRUST_PROXY = 'true';
      const req = {
        headers: {
          'x-real-ip': '203.0.113.1',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('203.0.113.1');
    });

    it('should ignore proxy headers when TRUST_PROXY is not enabled', () => {
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.1',
          'x-real-ip': '203.0.113.2',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('10.0.0.1'); // Should use socket address instead
    });

    it('should fall back to socket remoteAddress', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.30.252.1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('192.30.252.1');
    });

    it('should handle missing socket address', () => {
      const req = {
        headers: {},
        socket: {},
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('');
    });

    it('should handle array X-Forwarded-For header when TRUST_PROXY is enabled', () => {
      process.env.TRUST_PROXY = 'true';
      const req = {
        headers: {
          'x-forwarded-for': ['203.0.113.1, 198.51.100.1'],
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('203.0.113.1');
    });
  });
});
