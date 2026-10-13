import { Pool } from "pg";
import { loadConfig } from "@aegisai/config";

/** Policy & Approval Service's PostgreSQL pool — the only connection to `policies`/`approvals` (see docs/database-ownership.md). Same lazy pattern as the other services' pools. */
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const config = loadConfig();
    pool = new Pool({ connectionString: config.databaseUrl });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
