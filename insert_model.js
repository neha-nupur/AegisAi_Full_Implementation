const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {}
const { Client } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not configured. Configure it in .env or your environment.");
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  
  await client.query(`
    INSERT INTO models (id, provider_id, name, capabilities, sensitivity_level, cost_metadata, active, configuration)
    VALUES (
      gen_random_uuid(),
      'f9af37da-0a6c-439e-9e96-22cdbd2aa457',
      'gemini-3.5-flash',
      ARRAY['chat'],
      'low',
      '{"inputCostPer1k": 0.001, "outputCostPer1k": 0.002, "currency": "USD"}'::jsonb,
      true,
      '{"apiModelName": "gemini-3.5-flash"}'::jsonb
    );
  `);
  console.log("Inserted gemini-3.5-flash model");
  await client.end();
}
run().catch(console.error);
