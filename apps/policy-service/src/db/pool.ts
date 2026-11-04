import { Pool } from "pg";
import { loadConfig, resolvePgPoolConfig } from "@aegisai/config";

/** Policy & Approval Service's PostgreSQL pool — the only connection to `policies`/`approvals` (see docs/database-ownership.md). Same lazy pattern as the other services' pools. */
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const config = loadConfig();
    pool = new Pool(resolvePgPoolConfig(config.databaseUrl, config.nodeEnv));
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
