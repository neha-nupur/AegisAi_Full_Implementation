import type { Pool, QueryResultRow } from "pg";
import { getPool } from "../db/pool";
import type { Policy, PolicyRule, PolicyStatus } from "../domain/policy-types";

export interface CreatePolicyRow {
  organizationId: string;
  name: string;
  rules: PolicyRule[];
  status: PolicyStatus;
}

export interface UpdatePolicyRow {
  name?: string;
  rules?: PolicyRule[];
  status?: PolicyStatus;
}

export interface PoliciesRepository {
  create(input: CreatePolicyRow): Promise<Policy>;
  findById(id: string): Promise<Policy | null>;
  listByOrganization(organizationId: string): Promise<Policy[]>;
  update(id: string, patch: UpdatePolicyRow): Promise<Policy | null>;
  delete(id: string): Promise<boolean>;
}

interface PolicyRowDb extends QueryResultRow {
  id: string;
  organization_id: string;
  name: string;
  version: number;
  rules: PolicyRule[];
  status: string;
  created_at: Date;
  updated_at: Date;
}

function toPolicy(row: PolicyRowDb): Policy {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    version: row.version,
    rules: row.rules,
    status: row.status as PolicyStatus,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS = `id, organization_id, name, version, rules, status, created_at, updated_at`;

export class PgPoliciesRepository implements PoliciesRepository {
  private get pool(): Pool {
    return getPool();
  }

  async create(input: CreatePolicyRow): Promise<Policy> {
    const result = await this.pool.query<PolicyRowDb>(
      `INSERT INTO policies (organization_id, name, version, rules, status)
       VALUES ($1, $2, 1, $3, $4)
       RETURNING ${SELECT_COLUMNS}`,
      [input.organizationId, input.name, JSON.stringify(input.rules), input.status]
    );
    return toPolicy(result.rows[0]);
  }

  async findById(id: string): Promise<Policy | null> {
    const result = await this.pool.query<PolicyRowDb>(`SELECT ${SELECT_COLUMNS} FROM policies WHERE id = $1`, [id]);
    return result.rows[0] ? toPolicy(result.rows[0]) : null;
  }

  async listByOrganization(organizationId: string): Promise<Policy[]> {
    const result = await this.pool.query<PolicyRowDb>(
      `SELECT ${SELECT_COLUMNS} FROM policies WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    return result.rows.map(toPolicy);
  }

  /** A successful PATCH always bumps `version` by 1 — the entity's own change-tracking field, distinct from optimistic-locking. */
  async update(id: string, patch: UpdatePolicyRow): Promise<Policy | null> {
    const result = await this.pool.query<PolicyRowDb>(
      `UPDATE policies
       SET name = COALESCE($2, name),
           rules = COALESCE($3, rules),
           status = COALESCE($4, status),
           version = version + 1,
           updated_at = now()
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [id, patch.name ?? null, patch.rules ? JSON.stringify(patch.rules) : null, patch.status ?? null]
    );
    return result.rows[0] ? toPolicy(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM policies WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
