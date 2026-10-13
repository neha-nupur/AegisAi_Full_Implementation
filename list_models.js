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

async function check() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const res = await client.query(`SELECT id, name, active, configuration FROM models;`);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
check().catch(console.error);
