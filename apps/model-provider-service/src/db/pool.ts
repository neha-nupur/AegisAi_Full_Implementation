import { Pool } from "pg";
import { loadConfig, resolvePgPoolConfig } from "@aegisai/config";

/**
 * The Model Provider service's PostgreSQL connection pool — the only
 * connection to `providers` and `models` tables.
 *
 * Deliberately lazy.
 */
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const config = loadConfig();
    pool = new Pool(resolvePgPoolConfig(config.databaseUrl, config.nodeEnv));
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
