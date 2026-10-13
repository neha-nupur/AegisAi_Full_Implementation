/**
 * Identity & Access Management Service — local domain types.
 *
 * These describe this service's own entities (organizations, users,
 * service_accounts) and its request/response DTOs. They are internal
 * to this service — other services never import from here; if
 * another service eventually needs to know about an authenticated
 * caller, that shape is published on `IdentityServiceContract` in
 * `@aegisai/shared-types` instead (not needed yet — see that file).
 */
import type { Permission, Role } from "../domain/rbac";

export type EntityStatus = "active" | "disabled";
export type OrganizationStatus = "active" | "suspended";

/** Full organization row. */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

/** Full user row, including the password hash — never sent to a client. See `PublicUser`. */
export interface User {
  id: string;
  organizationId: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  role: Role;
  status: EntityStatus;
  verificationTokenHash?: string | null;
  verificationTokenExpiresAt?: string | null;
  resetTokenHash?: string | null;
  resetTokenExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** User shape safe to return from the API — no secrets. */
export type PublicUser = Omit<User, "passwordHash" | "verificationTokenHash" | "resetTokenHash">;

/** Full service account row, including the credential hash — never sent to a client. See `PublicServiceAccount`. */
export interface ServiceAccount {
  id: string;
  organizationId: string;
  name: string;
  status: EntityStatus;
  permissions: Permission[];
  credentialHash: string;
  credentialPrefix: string;
  createdAt: string;
  updatedAt: string;
}

/** Service account shape safe to return from the API — no `credentialHash`. */
export type PublicServiceAccount = Omit<ServiceAccount, "credentialHash">;

/** Claims carried by an access token. No PII — see docs/service-boundaries.md and the Phase 2 security rule. */
export interface AccessTokenClaims {
  sub: string;
  organizationId: string;
  role: Role;
  permissions: Permission[];
  iat: number;
  exp: number;
}

/** The authenticated caller, attached to `req.principal` by `authenticateJWT`. */
export interface AuthenticatedPrincipal {
  userId: string;
  organizationId: string;
  role: Role;
  permissions: Permission[];
}
