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

export async function migrate(): Promise<void> {
  const pool = getPool();
  await pool.query(SCHEMA_SQL);
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log("policy-service: migration complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("policy-service: migration failed", err);
      process.exit(1);
    });
}
