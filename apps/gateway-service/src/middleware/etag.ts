import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";

/**
 * Middleware that computes a weak ETag for successful GET responses.
 * If the ETag matches `If-None-Match`, it responds with 304 Not Modified.
 */
export const etagMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Only apply to GET requests
  if (req.method !== "GET") {
    return next();
  }

  // Intercept res.json
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    // Only apply for successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Calculate weak ETag
      const payload = typeof body === "string" ? body : JSON.stringify(body);
      const hash = createHash("md5").update(payload).digest("hex").substring(0, 16);
      const etag = `W/"${hash}"`;

      res.setHeader("ETag", etag);

      const ifNoneMatch = req.header("If-None-Match");
      if (ifNoneMatch && ifNoneMatch === etag) {
        res.status(304);
        res.send("");
        return res as any;
      }
    }

    return originalJson(body);
  };

  next();
};
