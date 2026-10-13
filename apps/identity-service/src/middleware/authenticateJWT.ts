import type { NextFunction, Request, Response } from "express";
import { HttpError } from "@aegisai/shared-types";
import { TokenService } from "../services/token.service";
import type { AuthenticatedPrincipal } from "../types";

/** Express augmentation: any authenticated request carries the caller's principal. */
declare module "express-serve-static-core" {
  interface Request {
    principal?: AuthenticatedPrincipal;
  }
}

const tokenService = new TokenService();

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches
 * the caller's identity to `req.principal`. A missing, malformed,
 * expired, or invalid token results in 401 — never a silent
 * pass-through (per the Phase 2 authorization rule).
 */
export function authenticateJWT(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    next(new HttpError(401, "MISSING_TOKEN", "Missing or malformed Authorization header."));
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next(new HttpError(401, "MISSING_TOKEN", "Missing bearer token."));
    return;
  }

  try {
    const claims = tokenService.verify(token);
    req.principal = {
      userId: claims.sub,
      organizationId: claims.organizationId,
      role: claims.role,
      permissions: claims.permissions,
    };
    next();
  } catch (err) {
    next(err);
  }
}
