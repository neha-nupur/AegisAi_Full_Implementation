import * as fs from "fs";

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
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter((origin) => origin.length > 0),
    soapMockUrl: process.env.SOAP_MOCK_URL ?? "http://localhost:5005",
  };

  cachedConfig = config;
  return config;
}

export interface PgPoolConfig {
  connectionString: string;
  ssl?:
    | boolean
    | {
        rejectUnauthorized: boolean;
        ca?: string;
      };
}

/**
 * Resolves PostgreSQL pool configuration, supporting both local development
 * (Docker / localhost) and hosted cloud databases (Render, Supabase, Neon)
 * that enforce SSL/TLS.
 *
 * Precedence & TLS Behavior:
 * 1. Explicit connection string flag `sslmode=disable` -> `ssl: false`
 * 2. If a custom CA certificate is configured via `DATABASE_CA_CERT` or `DATABASE_CA_PATH`:
 *    Enables TLS and sets `rejectUnauthorized: true` (unless overridden by
 *    `DATABASE_SSL_REJECT_UNAUTHORIZED=false` or `sslmode=no-verify`).
 * 3. Localhost / 127.0.0.1 / docker aliases without CA or sslmode -> `ssl: false`
 * 4. Explicit env var `DATABASE_SSL_REJECT_UNAUTHORIZED` / `PGSSL_REJECT_UNAUTHORIZED`
 * 5. Connection string `sslmode=no-verify` -> `ssl: { rejectUnauthorized: false }`
 * 6. Remote / production without CA -> `ssl: { rejectUnauthorized: false }`
 *    (Encrypts wire traffic with TLS while supporting cloud databases with internal CAs)
 */
export function resolvePgPoolConfig(databaseUrl: string, _nodeEnv?: string): PgPoolConfig {
  const isLocal =
    !databaseUrl ||
    databaseUrl.includes("localhost") ||
    databaseUrl.includes("127.0.0.1") ||
    databaseUrl.includes("@postgres:") ||
    databaseUrl.includes("@db:");

  // Check explicit environment variables
  const rejectUnauthorizedEnv =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? process.env.PGSSL_REJECT_UNAUTHORIZED;
  const isRejectUnauthorizedExplicit = rejectUnauthorizedEnv !== undefined;
  const rejectUnauthorizedExplicit = rejectUnauthorizedEnv === "true";

  // Check CA certificate from environment or file
  let caCert: string | undefined;
  if (process.env.DATABASE_CA_CERT && process.env.DATABASE_CA_CERT.trim()) {
    caCert = process.env.DATABASE_CA_CERT.trim();
  } else if (process.env.DATABASE_CA_PATH && process.env.DATABASE_CA_PATH.trim()) {
    try {
      caCert = fs.readFileSync(process.env.DATABASE_CA_PATH.trim(), "utf-8").trim();
    } catch (err) {
      throw new ConfigError(
        `Failed to read PostgreSQL CA certificate from DATABASE_CA_PATH: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (caCert && caCert.includes("\\n")) {
    caCert = caCert.replace(/\\n/g, "\n");
  }

  // If connection string explicitly states sslmode=disable
  if (databaseUrl.includes("sslmode=disable")) {
    if (isLocal) {
      return { connectionString: databaseUrl, ssl: false };
    }
    throw new ConfigError(
      "Insecure configuration: sslmode=disable is not permitted for remote PostgreSQL connections."
    );
  }

  // If local connection without CA cert or explicit SSL flags
  if (isLocal && !caCert && !databaseUrl.includes("sslmode=") && !isRejectUnauthorizedExplicit) {
    return { connectionString: databaseUrl, ssl: false };
  }

  // When a CA certificate is configured, enable TLS and enforce strict certificate verification by default
  if (caCert) {
    const rejectUnauthorized = isRejectUnauthorizedExplicit
      ? rejectUnauthorizedExplicit
      : !databaseUrl.includes("sslmode=no-verify");

    return {
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized,
        ca: caCert,
      },
    };
  }

  // Explicit user override via env var when no CA cert is loaded
  if (isRejectUnauthorizedExplicit) {
    return {
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: rejectUnauthorizedExplicit },
    };
  }

  // If connection string explicitly states sslmode=no-verify
  if (databaseUrl.includes("sslmode=no-verify")) {
    return {
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    };
  }

  // For remote databases (e.g. Render, Supabase, Neon) where CA cert is not provided:
  // Default to TLS encryption with rejectUnauthorized: false to allow self-signed / provider-managed internal CAs
  return {
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  };
}

/** Test-only helper: clears the cached config so tests can reload with different env vars. */
export function __resetConfigCacheForTests(): void {
  cachedConfig = undefined;
}

export { ConfigError };
