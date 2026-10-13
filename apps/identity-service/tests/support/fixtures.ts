import { randomUUID } from "node:crypto";
import { permissionsForRole } from "../../src/domain/rbac";
import { PasswordService } from "../../src/services/password.service";
import { TokenService } from "../../src/services/token.service";
import type { Organization, User } from "../../src/types";
import {
  InMemoryOrganizationsRepository,
  InMemoryServiceAccountsRepository,
  InMemoryUsersRepository,
} from "./in-memory-repositories";

export interface Fixtures {
  organizations: InMemoryOrganizationsRepository;
  users: InMemoryUsersRepository;
  serviceAccounts: InMemoryServiceAccountsRepository;
  orgA: Organization;
  orgB: Organization;
  adminA: User;
  developerA: User;
  auditorA: User;
  disabledA: User;
  adminB: User;
  passwords: {
    adminA: string;
    developerA: string;
    auditorA: string;
    disabledA: string;
    adminB: string;
  };
}

/** Builds a fresh, isolated set of fixtures — call once per test (or per `describe` block) so tests never share mutable state. */
export async function buildFixtures(): Promise<Fixtures> {
  const organizations = new InMemoryOrganizationsRepository();
  const users = new InMemoryUsersRepository();
  const serviceAccounts = new InMemoryServiceAccountsRepository();
  const passwordService = new PasswordService();
  const now = new Date().toISOString();

  const orgA: Organization = { id: randomUUID(), name: "Org A", slug: "org-a", status: "active", createdAt: now, updatedAt: now };
  const orgB: Organization = { id: randomUUID(), name: "Org B", slug: "org-b", status: "active", createdAt: now, updatedAt: now };
  organizations.seed(orgA);
  organizations.seed(orgB);

  const passwords = {
    adminA: "Correct-Horse-Battery-Staple-1",
    developerA: "Correct-Horse-Battery-Staple-2",
    auditorA: "Correct-Horse-Battery-Staple-3",
    disabledA: "Correct-Horse-Battery-Staple-4",
    adminB: "Correct-Horse-Battery-Staple-5",
  };

  const [adminAHash, developerAHash, auditorAHash, disabledAHash, adminBHash] = await Promise.all([
    passwordService.hash(passwords.adminA),
    passwordService.hash(passwords.developerA),
    passwordService.hash(passwords.auditorA),
    passwordService.hash(passwords.disabledA),
    passwordService.hash(passwords.adminB),
  ]);

  const adminA: User = {
    id: randomUUID(),
    organizationId: orgA.id,
    email: "admin@org-a.test",
    emailVerified: true,
    passwordHash: adminAHash,
    role: "ORGANIZATION_ADMIN",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const developerA: User = {
    id: randomUUID(),
    organizationId: orgA.id,
    email: "developer@org-a.test",
    emailVerified: true,
    passwordHash: developerAHash,
    role: "DEVELOPER",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const auditorA: User = {
    id: randomUUID(),
    organizationId: orgA.id,
    email: "auditor@org-a.test",
    emailVerified: true,
    passwordHash: auditorAHash,
    role: "SECURITY_AUDITOR",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const disabledA: User = {
    id: randomUUID(),
    organizationId: orgA.id,
    email: "disabled@org-a.test",
    emailVerified: true,
    passwordHash: disabledAHash,
    role: "DEVELOPER",
    status: "disabled",
    createdAt: now,
    updatedAt: now,
  };
  const adminB: User = {
    id: randomUUID(),
    organizationId: orgB.id,
    email: "admin@org-b.test",
    emailVerified: true,
    passwordHash: adminBHash,
    role: "ORGANIZATION_ADMIN",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  for (const user of [adminA, developerA, auditorA, disabledA, adminB]) {
    users.seed(user);
  }

  return { organizations, users, serviceAccounts, orgA, orgB, adminA, developerA, auditorA, disabledA, adminB, passwords };
}

/** Signs a real access token for a fixture user — same code path `AuthService.login` uses. */
export function issueTokenFor(user: User): string {
  const tokenService = new TokenService();
  return tokenService.sign({
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    permissions: permissionsForRole(user.role),
  }).token;
}
