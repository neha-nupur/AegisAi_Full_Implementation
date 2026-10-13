import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { loadConfig } from "@aegisai/config";
import { HttpError } from "@aegisai/shared-types";
import type { Permission, Role } from "../domain/rbac";
import type { AccessTokenClaims } from "../types";

export interface TokenSubject {
  userId: string;
  organizationId: string;
  role: Role;
  permissions: Permission[];
}

export interface IssuedToken {
  token: string;
  expiresAt: string;
}

/**
 * Issues and verifies access tokens.
 *
 * Claims are deliberately minimal — `sub`, `organizationId`, `role`,
 * `permissions`, `iat`, `exp` — per the Phase 2 rule against putting
 * sensitive information (email, password hash, etc.) into JWT claims.
 *
 * `loadConfig()` is called per-operation, not cached in the
 * constructor, so importing this module never requires `JWT_SECRET`
 * to already be set — only actually signing/verifying a token does
 * (same reasoning as `db/pool.ts`'s lazy pool).
 */
export class TokenService {
  sign(subject: TokenSubject): IssuedToken {
    const config = loadConfig();
    const token = jwt.sign(
      {
        organizationId: subject.organizationId,
        role: subject.role,
        permissions: subject.permissions,
      },
      config.jwtSecret,
      {
        subject: subject.userId,
        expiresIn: config.jwtExpiresIn,
      } as jwt.SignOptions
    );

    const decoded = jwt.decode(token) as { exp: number };
    return { token, expiresAt: new Date(decoded.exp * 1000).toISOString() };
  }

  /** Verifies signature and expiry, and returns the typed claims. Throws `HttpError` (401) on any failure. */
  verify(token: string): AccessTokenClaims {
    const config = loadConfig();
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
      return {
        sub: decoded.sub as string,
        organizationId: decoded.organizationId as string,
        role: decoded.role as Role,
        permissions: decoded.permissions as Permission[],
        iat: decoded.iat as number,
        exp: decoded.exp as number,
      };
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new HttpError(401, "TOKEN_EXPIRED", "Access token has expired.");
      }
      if (err instanceof JsonWebTokenError) {
        throw new HttpError(401, "TOKEN_INVALID", "Access token is invalid.");
      }
      throw err;
    }
  }
}
