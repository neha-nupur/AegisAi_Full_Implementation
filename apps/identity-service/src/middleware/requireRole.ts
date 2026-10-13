import type { NextFunction, Request, Response } from "express";
import { HttpError } from "@aegisai/shared-types";
import type { Role } from "../domain/rbac";

/**
 * Requires `authenticateJWT` to have already run on this route (so
 * `req.principal` is set) and the caller's role to be one of `roles`.
 * Authenticated-but-insufficient-role results in 403 — a missing
 * principal (this middleware used without `authenticateJWT` first)
 * is treated as 401, not a crash.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const principal = req.principal;
    if (!principal) {
      next(new HttpError(401, "MISSING_TOKEN", "Authentication required."));
      return;
    }
    if (!roles.includes(principal.role)) {
      next(new HttpError(403, "FORBIDDEN", "You do not have the required role for this action."));
      return;
    }
    next();
  };
}
