import { randomUUID } from "node:crypto";
import { permissionsForRole, TokenService } from "@aegisai/identity-service";
import type { Role } from "@aegisai/identity-service";

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
