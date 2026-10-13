/**
 * Typed configuration loader for AegisAI.
 *
 * Reads required configuration from environment variables and fails
 * loudly (at startup) if anything required is missing, rather than
 * letting a service limp along with undefined config.
 *
 * Phase 0 scope: only the variables needed for the foundation
 * (server port, CORS, and the three datastore URLs + JWT basics).
 * Later phases may extend this module but should not silently
 * broaden its contract.
 */

export interface AegisAIConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  mongodbUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  /**
   * Base URL of the legacy SOAP mock service (Phase 10). Optional
   * and defaulted — unlike every other field here, most services
   * never touch this; only Identity's `LegacyEmployeeClient` does.
   * Defaults to the local dev port `soap-mock/server/index.js`
   * listens on; overridden in Docker Compose to the `soap-mock`
   * service's container hostname.
   */
  soapMockUrl: string;
}

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new ConfigError(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and set a value for ${name}.`
    );
  }
  return value;
}

function parseNodeEnv(value: string): AegisAIConfig["nodeEnv"] {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }
  throw new ConfigError(
    `Invalid NODE_ENV: "${value}". Expected "development", "test", or "production".`
  );
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new ConfigError(`Invalid PORT: "${value}". Expected an integer between 1 and 65535.`);
  }
  return port;
}

let cachedConfig: AegisAIConfig | undefined;

/**
 * Loads and validates configuration from process.env.
 * Throws ConfigError synchronously if anything required is missing or invalid.
 * Result is cached after the first successful load.
 */
export function loadConfig(): AegisAIConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const config: AegisAIConfig = {
    nodeEnv: parseNodeEnv(process.env.NODE_ENV ?? "development"),
    port: parsePort(requireEnv("PORT")),
    databaseUrl: requireEnv("DATABASE_URL"),
    mongodbUrl: requireEnv("MONGODB_URL"),
    redisUrl: requireEnv("REDIS_URL"),
    jwtSecret: requireEnv("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
    corsOrigins: requireEnv("CORS_ORIGINS")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    soapMockUrl: process.env.SOAP_MOCK_URL ?? "http://localhost:5005",
  };

  cachedConfig = config;
  return config;
}

/** Test-only helper: clears the cached config so tests can reload with different env vars. */
export function __resetConfigCacheForTests(): void {
  cachedConfig = undefined;
}

export { ConfigError };
