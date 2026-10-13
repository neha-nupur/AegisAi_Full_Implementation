/**
 * Identity & Access Management Service
 *
 * Owns: organizations, users, service_accounts
 *
 * Phase 2: real authentication and authorization.
 * - `identityRouter` — this service's own `GET /health`, mounted by
 *   apps/api under `/v1/identity` (unchanged since Phase 1).
 * - `identityApiRouter` — this service's business API (`POST
 *   /v1/auth/login`, `/v1/users`, `/v1/service-accounts`,
 *   `/v1/organizations/:id`), mounted by apps/api at `/v1` directly.
 * - `authenticateJWT` / `requireRole` / `requirePermission` —
 *   exported so any other service can protect its own routes the
 *   same way once it needs to (none do yet).
 *
 * See docs/service-boundaries.md for the full breakdown and
 * docs/api-conventions.md for why the two routers mount differently.
 */
export { SERVICE_NAME } from "./service-name";
export { identityRouter, identityApiRouter, createIdentityApiRouter, type IdentityApiDependencies } from "./routes";
export { authenticateJWT, requireRole, requirePermission } from "./middleware";
export { PERMISSIONS, ROLES, permissionsForRole, isPermission, isRole, type Permission, type Role } from "./domain/rbac";
export type { AuthenticatedPrincipal } from "./types";
/**
 * `TokenService` (Phase 3): exported so other services' tests can
 * mint a real, correctly-shaped access token for a fixture principal
 * — the same code path `AuthService.login` uses — without needing a
 * live Identity service or a duplicated JWT-signing implementation.
 * Production issuance of tokens still only ever happens via
 * `POST /v1/auth/login`; this does not add a second way to log in.
 */
export { TokenService, type TokenSubject, type IssuedToken } from "./services/token.service";
/**
 * `LegacyEmployeeClient` (Phase 10): exported mainly so
 * `apps/api/src/app.ts` can wire this process's shared Pino logger
 * into it (same convention as `AiRequestsService`'s audit logger) and
 * so this service's own tests can inject a fake WSDL endpoint. See
 * `integrations/soap/legacy-employee.client.ts`.
 */
export { LegacyEmployeeClient, type SoapLogger } from "./integrations/soap/legacy-employee.client";
export type { LegacyEmployeeRecord } from "./integrations/soap/legacy-employee.types";

