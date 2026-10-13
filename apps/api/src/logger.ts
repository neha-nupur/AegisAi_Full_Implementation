import pino from "pino";

/**
 * Structured logger for the API foundation.
 *
 * Rule (per CLAUDE.md, section 9): never log passwords, JWT secrets,
 * provider API keys, raw credentials, or unnecessary PII. The redact
 * paths below cover the request-level fields most likely to carry
 * secrets; individual services must extend this list as they add
 * fields that can contain sensitive data (e.g. AI prompts).
 */
export const logger = pino({
  name: "aegisai-api",
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-goog-api-key']",
      "req.body.password",
      "req.body.token",
      "req.body.secret",
      "req.body.jwtSecret",
      "req.body.apiKey",
      "req.body.api_key",
      "OPENAI_API_KEY",
      "GEMINI_API_KEY",
      "JWT_SECRET",
      "DATABASE_URL",
      "MONGODB_URL",
      "REDIS_URL",
      "POSTGRES_PASSWORD",
      "SEED_ADMIN_PASSWORD",
      "passwordHash",
      "req.body.credential",
      // AI request prompts (Phase 3) — pino-http does not log
      // req.body by default, but this stays extended defensively per
      // the rule above should that ever change.
      "req.body.input",
    ],
    remove: true,
  },
});
