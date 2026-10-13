import type { NextFunction, Request, Response } from "express";
import { HttpError } from "@aegisai/shared-types";
import type { Permission } from "../domain/rbac";

/**
 * Requires `authenticateJWT` to have already run on this route (so
 * `req.principal` is set) and the caller to hold `permission` (per
 * the role -> permission grants in `domain/rbac.ts`). Same 401/403
 * split as `requireRole`.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const principal = req.principal;
    if (!principal) {
      next(new HttpError(401, "MISSING_TOKEN", "Authentication required."));
      return;
    }
    if (!principal.permissions.includes(permission)) {
      next(new HttpError(403, "FORBIDDEN", `Missing required permission: ${permission}.`));
      return;
    }
    next();
  };
}
