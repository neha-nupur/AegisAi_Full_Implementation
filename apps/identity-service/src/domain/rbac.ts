/**
 * Identity & Access Management Service — RBAC domain model.
 *
 * This is the single source of truth for roles and permissions
 * (CLAUDE.md section 17 — avoid magic strings; section 3 — a
 * service's domain rules live inside that service). Both
 * `AuthService` (JWT issuance) and the `requireRole` /
 * `requirePermission` authorization middleware are built on these
 * same definitions, so a role's permissions can never drift between
 * where a token is minted and where it is checked.
 */

/** The three user roles introduced in Phase 2. Service accounts are a separate identity kind — see `service-accounts.repository.ts`. */
export const ROLES = ["ORGANIZATION_ADMIN", "DEVELOPER", "SECURITY_AUDITOR"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Permissions scoped to what Phase 2 actually implements (users,
 * service accounts, organizations). Additional resources (policies,
 * ai-requests, etc.) get their own permission strings in the phases
 * that introduce them — not speculated here.
 */
export const PERMISSIONS = [
  "users:read",
  "users:write",
  "service_accounts:read",
  "service_accounts:write",
  "organizations:read",
  "organizations:write",
  // AI Request Gateway resources (Phase 3) — see docs/service-boundaries.md.
  // Defined here (not in gateway-service) because RBAC permission strings
  // are Identity's owned domain; gateway-service only *checks* them via
  // the shared `requirePermission` middleware.
  "ai_requests:read",
  "ai_requests:write",
  // Policy & Approval Service resources (Phase 4) — see
  // docs/service-boundaries.md. Defined here for the same reason as
  // ai_requests:* above: RBAC permission strings are Identity's
  // owned domain, policy-service only checks them.
  "policies:read",
  "policies:write",
  "approvals:read",
  "approvals:write",
  // Security & Audit Service resources (Phase 11 — wiring up
  // Phase 8's already-built controllers/services/repositories to
  // real routes). One permission covers all three read-only
  // resources (traces, audit events, security events) since they are
  // fundamentally one "view the audit trail" capability, not three
  // independently grantable ones — see docs/service-boundaries.md.
  "audit:read",
  // Organization settings (this phase) — ORGANIZATION_ADMIN can
  // read and write settings; DEVELOPER and SECURITY_AUDITOR can
  // only read them (to understand current gateway/privacy config).
  "settings:read",
  "settings:write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role -> permission grants.
 *
 * - ORGANIZATION_ADMIN: full control over identity resources within
 *   their own organization.
 * - DEVELOPER: manages the service accounts their integrations use,
 *   can see (but not manage) other users, read-only on the
 *   organization itself.
 * - SECURITY_AUDITOR: read-only across every identity resource —
 *   matches this role's purpose (visibility for audit, not change).
 *
 * Phase 3 adds `ai_requests:*`: ORGANIZATION_ADMIN and DEVELOPER can
 * submit AI requests (write) and read them back; SECURITY_AUDITOR is
 * read-only, consistent with its purpose everywhere else.
 *
 * Phase 4 adds `policies:*`/`approvals:*`: ORGANIZATION_ADMIN can
 * author policies and decide approvals; DEVELOPER and
 * SECURITY_AUDITOR can read both (visibility into what will
 * block/mask/require approval on their requests) but not author
 * policy or decide approvals — deciding approvals is an
 * administrative act, not a developer one.
 *
 * Phase 11 adds `audit:read` (Security & Audit's trace/audit-event/
 * security-event query endpoints): ORGANIZATION_ADMIN and
 * SECURITY_AUDITOR only — DEVELOPER does not get blanket visibility
 * into every security event across the organization (as opposed to
 * `ai_requests:read`, which is scoped to a developer's own concern);
 * that visibility is what the SECURITY_AUDITOR role and org admins
 * exist for.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ORGANIZATION_ADMIN: [
    "users:read",
    "users:write",
    "service_accounts:read",
    "service_accounts:write",
    "organizations:read",
    "organizations:write",
    "ai_requests:read",
    "ai_requests:write",
    "policies:read",
    "policies:write",
    "approvals:read",
    "approvals:write",
    "audit:read",
    "settings:read",
    "settings:write",
  ],
  DEVELOPER: [
    "users:read",
    "service_accounts:read",
    "service_accounts:write",
    "organizations:read",
    "ai_requests:read",
    "ai_requests:write",
    "policies:read",
    "approvals:read",
    "settings:read",
  ],
  SECURITY_AUDITOR: [
    "users:read",
    "service_accounts:read",
    "organizations:read",
    "ai_requests:read",
    "policies:read",
    "approvals:read",
    "audit:read",
    "settings:read",
  ],
};

/** Permissions granted to a given role — used when minting a JWT and when seeding fixtures/tests. */
export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}
