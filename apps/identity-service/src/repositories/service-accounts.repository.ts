import type { Pool, QueryResultRow } from "pg";
import { getPool } from "../db/pool";
import type { Permission } from "../domain/rbac";
import type { EntityStatus, ServiceAccount } from "../types";

export interface CreateServiceAccountInput {
  organizationId: string;
  name: string;
  permissions: Permission[];
  credentialHash: string;
  credentialPrefix: string;
}

export interface UpdateServiceAccountInput {
  name?: string;
  permissions?: Permission[];
  status?: EntityStatus;
}

/**
 * Repository contract for `service_accounts`. The only code allowed
 * to query this table directly (CLAUDE.md section 3).
 */
export interface ServiceAccountsRepository {
  create(input: CreateServiceAccountInput): Promise<ServiceAccount>;
  findById(id: string): Promise<ServiceAccount | null>;
  listByOrganization(organizationId: string): Promise<ServiceAccount[]>;
  update(id: string, patch: UpdateServiceAccountInput): Promise<ServiceAccount | null>;
}

interface ServiceAccountRow extends QueryResultRow {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  permissions: string[];
  credential_hash: string;
  credential_prefix: string;
  created_at: Date;
  updated_at: Date;
}

function toServiceAccount(row: ServiceAccountRow): ServiceAccount {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    status: row.status as EntityStatus,
    permissions: row.permissions as Permission[],
    credentialHash: row.credential_hash,
    credentialPrefix: row.credential_prefix,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS = `id, organization_id, name, status, permissions, credential_hash, credential_prefix, created_at, updated_at`;

export class PgServiceAccountsRepository implements ServiceAccountsRepository {
  /** Lazy on purpose — see PgOrganizationsRepository for why. */
  private get pool(): Pool {
    return getPool();
  }

  async create(input: CreateServiceAccountInput): Promise<ServiceAccount> {
    const result = await this.pool.query<ServiceAccountRow>(
      `INSERT INTO service_accounts (organization_id, name, permissions, credential_hash, credential_prefix)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT_COLUMNS}`,
      [input.organizationId, input.name, input.permissions, input.credentialHash, input.credentialPrefix]
    );
    return toServiceAccount(result.rows[0]);
  }

  async findById(id: string): Promise<ServiceAccount | null> {
    const result = await this.pool.query<ServiceAccountRow>(
      `SELECT ${SELECT_COLUMNS} FROM service_accounts WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? toServiceAccount(result.rows[0]) : null;
  }

  async listByOrganization(organizationId: string): Promise<ServiceAccount[]> {
    const result = await this.pool.query<ServiceAccountRow>(
      `SELECT ${SELECT_COLUMNS} FROM service_accounts WHERE organization_id = $1 ORDER BY created_at ASC`,
      [organizationId]
    );
    return result.rows.map(toServiceAccount);
  }

  async update(id: string, patch: UpdateServiceAccountInput): Promise<ServiceAccount | null> {
    const result = await this.pool.query<ServiceAccountRow>(
      `UPDATE service_accounts
       SET name = COALESCE($2, name),
           permissions = COALESCE($3, permissions),
           status = COALESCE($4, status),
           updated_at = now()
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [id, patch.name ?? null, patch.permissions ?? null, patch.status ?? null]
    );
    return result.rows[0] ? toServiceAccount(result.rows[0]) : null;
  }
}
