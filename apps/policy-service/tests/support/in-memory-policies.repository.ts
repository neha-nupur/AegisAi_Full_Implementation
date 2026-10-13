import { randomUUID } from "node:crypto";
import type { CreatePolicyRow, PoliciesRepository, UpdatePolicyRow } from "../../src/repositories/policies.repository";
import type { Policy } from "../../src/domain/policy-types";

export class InMemoryPoliciesRepository implements PoliciesRepository {
  private readonly rows = new Map<string, Policy>();

  async create(input: CreatePolicyRow): Promise<Policy> {
    const now = new Date().toISOString();
    const policy: Policy = {
      id: randomUUID(),
      organizationId: input.organizationId,
      name: input.name,
      version: 1,
      rules: input.rules,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(policy.id, policy);
    return policy;
  }

  async findById(id: string): Promise<Policy | null> {
    return this.rows.get(id) ?? null;
  }

  async listByOrganization(organizationId: string): Promise<Policy[]> {
    return [...this.rows.values()].filter((p) => p.organizationId === organizationId);
  }

  async update(id: string, patch: UpdatePolicyRow): Promise<Policy | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: Policy = {
      ...existing,
      name: patch.name ?? existing.name,
      rules: patch.rules ?? existing.rules,
      status: patch.status ?? existing.status,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
}
