import type { Pool, QueryResultRow } from "pg";
import { getPool } from "../db/pool";
import type { Role } from "../domain/rbac";
import type { EntityStatus, User } from "../types";

export interface CreateUserInput {
  organizationId: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export interface UpdateUserInput {
  email?: string;
  emailVerified?: boolean;
  role?: Role;
  status?: EntityStatus;
  passwordHash?: string;
  verificationTokenHash?: string | null;
  verificationTokenExpiresAt?: string | null;
  resetTokenHash?: string | null;
  resetTokenExpiresAt?: string | null;
}

/**
 * Repository contract for `users`. The only code allowed to query
 * this table directly (CLAUDE.md section 3) — everything else goes
 * through `UsersService`, which depends on this interface so tests
 * can inject an in-memory fake instead of a real database.
 */
export interface UsersRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** Lists users. Scoping to the caller's organization is the service layer's job, not the repository's. */
  listByOrganization(organizationId: string): Promise<User[]>;
  update(id: string, patch: UpdateUserInput): Promise<User | null>;
}

interface UserRow extends QueryResultRow {
  id: string;
  organization_id: string;
  email: string;
  email_verified: boolean;
  password_hash: string;
  role: string;
  status: string;
  verification_token_hash: string | null;
  verification_token_expires_at: Date | null;
  reset_token_hash: string | null;
  reset_token_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    emailVerified: row.email_verified,
    passwordHash: row.password_hash,
    role: row.role as Role,
    status: row.status as EntityStatus,
    verificationTokenHash: row.verification_token_hash,
    verificationTokenExpiresAt: row.verification_token_expires_at?.toISOString() ?? null,
    resetTokenHash: row.reset_token_hash,
    resetTokenExpiresAt: row.reset_token_expires_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS = `id, organization_id, email, email_verified, password_hash, role, status, verification_token_hash, verification_token_expires_at, reset_token_hash, reset_token_expires_at, created_at, updated_at`;

export class PgUsersRepository implements UsersRepository {
  /** Lazy on purpose — see PgOrganizationsRepository for why. */
  private get pool(): Pool {
    return getPool();
  }

  async create(input: CreateUserInput): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (organization_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT_COLUMNS}`,
      [input.organizationId, input.email, input.passwordHash, input.role]
    );
    return toUser(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`, [id]);
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`, [email]);
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async listByOrganization(organizationId: string): Promise<User[]> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE organization_id = $1 ORDER BY created_at ASC`,
      [organizationId]
    );
    return result.rows.map(toUser);
  }

  async update(id: string, patch: UpdateUserInput): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET email = COALESCE($2, email),
           email_verified = COALESCE($3, email_verified),
           role = COALESCE($4, role),
           status = COALESCE($5, status),
           password_hash = COALESCE($6, password_hash),
           verification_token_hash = COALESCE($7, verification_token_hash),
           verification_token_expires_at = COALESCE($8, verification_token_expires_at),
           reset_token_hash = COALESCE($9, reset_token_hash),
           reset_token_expires_at = COALESCE($10, reset_token_expires_at),
           updated_at = now()
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [
        id, 
        patch.email ?? null, 
        patch.emailVerified ?? null,
        patch.role ?? null, 
        patch.status ?? null, 
        patch.passwordHash ?? null,
        patch.verificationTokenHash !== undefined ? patch.verificationTokenHash : null,
        patch.verificationTokenExpiresAt !== undefined ? patch.verificationTokenExpiresAt : null,
        patch.resetTokenHash !== undefined ? patch.resetTokenHash : null,
        patch.resetTokenExpiresAt !== undefined ? patch.resetTokenExpiresAt : null
      ]
    );
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }
}
