import { HttpError } from "@aegisai/shared-types";
import { toPublicUser } from "../domain/mappers";
import { isRole } from "../domain/rbac";
import type { OrganizationsRepository } from "../repositories/organizations.repository";
import type { UsersRepository } from "../repositories/users.repository";
import type { AuthenticatedPrincipal, PublicUser, User } from "../types";
import { PasswordService } from "./password.service";

export interface CreateUserRequest {
  email: string;
  password: string;
  role: string;
}

export interface UpdateUserRequest {
  email?: string;
  role?: string;
  status?: string;
  password?: string;
}

/**
 * Every operation here is scoped to `actor.organizationId` — this is
 * what enforces multi-tenant isolation (the "cross-organization
 * access" requirement). A request for a user that exists but belongs
 * to a different organization is treated exactly like a request for
 * a user that does not exist (404), not 403 — this avoids confirming
 * to a caller in one organization that a given ID exists in another.
 */
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly organizations: OrganizationsRepository,
    private readonly passwords: PasswordService = new PasswordService()
  ) {}

  async create(input: CreateUserRequest, actor: AuthenticatedPrincipal): Promise<PublicUser> {
    if (!input.email || !input.password) {
      throw new HttpError(400, "VALIDATION_ERROR", "email and password are required.");
    }
    if (!isRole(input.role)) {
      throw new HttpError(400, "VALIDATION_ERROR", `role must be one of ORGANIZATION_ADMIN, DEVELOPER, SECURITY_AUDITOR (got "${input.role}").`);
    }

    // organizationId is always the actor's own — never taken from the
    // request body — so no caller can create a user in an org they
    // don't belong to, regardless of what the request contains.
    const organization = await this.organizations.findById(actor.organizationId);
    if (!organization) {
      throw new HttpError(404, "ORGANIZATION_NOT_FOUND", "Your organization could not be found.");
    }

    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new HttpError(409, "EMAIL_ALREADY_EXISTS", "A user with this email already exists.");
    }

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.users.create({
      organizationId: actor.organizationId,
      email: input.email,
      passwordHash,
      role: input.role,
    });

    return toPublicUser(user);
  }

  async list(actor: AuthenticatedPrincipal): Promise<PublicUser[]> {
    const users = await this.users.listByOrganization(actor.organizationId);
    return users.map(toPublicUser);
  }

  async getById(id: string, actor: AuthenticatedPrincipal): Promise<PublicUser> {
    const user = await this.findScoped(id, actor);
    return toPublicUser(user);
  }

  async update(id: string, patch: UpdateUserRequest, actor: AuthenticatedPrincipal): Promise<PublicUser> {
    await this.findScoped(id, actor);

    if (patch.role !== undefined && !isRole(patch.role)) {
      throw new HttpError(400, "VALIDATION_ERROR", `role must be one of ORGANIZATION_ADMIN, DEVELOPER, SECURITY_AUDITOR (got "${patch.role}").`);
    }
    if (patch.status !== undefined && patch.status !== "active" && patch.status !== "disabled") {
      throw new HttpError(400, "VALIDATION_ERROR", `status must be "active" or "disabled" (got "${patch.status}").`);
    }

    const passwordHash = patch.password ? await this.passwords.hash(patch.password) : undefined;

    const updated = await this.users.update(id, {
      email: patch.email,
      role: isRole(patch.role) ? patch.role : undefined,
      status: patch.status as User["status"] | undefined,
      passwordHash,
    });
    if (!updated) {
      throw new HttpError(404, "USER_NOT_FOUND", "User not found.");
    }
    return toPublicUser(updated);
  }

  /** DELETE /v1/users/:id performs a soft-disable, not a hard delete — see docs/api-conventions.md. */
  async disable(id: string, actor: AuthenticatedPrincipal): Promise<PublicUser> {
    await this.findScoped(id, actor);
    const updated = await this.users.update(id, { status: "disabled" });
    if (!updated) {
      throw new HttpError(404, "USER_NOT_FOUND", "User not found.");
    }
    return toPublicUser(updated);
  }

  private async findScoped(id: string, actor: AuthenticatedPrincipal): Promise<User> {
    const user = await this.users.findById(id);
    if (!user || user.organizationId !== actor.organizationId) {
      throw new HttpError(404, "USER_NOT_FOUND", "User not found.");
    }
    return user;
  }
}
