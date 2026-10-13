import { randomBytes } from "node:crypto";
import { HttpError } from "@aegisai/shared-types";
import { toPublicServiceAccount } from "../domain/mappers";
import { isPermission, type Permission } from "../domain/rbac";
import type { ServiceAccountsRepository } from "../repositories/service-accounts.repository";
import type { AuthenticatedPrincipal, PublicServiceAccount, ServiceAccount } from "../types";
import { PasswordService } from "./password.service";

export interface CreateServiceAccountRequest {
  name: string;
  permissions: string[];
}

export interface UpdateServiceAccountRequest {
  name?: string;
  permissions?: string[];
  status?: string;
}

export interface CreatedServiceAccount {
  serviceAccount: PublicServiceAccount;
  /** The plaintext credential — returned exactly once, at creation. It is never stored or retrievable again. */
  credential: string;
}

const CREDENTIAL_PREFIX_LENGTH = 12;

function generateCredential(): string {
  // "sak_" (service-account key) + 32 random bytes, hex-encoded.
  return `sak_${randomBytes(32).toString("hex")}`;
}

function validatePermissions(permissions: string[]): Permission[] {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "permissions must be a non-empty array of valid permission strings.");
  }
  const invalid = permissions.filter((permission) => !isPermission(permission));
  if (invalid.length > 0) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid permission(s): ${invalid.join(", ")}.`);
  }
  return permissions as Permission[];
}

/**
 * Every operation is scoped to `actor.organizationId`, same rationale
 * as `UsersService` — a service account in a different organization
 * is treated as not found (404), never 403.
 */
export class ServiceAccountsService {
  constructor(
    private readonly serviceAccounts: ServiceAccountsRepository,
    private readonly passwords: PasswordService = new PasswordService()
  ) {}

  async create(input: CreateServiceAccountRequest, actor: AuthenticatedPrincipal): Promise<CreatedServiceAccount> {
    if (!input.name || input.name.trim().length === 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "name is required.");
    }
    const permissions = validatePermissions(input.permissions);

    const credential = generateCredential();
    const credentialHash = await this.passwords.hash(credential);
    const credentialPrefix = credential.slice(0, CREDENTIAL_PREFIX_LENGTH);

    const record = await this.serviceAccounts.create({
      organizationId: actor.organizationId,
      name: input.name,
      permissions,
      credentialHash,
      credentialPrefix,
    });

    return { serviceAccount: toPublicServiceAccount(record), credential };
  }

  async list(actor: AuthenticatedPrincipal): Promise<PublicServiceAccount[]> {
    const accounts = await this.serviceAccounts.listByOrganization(actor.organizationId);
    return accounts.map(toPublicServiceAccount);
  }

  async update(id: string, patch: UpdateServiceAccountRequest, actor: AuthenticatedPrincipal): Promise<PublicServiceAccount> {
    await this.findScoped(id, actor);

    if (patch.status !== undefined && patch.status !== "active" && patch.status !== "disabled") {
      throw new HttpError(400, "VALIDATION_ERROR", `status must be "active" or "disabled" (got "${patch.status}").`);
    }
    const permissions = patch.permissions !== undefined ? validatePermissions(patch.permissions) : undefined;

    const updated = await this.serviceAccounts.update(id, {
      name: patch.name,
      permissions,
      status: patch.status as ServiceAccount["status"] | undefined,
    });
    if (!updated) {
      throw new HttpError(404, "SERVICE_ACCOUNT_NOT_FOUND", "Service account not found.");
    }
    return toPublicServiceAccount(updated);
  }

  /** DELETE /v1/service-accounts/:id performs a soft-disable, not a hard delete — see docs/api-conventions.md. */
  async disable(id: string, actor: AuthenticatedPrincipal): Promise<PublicServiceAccount> {
    await this.findScoped(id, actor);
    const updated = await this.serviceAccounts.update(id, { status: "disabled" });
    if (!updated) {
      throw new HttpError(404, "SERVICE_ACCOUNT_NOT_FOUND", "Service account not found.");
    }
    return toPublicServiceAccount(updated);
  }

  private async findScoped(id: string, actor: AuthenticatedPrincipal): Promise<ServiceAccount> {
    const account = await this.serviceAccounts.findById(id);
    if (!account || account.organizationId !== actor.organizationId) {
      throw new HttpError(404, "SERVICE_ACCOUNT_NOT_FOUND", "Service account not found.");
    }
    return account;
  }
}
