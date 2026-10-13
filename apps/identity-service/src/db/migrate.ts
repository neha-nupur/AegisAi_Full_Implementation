import * as dotenv from "dotenv";
import * as path from "path";
// Loads the repo-root .env so `npm run migrate -w <service>` works
// standalone (matches apps/model-provider-service/src/db/seed.ts's
// convention) without requiring the shell to have sourced .env first
// — Phase 11 hardening: verified live against a real local
// PostgreSQL instance in this session.
dotenv.config({ path: path.join(__dirname, "../../../../.env") });

import { getPool } from "./pool";
import { SCHEMA_SQL } from "./schema";

/** Applies this service's schema (idempotent — safe to run repeatedly). */
export async function migrate(): Promise<void> {
  const pool = getPool();
  await pool.query(SCHEMA_SQL);
}

/** Allows `node dist/db/migrate.js` (see package.json's `migrate` script). */
if (require.main === module) {
  migrate()
    .then(() => {
      console.log("identity-service: migration complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("identity-service: migration failed", err);
      process.exit(1);
    });
}
