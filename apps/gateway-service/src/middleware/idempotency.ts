import type { Request, Response, NextFunction } from "express";
import { HttpError } from "@aegisai/shared-types";
import { getRedisClient } from "../db/redis";

/**
 * Idempotency middleware for POST requests.
 * Requires `Idempotency-Key` header (UUID recommended).
 * 
 * Flow:
 * 1. Read `Idempotency-Key` header. Missing -> 400.
 * 2. Key prefix is `idempotency:{organizationId}:{key}`.
 * 3. Check Redis for key.
 *    - If status === "processing" -> 409 Conflict.
 *    - If status === "completed" -> Return cached response (201).
 *    - If not found -> Set status "processing", proceed to handler.
 * 4. Intercept `res.json` to cache the successful response before sending.
 */
export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.method !== "POST") {
    return next();
  }

  const idempotencyKey = req.header("Idempotency-Key");
  if (!idempotencyKey) {
    return next(new HttpError(400, "MISSING_IDEMPOTENCY_KEY", "Idempotency-Key header is required for this operation."));
  }

  const organizationId = req.principal?.organizationId;
  if (!organizationId) {
    // Should be caught by authenticateJWT first, but just in case.
    return next(new HttpError(401, "UNAUTHORIZED", "Missing principal organization."));
  }

  const redisKey = `idempotency:${organizationId}:${idempotencyKey}`;

  try {
    const redis = await getRedisClient();
    const existing = await redis.get(redisKey);
    
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.status === "processing") {
        return next(new HttpError(409, "IDEMPOTENCY_CONFLICT", "A request with this Idempotency-Key is currently being processed."));
      }
      
      if (parsed.status === "completed") {
        // Return cached response
        res.status(parsed.statusCode || 201).json(parsed.body);
        return;
      }
    }

    // Set to processing with a 24h TTL (86400 seconds)
    // using SETNX equivalent with NX option
    const setRes = await redis.set(redisKey, JSON.stringify({ status: "processing" }), "EX", 86400, "NX");
    if (!setRes) {
      // Another concurrent request beat us to it
      return next(new HttpError(409, "IDEMPOTENCY_CONFLICT", "A request with this Idempotency-Key is currently being processed."));
    }

    // Intercept res.json to capture the successful response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redis.set(
          redisKey,
          JSON.stringify({
            status: "completed",
            statusCode: res.statusCode,
            body
          }),
          "EX",
          86400
        ).catch(err => {
          // Fire and forget, don't break the response if Redis cache update fails
          process.stderr.write(`[idempotency] failed to update cache for ${idempotencyKey}: ${err.message}\n`);
        });
      } else {
        // If it failed, delete the key so they can retry
        redis.del(redisKey).catch(err => {
          process.stderr.write(`[idempotency] failed to delete key for ${idempotencyKey}: ${err.message}\n`);
        });
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    next(err);
  }
};
