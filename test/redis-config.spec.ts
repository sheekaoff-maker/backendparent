import { getRedisConfig, getRedisCacheSocketOptions, getRedisIoredisOptions } from '../src/common/redis-config';

describe('getRedisCacheSocketOptions', () => {
  it('sets a bounded connect timeout', () => {
    const opts = getRedisCacheSocketOptions();
    expect(opts.connectTimeout).toBe(5000);
  });

  it('caps the reconnect backoff instead of retrying forever unbounded', () => {
    const opts = getRedisCacheSocketOptions();
    expect(opts.reconnectStrategy(1)).toBe(200);
    expect(opts.reconnectStrategy(50)).toBe(3000); // capped, not 10000
  });
});

describe('getRedisIoredisOptions', () => {
  it('disables maxRetriesPerRequest as BullMQ requires for blocking commands', () => {
    const opts = getRedisIoredisOptions();
    expect(opts.maxRetriesPerRequest).toBeNull();
  });

  it('caps the retry backoff', () => {
    const opts = getRedisIoredisOptions();
    expect(opts.retryStrategy(1)).toBe(200);
    expect(opts.retryStrategy(100)).toBe(3000);
  });
});

describe('getRedisConfig', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => { process.env = { ...ORIGINAL_ENV }; });
  afterAll(() => { process.env = ORIGINAL_ENV; });

  it('parses REDIS_URL into host/port/credentials', () => {
    process.env.REDIS_URL = 'redis://user:pass@myhost:6380';
    delete process.env.REDIS_PUBLIC_URL;
    const cfg = getRedisConfig();
    expect(cfg.host).toBe('myhost');
    expect(cfg.port).toBe(6380);
    expect(cfg.username).toBe('user');
    expect(cfg.password).toBe('pass');
    expect(cfg.tls).toBe(false);
  });

  it('detects TLS from a rediss:// URL', () => {
    process.env.REDIS_URL = 'rediss://myhost:6380';
    const cfg = getRedisConfig();
    expect(cfg.tls).toBe(true);
  });

  it('falls back to discrete env vars when no URL is set', () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_PUBLIC_URL;
    process.env.REDIS_HOST = 'discrete-host';
    process.env.REDIS_PORT = '7000';
    const cfg = getRedisConfig();
    expect(cfg.host).toBe('discrete-host');
    expect(cfg.port).toBe(7000);
    expect(cfg.url).toBeUndefined();
  });

  it('falls back to discrete env vars when REDIS_URL is malformed', () => {
    process.env.REDIS_URL = 'not-a-valid-url';
    process.env.REDIS_HOST = 'fallback-host';
    const cfg = getRedisConfig();
    expect(cfg.host).toBe('fallback-host');
  });
});
