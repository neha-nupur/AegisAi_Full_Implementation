import { Pool } from "pg";
import { loadConfig } from "@aegisai/config";

/**
 * The Gateway service's PostgreSQL connection pool — the only
 * connection to `ai_requests` in the whole project (CLAUDE.md section
 * 3: no other service may query this table directly). Same lazy
 * pattern as `apps/identity-service/src/db/pool.ts` — see that file
 * for why it is not created at module-import time.
 */
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const config = loadConfig();
    pool = new Pool({ connectionString: config.databaseUrl });
  }
  return pool;
}

/** Test/shutdown helper: closes the pool and clears the memoized instance. */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
