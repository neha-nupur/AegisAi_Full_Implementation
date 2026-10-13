/**
 * Minimal environment for tests that mint real JWTs via Identity's
 * `TokenService` (to build a realistic bearer token for
 * `createSecurityAuditApiRouter`'s `authenticateJWT` middleware).
 * Same convention as every other service's `tests/support/setup-env.ts`.
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.PORT = process.env.PORT ?? "4000";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
process.env.MONGODB_URL = process.env.MONGODB_URL ?? "mongodb://localhost:27017/test";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-only-jwt-secret-do-not-use-in-production";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "15m";
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? "http://localhost:5173";
