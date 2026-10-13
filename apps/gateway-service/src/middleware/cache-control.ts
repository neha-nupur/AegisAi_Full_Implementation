import type { Request, Response, NextFunction } from "express";

/**
 * Sets deliberate Cache-Control headers based on route type.
 * - GET on single resource: private, max-age=30 (cache for a short time)
 * - GET on list: private, no-cache (must revalidate)
 * - POST/PATCH/DELETE: no-store
 *
 * This middleware is mounted on the `/ai-requests` sub-router (see
 * `routes/ai-requests.routes.ts`), so `req.path` here is already
 * relative to that mount point: `"/"` for the list route
 * (`GET /v1/ai-requests`) and `"/<id>"` for the single-resource route
 * (`GET /v1/ai-requests/:id`) — it is never `"/ai-requests"` itself.
 */
export const cacheControlMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === "GET") {
    const isList = req.path === "/" || req.path === "";
    res.setHeader("Cache-Control", isList ? "private, no-cache" : "private, max-age=30");
  } else {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
};
