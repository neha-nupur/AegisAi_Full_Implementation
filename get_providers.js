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
  const res = await client.query(`SELECT id, type FROM providers;`);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run().catch(console.error);
