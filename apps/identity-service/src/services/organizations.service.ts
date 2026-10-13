import { HttpError } from "@aegisai/shared-types";
import { toPublicOrganization } from "../domain/mappers";
import type { OrganizationsRepository } from "../repositories/organizations.repository";
import type { AuthenticatedPrincipal, Organization } from "../types";

export interface UpdateOrganizationRequest {
  name?: string;
  status?: string;
}

/**
 * Scoped to the caller's own organization — `id` must equal
 * `actor.organizationId`, or the request is treated as not found
 * (404), same cross-organization-isolation rationale as
 * `UsersService`. There is no "platform admin" role in Phase 2 that
 * can see across organizations.
 */
export class OrganizationsService {
  constructor(private readonly organizations: OrganizationsRepository) {}

  async getById(id: string, actor: AuthenticatedPrincipal): Promise<Organization> {
    this.assertOwnOrganization(id, actor);
    const organization = await this.organizations.findById(id);
    if (!organization) {
      throw new HttpError(404, "ORGANIZATION_NOT_FOUND", "Organization not found.");
    }
    return toPublicOrganization(organization);
  }

  async update(id: string, patch: UpdateOrganizationRequest, actor: AuthenticatedPrincipal): Promise<Organization> {
    this.assertOwnOrganization(id, actor);

    if (patch.status !== undefined && patch.status !== "active" && patch.status !== "suspended") {
      throw new HttpError(400, "VALIDATION_ERROR", `status must be "active" or "suspended" (got "${patch.status}").`);
    }

    const updated = await this.organizations.update(id, {
      name: patch.name,
      status: patch.status as Organization["status"] | undefined,
    });
    if (!updated) {
      throw new HttpError(404, "ORGANIZATION_NOT_FOUND", "Organization not found.");
    }
    return toPublicOrganization(updated);
  }

  private assertOwnOrganization(id: string, actor: AuthenticatedPrincipal): void {
    if (id !== actor.organizationId) {
      throw new HttpError(404, "ORGANIZATION_NOT_FOUND", "Organization not found.");
    }
  }
}
