/**
 * Centralised Redis connection config.
 *
 * Supports two styles:
 *   1. REDIS_URL (preferred — Railway / Heroku / Upstash provide this)
 *      e.g. redis://default:password@host:6379
 *   2. Individual REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_USERNAME vars
 *
 * Both shapes are returned so callers can pick what their library wants.
 */

export interface RedisConfig {
  /** Full URL — pass to libraries that accept a URL (cache-manager-redis-yet) */
  url?: string;
  /** Host/port/password/username — for libraries that need split fields (BullMQ/ioredis) */
  host: string;
  port: number;
  username?: string;
  password?: string;
  /** Whether the connection should be TLS (rediss://) */
  tls: boolean;
}

export function getRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL;
  if (url) {
    try {
      const u = new URL(url);
      return {
        url,
        host: u.hostname,
        port: parseInt(u.port || '6379', 10),
        username: u.username || undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
        tls: u.protocol === 'rediss:',
      };
    } catch {
      // fall through to env-vars
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true',
  };
}

/**
 * Socket-level tuning for `cache-manager-redis-yet` (node-redis v4 under the
 * hood) — used by every CacheModule.registerAsync() block. Without an
 * explicit connectTimeout, a network blip can hang a cache read/write far
 * longer than the request itself should ever take; without a bounded
 * reconnectStrategy, node-redis retries forever with no cap.
 */
export function getRedisCacheSocketOptions() {
  return {
    connectTimeout: 5000,
    reconnectStrategy: (retries: number) => Math.min(retries * 200, 3000),
  };
}

/**
 * ioredis-level tuning for BullMQ's dedicated connection.
 * `maxRetriesPerRequest: null` is BullMQ's own documented requirement — it
 * issues blocking commands (BRPOPLPUSH etc.) that must be allowed to wait
 * indefinitely rather than erroring out after ioredis's default retry cap.
 */
export function getRedisIoredisOptions() {
  return {
    connectTimeout: 5000,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: true,
    retryStrategy: (times: number) => Math.min(times * 200, 3000),
  };
}
