import { HttpError } from "@aegisai/shared-types";
import type { AuthenticatedPrincipal } from "@aegisai/identity-service";
import type { PoliciesRepository } from "../repositories/policies.repository";
import type { CreatePolicyInput, Policy, UpdatePolicyInput } from "../domain/policy-types";

/** Standard CRUD service for `policies`, same scoping convention as `AiRequestsService` (gateway-service): a policy in another organization is 404, not 403. */
export class PoliciesService {
  constructor(private readonly repository: PoliciesRepository) {}

  async create(input: CreatePolicyInput, actor: AuthenticatedPrincipal): Promise<Policy> {
    return this.repository.create({
      organizationId: actor.organizationId,
      name: input.name,
      rules: input.rules,
      status: input.status ?? "ACTIVE",
    });
  }

  async getById(id: string, actor: AuthenticatedPrincipal): Promise<Policy> {
    return this.findScoped(id, actor);
  }

  async list(actor: AuthenticatedPrincipal): Promise<Policy[]> {
    return this.repository.listByOrganization(actor.organizationId);
  }

  async update(id: string, input: UpdatePolicyInput, actor: AuthenticatedPrincipal): Promise<Policy> {
    await this.findScoped(id, actor);
    const updated = await this.repository.update(id, input);
    if (!updated) {
      throw new HttpError(404, "POLICY_NOT_FOUND", "Policy not found.");
    }
    return updated;
  }

  async delete(id: string, actor: AuthenticatedPrincipal): Promise<void> {
    await this.findScoped(id, actor);
    await this.repository.delete(id);
  }

  private async findScoped(id: string, actor: AuthenticatedPrincipal): Promise<Policy> {
    const policy = await this.repository.findById(id);
    if (!policy || policy.organizationId !== actor.organizationId) {
      throw new HttpError(404, "POLICY_NOT_FOUND", "Policy not found.");
    }
    return policy;
  }
}
