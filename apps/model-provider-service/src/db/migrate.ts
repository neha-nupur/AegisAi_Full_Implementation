import * as dotenv from "dotenv";
import * as path from "path";
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
      console.log("model-provider-service: migration complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("model-provider-service: migration failed", err);
      process.exit(1);
    });
}
