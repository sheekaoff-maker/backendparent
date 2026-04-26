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
