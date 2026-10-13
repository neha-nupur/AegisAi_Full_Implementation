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
const client = new Client({ connectionString: databaseUrl });

async function run() {
  await client.connect();
  const res = await client.query("UPDATE models SET name='gemini-3.8-flash', configuration='{\"apiModelName\":\"gemini-3.8-flash\"}' WHERE name='gemini-1.5-flash'");
  console.log(`Updated ${res.rowCount} rows.`);
  await client.end();
}

run().catch(console.error);
