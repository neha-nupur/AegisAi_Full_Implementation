import type { Pool, QueryResultRow } from "pg";
import { getPool } from "../db/pool";
import type { CostMetadata, Model, SensitivityLevel } from "../types";

export interface CreateModelInput {
  providerId: string;
  name: string;
  capabilities: string[];
  sensitivityLevel: SensitivityLevel;
  costMetadata: CostMetadata;
  active: boolean;
  configuration: Record<string, any>;
}

export interface UpdateModelInput {
  name?: string;
  capabilities?: string[];
  sensitivityLevel?: SensitivityLevel;
  costMetadata?: CostMetadata;
  active?: boolean;
  configuration?: Record<string, any>;
}

export interface ModelRepository {
  create(input: CreateModelInput): Promise<Model>;
  findById(id: string): Promise<Model | null>;
  findByProviderId(providerId: string): Promise<Model[]>;
  listAll(): Promise<Model[]>;
  update(id: string, patch: UpdateModelInput): Promise<Model | null>;
}

interface ModelRow extends QueryResultRow {
  id: string;
  provider_id: string;
  name: string;
  capabilities: string[]; // PG array
  sensitivity_level: string;
  cost_metadata: any; // JSONB
  active: boolean;
  configuration: any; // JSONB
  created_at: Date;
  updated_at: Date;
}

function toModel(row: ModelRow): Model {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    capabilities: row.capabilities,
    sensitivityLevel: row.sensitivity_level as SensitivityLevel,
    costMetadata: row.cost_metadata as CostMetadata,
    active: row.active,
    configuration: row.configuration,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS = `id, provider_id, name, capabilities, sensitivity_level, cost_metadata, active, configuration, created_at, updated_at`;

export class PgModelRepository implements ModelRepository {
  private get pool(): Pool {
    return getPool();
  }

  async create(input: CreateModelInput): Promise<Model> {
    const result = await this.pool.query<ModelRow>(
      `INSERT INTO models (provider_id, name, capabilities, sensitivity_level, cost_metadata, active, configuration)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SELECT_COLUMNS}`,
      [
        input.providerId,
        input.name,
        input.capabilities,
        input.sensitivityLevel,
        input.costMetadata,
        input.active,
        input.configuration
      ]
    );
    return toModel(result.rows[0]);
  }

  async findById(id: string): Promise<Model | null> {
    const result = await this.pool.query<ModelRow>(
      `SELECT ${SELECT_COLUMNS} FROM models WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? toModel(result.rows[0]) : null;
  }

  async findByProviderId(providerId: string): Promise<Model[]> {
    const result = await this.pool.query<ModelRow>(
      `SELECT ${SELECT_COLUMNS} FROM models WHERE provider_id = $1 ORDER BY name ASC`,
      [providerId]
    );
    return result.rows.map(toModel);
  }

  async listAll(): Promise<Model[]> {
    const result = await this.pool.query<ModelRow>(
      `SELECT ${SELECT_COLUMNS} FROM models ORDER BY name ASC`
    );
    return result.rows.map(toModel);
  }

  async update(id: string, patch: UpdateModelInput): Promise<Model | null> {
    const result = await this.pool.query<ModelRow>(
      `UPDATE models
       SET name = COALESCE($2, name),
           capabilities = COALESCE($3, capabilities),
           sensitivity_level = COALESCE($4, sensitivity_level),
           cost_metadata = COALESCE($5, cost_metadata),
           active = COALESCE($6, active),
           configuration = COALESCE($7, configuration),
           updated_at = now()
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        patch.name ?? null,
        patch.capabilities ?? null,
        patch.sensitivityLevel ?? null,
        patch.costMetadata ?? null,
        patch.active ?? null,
        patch.configuration ?? null
      ]
    );
    return result.rows[0] ? toModel(result.rows[0]) : null;
  }
}
