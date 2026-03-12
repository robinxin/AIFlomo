/**
 * Environment variable validation
 *
 * Called at server startup to ensure all required environment variables
 * are present before any connections are established. Fails fast with a
 * clear error message listing every missing variable so operators never
 * debug a half-started process.
 */

const REQUIRED_VARS = [
  'SESSION_SECRET',
  'DB_PATH',
  'CORS_ORIGIN',
];

/**
 * Validates that all required environment variables are set.
 *
 * @throws {Error} If any required variable is missing.
 */
export function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Copy .env.example to .env and fill in the values.'
    );
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret && sessionSecret.length < 64) {
    throw new Error(
      'SESSION_SECRET must be at least 64 characters long. ' +
        'Generate one with: node -e "const c=require(\'crypto\');console.log(c.randomBytes(32).toString(\'hex\'))"'
    );
  }
}
