import { randomUUID } from "node:crypto";
import type {
  OrganizationsRepository,
  UpdateOrganizationInput,
} from "../../src/repositories/organizations.repository";
import type {
  CreateServiceAccountInput,
  ServiceAccountsRepository,
  UpdateServiceAccountInput,
} from "../../src/repositories/service-accounts.repository";
import type { CreateUserInput, UpdateUserInput, UsersRepository } from "../../src/repositories/users.repository";
import type { Organization, ServiceAccount, User } from "../../src/types";

/**
 * In-memory stand-ins for the `Pg*Repository` implementations, used
 * by this service's own tests so they exercise real business logic
 * (services, controllers, middleware, HTTP status codes) without
 * requiring a live PostgreSQL connection. Test-only — never imported
 * by production code.
 */

export class InMemoryOrganizationsRepository implements OrganizationsRepository {
  private readonly rows = new Map<string, Organization>();

  seed(organization: Organization): void {
    this.rows.set(organization.id, organization);
  }

  async create(name: string, slug: string): Promise<Organization> {
    const now = new Date().toISOString();
    const org: Organization = {
      id: randomUUID(),
      name,
      slug,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(org.id, org);
    return org;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.rows.get(id) ?? null;
  }

  async update(id: string, patch: UpdateOrganizationInput): Promise<Organization | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: Organization = {
      ...existing,
      name: patch.name ?? existing.name,
      status: patch.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryUsersRepository implements UsersRepository {
  private readonly rows = new Map<string, User>();

  seed(user: User): void {
    this.rows.set(user.id, user);
  }

  async create(input: CreateUserInput): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      organizationId: input.organizationId,
      email: input.email,
      emailVerified: false,
      passwordHash: input.passwordHash,
      role: input.role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.rows.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.rows.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async listByOrganization(organizationId: string): Promise<User[]> {
    return [...this.rows.values()].filter((user) => user.organizationId === organizationId);
  }

  async update(id: string, patch: UpdateUserInput): Promise<User | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: User = {
      ...existing,
      email: patch.email ?? existing.email,
      role: patch.role ?? existing.role,
      status: patch.status ?? existing.status,
      passwordHash: patch.passwordHash ?? existing.passwordHash,
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryServiceAccountsRepository implements ServiceAccountsRepository {
  private readonly rows = new Map<string, ServiceAccount>();

  async create(input: CreateServiceAccountInput): Promise<ServiceAccount> {
    const now = new Date().toISOString();
    const account: ServiceAccount = {
      id: randomUUID(),
      organizationId: input.organizationId,
      name: input.name,
      status: "active",
      permissions: input.permissions,
      credentialHash: input.credentialHash,
      credentialPrefix: input.credentialPrefix,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(account.id, account);
    return account;
  }

  async findById(id: string): Promise<ServiceAccount | null> {
    return this.rows.get(id) ?? null;
  }

  async listByOrganization(organizationId: string): Promise<ServiceAccount[]> {
    return [...this.rows.values()].filter((account) => account.organizationId === organizationId);
  }

  async update(id: string, patch: UpdateServiceAccountInput): Promise<ServiceAccount | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: ServiceAccount = {
      ...existing,
      name: patch.name ?? existing.name,
      permissions: patch.permissions ?? existing.permissions,
      status: patch.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return updated;
  }
}
