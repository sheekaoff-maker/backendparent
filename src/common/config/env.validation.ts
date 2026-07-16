/**
 * Fail-fast environment validation.
 *
 * Wired into `ConfigModule.forRoot({ validate: validateEnv })` so the process
 * refuses to boot with a missing or insecure configuration instead of failing
 * later at runtime (or, worse, running with an insecure default).
 */

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_MARKERS = ['change-me', 'change_me', 'your-secret', 'secret-here'];

function looksLikePlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const isProduction = config.NODE_ENV === 'production';

  const requireString = (key: string): string | undefined => {
    const value = config[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`${key} is required`);
      return undefined;
    }
    return value;
  };

  const requireSecret = (key: string): void => {
    const value = requireString(key);
    if (value === undefined) return;
    if (value.length < MIN_SECRET_LENGTH) {
      errors.push(`${key} must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    if (isProduction && looksLikePlaceholder(value)) {
      errors.push(`${key} is still set to a placeholder value — set a real secret in production`);
    }
  };

  requireString('DATABASE_URL');
  requireSecret('JWT_SECRET');
  requireSecret('JWT_REFRESH_SECRET');

  // Symmetric key for encrypting third-party OAuth tokens at rest.
  const encryptionKey = requireString('ENCRYPTION_KEY');
  if (encryptionKey !== undefined) {
    if (encryptionKey.length < MIN_SECRET_LENGTH) {
      errors.push(`ENCRYPTION_KEY must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    if (isProduction && looksLikePlaceholder(encryptionKey)) {
      errors.push('ENCRYPTION_KEY is still set to a placeholder value — set a real key in production');
    }
  }

  const nodeEnv = config.NODE_ENV;
  if (nodeEnv !== undefined && !['development', 'production', 'test'].includes(String(nodeEnv))) {
    errors.push(`NODE_ENV must be one of development|production|test (got "${String(nodeEnv)}")`);
  }

  const port = config.PORT;
  if (port !== undefined) {
    const parsed = Number(port);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      errors.push(`PORT must be a valid port number (got "${String(port)}")`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}\n` +
        'Refusing to start. See .env.example for the required variables.',
    );
  }

  return config;
}
