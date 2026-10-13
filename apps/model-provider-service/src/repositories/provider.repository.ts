import type { Pool, QueryResultRow } from "pg";
import { getPool } from "../db/pool";
import type { Provider, ProviderHealthStatus, ProviderStatus, ProviderType } from "../types";

export interface CreateProviderInput {
  organizationId?: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  status: ProviderStatus;
  healthStatus: ProviderHealthStatus;
  priority: number;
  configurationReference: string;
}

export interface UpdateProviderInput {
  name?: string;
  baseUrl?: string;
  status?: ProviderStatus;
  healthStatus?: ProviderHealthStatus;
  priority?: number;
  configurationReference?: string;
}

export interface ProviderRepository {
  create(input: CreateProviderInput): Promise<Provider>;
  findById(id: string): Promise<Provider | null>;
  listAll(): Promise<Provider[]>;
  update(id: string, patch: UpdateProviderInput): Promise<Provider | null>;
}

interface ProviderRow extends QueryResultRow {
  id: string;
  organization_id: string | null;
  name: string;
  type: string;
  base_url: string;
  status: string;
  health_status: string;
  priority: number;
  configuration_reference: string;
  created_at: Date;
  updated_at: Date;
}

function toProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    organizationId: row.organization_id || undefined,
    name: row.name,
    type: row.type as ProviderType,
    baseUrl: row.base_url,
    status: row.status as ProviderStatus,
    healthStatus: row.health_status as ProviderHealthStatus,
    priority: row.priority,
    configurationReference: row.configuration_reference,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS = `id, organization_id, name, type, base_url, status, health_status, priority, configuration_reference, created_at, updated_at`;

export class PgProviderRepository implements ProviderRepository {
  private get pool(): Pool {
    return getPool();
  }

  async create(input: CreateProviderInput): Promise<Provider> {
    const result = await this.pool.query<ProviderRow>(
      `INSERT INTO providers (organization_id, name, type, base_url, status, health_status, priority, configuration_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SELECT_COLUMNS}`,
      [
        input.organizationId || null,
        input.name,
        input.type,
        input.baseUrl,
        input.status,
        input.healthStatus,
        input.priority,
        input.configurationReference
      ]
    );
    return toProvider(result.rows[0]);
  }

  async findById(id: string): Promise<Provider | null> {
    const result = await this.pool.query<ProviderRow>(
      `SELECT ${SELECT_COLUMNS} FROM providers WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? toProvider(result.rows[0]) : null;
  }

  async listAll(): Promise<Provider[]> {
    const result = await this.pool.query<ProviderRow>(
      `SELECT ${SELECT_COLUMNS} FROM providers ORDER BY priority ASC, created_at DESC`
    );
    return result.rows.map(toProvider);
  }

  async update(id: string, patch: UpdateProviderInput): Promise<Provider | null> {
    const result = await this.pool.query<ProviderRow>(
      `UPDATE providers
       SET name = COALESCE($2, name),
           base_url = COALESCE($3, base_url),
           status = COALESCE($4, status),
           health_status = COALESCE($5, health_status),
           priority = COALESCE($6, priority),
           configuration_reference = COALESCE($7, configuration_reference),
           updated_at = now()
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        patch.name ?? null,
        patch.baseUrl ?? null,
        patch.status ?? null,
        patch.healthStatus ?? null,
        patch.priority ?? null,
        patch.configurationReference ?? null
      ]
    );
    return result.rows[0] ? toProvider(result.rows[0]) : null;
  }
}
