import {
  fetchGitHubIpRanges,
  isValidGitHubIp,
  getClientIp,
  clearIpCache,
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

    it('should normalize and validate IPv6-mapped IPv4 addresses', async () => {
      // ::ffff:192.30.252.1 should be normalized to 192.30.252.1 and validated against IPv4 ranges
      const result = await isValidGitHubIp('::ffff:192.30.252.1');
      expect(result).toBe(true);
    });

    it('should normalize and reject IPv6-mapped IPv4 addresses not in range', async () => {
      // ::ffff:10.0.0.1 should be normalized to 10.0.0.1 and rejected
      const result = await isValidGitHubIp('::ffff:10.0.0.1');
      expect(result).toBe(false);
    });

    it('should handle IPv6-mapped IPv4 addresses in different GitHub ranges', async () => {
      // ::ffff:185.199.108.50 should be normalized to 185.199.108.50 and validated
      const result = await isValidGitHubIp('::ffff:185.199.108.50');
      expect(result).toBe(true);
    });

    it('should handle uppercase IPv6-mapped IPv4 addresses', async () => {
      // ::FFFF:192.30.252.1 (uppercase) should be normalized and validated
      const result = await isValidGitHubIp('::FFFF:192.30.252.1');
      expect(result).toBe(true);
    });

    it('should not normalize invalid IPv6-mapped IPv4 addresses with out-of-range octets', async () => {
      // ::ffff:999.999.999.999 should not be normalized (invalid IPv4 octets)
      const result = await isValidGitHubIp('::ffff:999.999.999.999');
      expect(result).toBe(false);
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

    describe('Invalid IP Address Rejection', () => {
      it('should reject link-local IPv4 addresses (169.254.x.x)', async () => {
        const result = await isValidGitHubIp('169.254.169.126');
        expect(result).toBe(false);
      });

      it('should reject link-local IPv4 addresses at range start', async () => {
        const result = await isValidGitHubIp('169.254.0.0');
        expect(result).toBe(false);
      });

      it('should reject link-local IPv4 addresses at range end', async () => {
        const result = await isValidGitHubIp('169.254.255.255');
        expect(result).toBe(false);
      });

      it('should reject loopback IPv4 addresses (127.0.0.0/8)', async () => {
        const result = await isValidGitHubIp('127.0.0.1');
        expect(result).toBe(false);
      });

      it('should reject loopback IPv4 addresses in full range', async () => {
        const result = await isValidGitHubIp('127.1.2.3');
        expect(result).toBe(false);
      });

      it('should reject private IPv4 addresses (10.0.0.0/8)', async () => {
        const result = await isValidGitHubIp('10.0.0.1');
        expect(result).toBe(false);
      });

      it('should reject private IPv4 addresses (172.16.0.0/12)', async () => {
        const result = await isValidGitHubIp('172.16.0.1');
        expect(result).toBe(false);
      });

      it('should reject private IPv4 addresses in 172.16-31 range', async () => {
        const result = await isValidGitHubIp('172.31.255.255');
        expect(result).toBe(false);
      });

      it('should reject private IPv4 addresses (192.168.0.0/16)', async () => {
        const result = await isValidGitHubIp('192.168.1.1');
        expect(result).toBe(false);
      });

      it('should reject unspecified IPv4 address (0.0.0.0)', async () => {
        const result = await isValidGitHubIp('0.0.0.0');
        expect(result).toBe(false);
      });

      it('should reject broadcast IPv4 address (255.255.255.255)', async () => {
        const result = await isValidGitHubIp('255.255.255.255');
        expect(result).toBe(false);
      });

      it('should reject multicast IPv4 addresses (224.0.0.0/4)', async () => {
        const result = await isValidGitHubIp('224.0.0.1');
        expect(result).toBe(false);
      });

      it('should reject multicast IPv4 addresses at range end', async () => {
        const result = await isValidGitHubIp('239.255.255.255');
        expect(result).toBe(false);
      });

      it('should reject loopback IPv6 address (::1)', async () => {
        const result = await isValidGitHubIp('::1');
        expect(result).toBe(false);
      });

      it('should reject loopback IPv6 address (full notation)', async () => {
        const result = await isValidGitHubIp('0:0:0:0:0:0:0:1');
        expect(result).toBe(false);
      });

      it('should reject unspecified IPv6 address (::)', async () => {
        const result = await isValidGitHubIp('::');
        expect(result).toBe(false);
      });

      it('should reject link-local IPv6 addresses (fe80::/10)', async () => {
        const result = await isValidGitHubIp('fe80::1');
        expect(result).toBe(false);
      });

      it('should reject link-local IPv6 addresses at upper range (feb0::/10)', async () => {
        const result = await isValidGitHubIp('feb0::1');
        expect(result).toBe(false);
      });

      it('should reject unique local IPv6 addresses (fc00::/7)', async () => {
        const result = await isValidGitHubIp('fc00::1');
        expect(result).toBe(false);
      });

      it('should reject unique local IPv6 addresses (fd00::/8)', async () => {
        const result = await isValidGitHubIp('fd00::1');
        expect(result).toBe(false);
      });

      it('should reject multicast IPv6 addresses (ff00::/8)', async () => {
        const result = await isValidGitHubIp('ff00::1');
        expect(result).toBe(false);
      });

      it('should reject IPv6-mapped IPv4 loopback addresses', async () => {
        const result = await isValidGitHubIp('::ffff:127.0.0.1');
        expect(result).toBe(false);
      });

      it('should reject IPv6-mapped IPv4 link-local addresses', async () => {
        const result = await isValidGitHubIp('::ffff:169.254.169.126');
        expect(result).toBe(false);
      });

      it('should reject IPv6-mapped IPv4 private addresses', async () => {
        const result = await isValidGitHubIp('::ffff:192.168.1.1');
        expect(result).toBe(false);
      });

      it('should reject malformed IPv4 addresses with invalid octets', async () => {
        const result = await isValidGitHubIp('999.999.999.999');
        expect(result).toBe(false);
      });

      it('should reject malformed IPv4 addresses with too few octets', async () => {
        const result = await isValidGitHubIp('192.168.1');
        expect(result).toBe(false);
      });
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

    it('should normalize IPv6-mapped IPv4 addresses from socket', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '::ffff:192.30.252.1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('192.30.252.1');
    });

    it('should normalize IPv6-mapped IPv4 addresses from X-Forwarded-For header', () => {
      process.env.TRUST_PROXY = 'true';
      const req = {
        headers: {
          'x-forwarded-for': '::ffff:203.0.113.1',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('203.0.113.1');
    });

    it('should normalize IPv6-mapped IPv4 addresses from X-Real-IP header', () => {
      process.env.TRUST_PROXY = 'true';
      const req = {
        headers: {
          'x-real-ip': '::ffff:203.0.113.1',
        },
        socket: { remoteAddress: '10.0.0.1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('203.0.113.1');
    });

    it('should preserve regular IPv4 addresses', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.30.252.1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('192.30.252.1');
    });

    it('should preserve regular IPv6 addresses', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '2a0a:a440:0:0:0:0:0:1' },
      } as unknown as Request;

      const ip = getClientIp(req);
      expect(ip).toBe('2a0a:a440:0:0:0:0:0:1');
    });
  });
});
