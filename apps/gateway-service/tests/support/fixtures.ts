import { randomUUID } from "node:crypto";
import { permissionsForRole, TokenService } from "@aegisai/identity-service";
import type { Role } from "@aegisai/identity-service";

/**
 * Minimal fixtures for gateway-service tests: two organizations, one
 * principal per organization. This service does not own
 * organizations/users — it only needs a realistic, real access token
 * per principal (same `TokenService` code path Identity's own login
 * uses), which is what `authenticateJWT` (also reused from Identity)
 * verifies. Same convention as
 * `apps/identity-service/tests/support/fixtures.ts`, scoped down to
 * what this service's tests actually need.
 */
export interface TestPrincipal {
  userId: string;
  organizationId: string;
  role: Role;
}

export function buildPrincipal(role: Role, organizationId: string = randomUUID()): TestPrincipal {
  return { userId: randomUUID(), organizationId, role };
}

export function issueTokenFor(principal: TestPrincipal): string {
  const tokenService = new TokenService();
  return tokenService.sign({
    userId: principal.userId,
    organizationId: principal.organizationId,
    role: principal.role,
    permissions: permissionsForRole(principal.role),
  }).token;
}
