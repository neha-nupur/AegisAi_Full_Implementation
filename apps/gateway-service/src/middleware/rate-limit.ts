import type { Request, Response, NextFunction } from "express";
import { HttpError } from "@aegisai/shared-types";
import { getRedisClient } from "../db/redis";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * Sliding window (or simple fixed window) rate limiter using Redis.
 * Keyed by organizationId.
 */
export const rateLimitMiddleware = (options?: Partial<RateLimitOptions>) => {
  // Configurable via env or options
  const windowMs = options?.windowMs ?? parseInt(process.env["RATE_LIMIT_WINDOW_MS"] || "60000", 10);
  const max = options?.max ?? parseInt(process.env["RATE_LIMIT_MAX"] || "100", 10);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const organizationId = req.principal?.organizationId;
    if (!organizationId) {
      // Unauthenticated requests should be caught earlier, but just in case
      return next();
    }

    // Simple fixed window for now. A true sliding window requires sorted sets (ZSET),
    // but fixed window via INCR + EXPIRE is usually sufficient and faster.
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs);
    const redisKey = `ratelimit:${organizationId}:${windowStart}`;

    try {
      const redis = await getRedisClient();
      // INCR creates the key if it doesn't exist
      const count = await redis.incr(redisKey);
      
      if (count === 1) {
        // First request in this window, set expiry
        // Set expiry to window duration + 1s buffer
        await redis.expire(redisKey, Math.ceil(windowMs / 1000) + 1);
      }

      const remaining = Math.max(0, max - count);
      const resetTime = (windowStart + 1) * windowMs;
      const resetUnix = Math.ceil(resetTime / 1000);

      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", resetUnix);

      if (count > max) {
        res.setHeader("Retry-After", Math.ceil((resetTime - now) / 1000));
        return next(new HttpError(429, "RATE_LIMIT_EXCEEDED", "Too many requests, please try again later."));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
