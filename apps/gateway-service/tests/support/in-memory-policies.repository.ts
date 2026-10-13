import { randomUUID } from "node:crypto";
import type { Policy, PoliciesRepository } from "@aegisai/policy-service";

/**
 * In-memory stand-in for policy-service's `PgPoliciesRepository`,
 * used only to keep this service's own tests from requiring a real
 * PostgreSQL connection. Test-only — never imported by production code.
 */
export class InMemoryPoliciesRepository implements PoliciesRepository {
  private readonly rows = new Map<string, Policy>();

  seed(policy: Policy): void {
    this.rows.set(policy.id, policy);
  }

  async create(input: { organizationId: string; name: string; rules: Policy["rules"]; status: Policy["status"] }): Promise<Policy> {
    const now = new Date().toISOString();
    const policy: Policy = { id: randomUUID(), organizationId: input.organizationId, name: input.name, version: 1, rules: input.rules, status: input.status, createdAt: now, updatedAt: now };
    this.rows.set(policy.id, policy);
    return policy;
  }

  async findById(id: string): Promise<Policy | null> {
    return this.rows.get(id) ?? null;
  }

  async listByOrganization(organizationId: string): Promise<Policy[]> {
    return [...this.rows.values()].filter((p) => p.organizationId === organizationId);
  }

  async update(id: string, patch: Partial<Pick<Policy, "name" | "rules" | "status">>): Promise<Policy | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: Policy = { ...existing, ...patch, version: existing.version + 1, updatedAt: new Date().toISOString() };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
}
