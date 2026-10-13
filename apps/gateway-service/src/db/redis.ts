import Redis from "ioredis";
import RedisMock from "ioredis-mock";

/**
 * Lazy singleton Redis client for the gateway-service.
 *
 * Matches the same lazy-connect pattern used by `db/pool.ts` for
 * PostgreSQL: the client is not created until it is first accessed,
 * so importing this module at the top of a test file does not open a
 * Redis connection during test-suite setup unless the test actually
 * exercises Redis-backed middleware.
 *
 * In unit tests that mock out the Redis-dependent middleware, this
 * module is never accessed at all — so no live connection is needed.
 *
 * REDIS_URL defaults to `redis://localhost:6379` to match the
 * docker-compose service (docker/docker-compose.yml).
 *
 * `getRedisClient()` is `async` and awaits an explicit `.connect()`
 * before returning — found (Phase 11 hardening, live end-to-end
 * testing against a real Redis) that `lazyConnect: true` combined
 * with `enableOfflineQueue: false` fails deterministically the
 * moment any command is issued, on every cold start: ioredis's
 * lazy-connect-on-first-command path does not wait for the
 * connection handshake to finish before checking the (still
 * unwritable) stream, so `enableOfflineQueue: false` rejects it
 * immediately with "Stream isn't writeable" — this is not a timing
 * race that more delay fixes; it reproduces 100% of the time.
 * Explicitly calling and awaiting `.connect()` first (guarded so
 * concurrent callers share one in-flight connection attempt, not one
 * each) avoids the lazy-connect-on-command path entirely.
 */

let _client: Redis | null = null;
let _connecting: Promise<void> | null = null;

export async function getRedisClient(): Promise<Redis> {
  if (!_client) {
    const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    
    if (url.startsWith("memory://")) {
      _client = new RedisMock() as unknown as Redis;
    } else {
      _client = new Redis(url, {
        // Fail fast in tests / dev if Redis is not up.
        enableOfflineQueue: false,
        lazyConnect: true,
        // Suppress unhandled-rejection noise from ioredis when the
        // connection is closed between tests.
        maxRetriesPerRequest: 0,
      });
    }

    _client.on("error", (err: Error) => {
      // Pino is not available in this module without importing the full
      // app, so we use process.stderr which is always available.
      // Strip credentials from connection-string-shaped messages.
      const safe = err.message.replace(/:\/\/[^@\s]+@/g, "://***@");
      process.stderr.write(`[redis] connection error: ${safe}\n`);
    });
  }

  if (_client.status === "wait") {
    _connecting = _connecting ?? _client.connect();
  }
  if (_connecting) {
    await _connecting;
    _connecting = null;
  }

  return _client;
}

/** Disconnect cleanly — call during graceful shutdown. */
export async function closeRedisClient(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
    _connecting = null;
  }
}
