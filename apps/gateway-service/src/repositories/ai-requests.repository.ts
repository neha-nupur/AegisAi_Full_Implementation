import type { Pool, QueryResultRow } from "pg";
import { getPool } from "../db/pool";
import type { AIRequestStatus } from "../domain/status";
import type { AIRequest } from "../types";

export interface CreateAIRequestRow {
  organizationId: string;
  requesterId: string;
  input: string;
  modelPreference: string;
  policyId: string | null;
  traceId: string;
}

export interface UpdateAIRequestRow {
  status?: AIRequestStatus;
  modelId?: string | null;
  providerId?: string | null;
  output?: string | null;
  errorMessage?: string | null;
}

/**
 * Repository contract for `ai_requests`. The only code allowed to
 * query this table directly (CLAUDE.md section 3) — everything else
 * goes through `AiRequestsService`, which depends on this interface
 * so tests can inject an in-memory fake instead of a real database.
 */
export interface AiRequestsRepository {
  create(input: CreateAIRequestRow): Promise<AIRequest>;
  findById(id: string): Promise<AIRequest | null>;
  listByOrganization(organizationId: string, limit?: number, cursor?: string): Promise<{ items: AIRequest[]; nextCursor: string | null }>;
  update(id: string, patch: UpdateAIRequestRow): Promise<AIRequest | null>;
}

interface AIRequestRowDb extends QueryResultRow {
  id: string;
  organization_id: string;
  requester_id: string;
  input: string;
  model_preference: string;
  policy_id: string | null;
  status: string;
  model_id: string | null;
  provider_id: string | null;
  model_name: string | null;
  provider_name: string | null;
  trace_id: string;
  output: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

function toAIRequest(row: AIRequestRowDb): AIRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    requesterId: row.requester_id,
    input: row.input,
    modelPreference: row.model_preference,
    policyId: row.policy_id,
    status: row.status as AIRequestStatus,
    modelId: row.model_id,
    providerId: row.provider_id,
    modelName: row.model_name ?? undefined,
    providerName: row.provider_name ?? undefined,
    traceId: row.trace_id,
    output: row.output,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Base columns for queries without a JOIN (e.g. create, update). */
const BASE_COLUMNS = `
  id, organization_id, requester_id, input, model_preference, policy_id,
  status, model_id, provider_id, trace_id, output, error_message,
  created_at, updated_at
`;

/** Columns used in SELECT queries that LEFT JOIN models/providers to resolve names. */
const SELECT_WITH_NAMES = `
  r.id, r.organization_id, r.requester_id, r.input, r.model_preference, r.policy_id,
  r.status, r.model_id, r.provider_id, r.trace_id, r.output, r.error_message,
  r.created_at, r.updated_at,
  m.name AS model_name,
  p.name AS provider_name
`;

export class PgAiRequestsRepository implements AiRequestsRepository {
  /** Lazy on purpose — see PgUsersRepository (identity-service) for why. */
  private get pool(): Pool {
    return getPool();
  }

  async create(input: CreateAIRequestRow): Promise<AIRequest> {
    const result = await this.pool.query<AIRequestRowDb>(
      `INSERT INTO ai_requests (organization_id, requester_id, input, model_preference, policy_id, trace_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${BASE_COLUMNS}, NULL::text AS model_name, NULL::text AS provider_name`,
      [input.organizationId, input.requesterId, input.input, input.modelPreference, input.policyId, input.traceId]
    );
    return toAIRequest(result.rows[0]);
  }

  async findById(id: string): Promise<AIRequest | null> {
    const result = await this.pool.query<AIRequestRowDb>(
      `SELECT ${SELECT_WITH_NAMES}
       FROM ai_requests r
       LEFT JOIN models m ON m.id::text = r.model_id
       LEFT JOIN providers p ON p.id::text = r.provider_id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0] ? toAIRequest(result.rows[0]) : null;
  }

  async listByOrganization(organizationId: string, limit: number = 20, cursor?: string): Promise<{ items: AIRequest[]; nextCursor: string | null }> {
    let query = `
      SELECT ${SELECT_WITH_NAMES}
      FROM ai_requests r
      LEFT JOIN models m ON m.id::text = r.model_id
      LEFT JOIN providers p ON p.id::text = r.provider_id
      WHERE r.organization_id = $1`;
    const params: any[] = [organizationId];
    
    if (cursor) {
      params.push(cursor);
      query += ` AND (r.created_at, r.id) < (SELECT created_at, id FROM ai_requests WHERE id = $2)`;
    }
    
    // Request limit + 1 items to know if there's a next page
    params.push(limit + 1);
    query += ` ORDER BY r.created_at DESC, r.id DESC LIMIT $${params.length}`;

    const result = await this.pool.query<AIRequestRowDb>(query, params);
    
    const hasMore = result.rows.length > limit;
    const items = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items: items.map(toAIRequest),
      nextCursor
    };
  }

  async update(id: string, patch: UpdateAIRequestRow): Promise<AIRequest | null> {
    const result = await this.pool.query<AIRequestRowDb>(
      `UPDATE ai_requests
       SET status = COALESCE($2, status),
           model_id = COALESCE($3, model_id),
           provider_id = COALESCE($4, provider_id),
           output = COALESCE($5, output),
           error_message = COALESCE($6, error_message),
           updated_at = now()
       WHERE id = $1
       RETURNING ${BASE_COLUMNS}, NULL::text AS model_name, NULL::text AS provider_name`,
      [
        id,
        patch.status ?? null,
        patch.modelId ?? null,
        patch.providerId ?? null,
        patch.output ?? null,
        patch.errorMessage ?? null,
      ]
    );
    return result.rows[0] ? toAIRequest(result.rows[0]) : null;
  }
}
