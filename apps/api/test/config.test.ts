import { loadConfig, __resetConfigCacheForTests, ConfigError, resolvePgPoolConfig } from "@aegisai/config";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    __resetConfigCacheForTests();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws a ConfigError when a required variable is missing", () => {
    delete process.env.DATABASE_URL;
    process.env.PORT = "4000";
    process.env.MONGODB_URL = "mongodb://localhost:27017/test";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.JWT_SECRET = "secret";
    process.env.CORS_ORIGINS = "http://localhost:5173";

    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it("loads successfully when all required variables are present", () => {
    process.env.PORT = "4000";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.MONGODB_URL = "mongodb://localhost:27017/test";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.JWT_SECRET = "secret";
    process.env.CORS_ORIGINS = "http://localhost:5173, http://example.com";

    const config = loadConfig();
    expect(config.port).toBe(4000);
    expect(config.corsOrigins).toEqual(["http://localhost:5173", "http://example.com"]);
  });
});

describe("resolvePgPoolConfig TLS & security hardening", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_CA_CERT;
    delete process.env.DATABASE_CA_PATH;
    delete process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
    delete process.env.PGSSL_REJECT_UNAUTHORIZED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("accepts sslmode=disable on local database URLs", () => {
    const config = resolvePgPoolConfig("postgresql://user:pass@localhost:5432/test?sslmode=disable");
    expect(config.ssl).toBe(false);
  });

  it("rejects sslmode=disable on remote database URLs with a ConfigError", () => {
    expect(() => {
      resolvePgPoolConfig("postgresql://user:pass@dpg-abc-a.oregon-postgres.render.com/aegisai?sslmode=disable");
    }).toThrow(
      new ConfigError("Insecure configuration: sslmode=disable is not permitted for remote PostgreSQL connections.")
    );
  });

  it("preserves default TLS behavior for remote URLs without CA", () => {
    const config = resolvePgPoolConfig("postgresql://user:pass@dpg-abc-a.oregon-postgres.render.com/aegisai");
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("enforces strict TLS verification (rejectUnauthorized: true) when DATABASE_CA_CERT is configured", () => {
    process.env.DATABASE_CA_CERT = "-----BEGIN CERTIFICATE-----\nSAMPLE_CA_DATA\n-----END CERTIFICATE-----";
    const config = resolvePgPoolConfig("postgresql://user:pass@dpg-abc-a.oregon-postgres.render.com/aegisai");
    expect(typeof config.ssl).toBe("object");
    expect(config.ssl).toEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----\nSAMPLE_CA_DATA\n-----END CERTIFICATE-----",
    });
  });

  it("defaults to ssl: false for standard local connections without explicit flags", () => {
    const config = resolvePgPoolConfig("postgresql://user:pass@127.0.0.1:5432/test");
    expect(config.ssl).toBe(false);
  });
});
