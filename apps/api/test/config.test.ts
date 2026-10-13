import { loadConfig, __resetConfigCacheForTests, ConfigError } from "@aegisai/config";

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
