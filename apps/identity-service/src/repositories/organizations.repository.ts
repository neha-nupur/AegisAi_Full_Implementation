import type { Pool, QueryResultRow } from "pg";
import { getPool } from "../db/pool";
import type { Organization } from "../types";

export interface UpdateOrganizationInput {
  name?: string;
  status?: Organization["status"];
}

/**
 * Repository contract for `organizations`. This — and its PostgreSQL
 * implementation below — is the *only* code allowed to query this
 * table (CLAUDE.md section 3). Services depend on this interface, not
 * on `PgOrganizationsRepository` directly, so tests can inject an
 * in-memory fake instead of requiring a real database.
 */
export interface OrganizationsRepository {
  findById(id: string): Promise<Organization | null>;
  update(id: string, patch: UpdateOrganizationInput): Promise<Organization | null>;
  create(name: string, slug: string): Promise<Organization>;
}

interface OrganizationRow extends QueryResultRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status as Organization["status"],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class PgOrganizationsRepository implements OrganizationsRepository {
  /**
   * Lazy on purpose: resolving the pool (and therefore `loadConfig()`)
   * must not happen at construction time, since this repository is
   * instantiated when `routes/api.routes.ts` loads — i.e. as soon as
   * anything imports this package. Only an actual query should
   * require `DATABASE_URL` to be set (see `db/pool.ts`).
   */
  private get pool(): Pool {
    return getPool();
  }

  async findById(id: string): Promise<Organization | null> {
    const result = await this.pool.query<OrganizationRow>(
      `SELECT id, name, slug, status, created_at, updated_at FROM organizations WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? toOrganization(result.rows[0]) : null;
  }

  async update(id: string, patch: UpdateOrganizationInput): Promise<Organization | null> {
    const result = await this.pool.query<OrganizationRow>(
      `UPDATE organizations
       SET name = COALESCE($2, name),
           status = COALESCE($3, status),
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, status, created_at, updated_at`,
      [id, patch.name ?? null, patch.status ?? null]
    );
    return result.rows[0] ? toOrganization(result.rows[0]) : null;
  }

  async create(name: string, slug: string): Promise<Organization> {
    const result = await this.pool.query<OrganizationRow>(
      `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug, status, created_at, updated_at`,
      [name, slug]
    );
    return toOrganization(result.rows[0]);
  }
}
