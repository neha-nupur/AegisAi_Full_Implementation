import { Pool } from "pg";
import { loadConfig } from "@aegisai/config";

/**
 * The Identity service's PostgreSQL connection pool — the only
 * connection to `organizations` / `users` / `service_accounts` in the
 * whole project (CLAUDE.md section 3: no other service may query
 * these tables directly).
 *
 * Deliberately lazy: `loadConfig()` / the `Pool` are only created on
 * first real use, not at module import time. Route/controller/service
 * wiring happens at module load (see `routes/api.routes.ts`), and
 * that must not require `DATABASE_URL` etc. to already be set — most
 * of this service's own tests inject in-memory fake repositories and
 * never touch this module at all.
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
