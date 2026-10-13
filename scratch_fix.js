const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {}
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not configured. Configure it in .env or your environment.");
  process.exit(1);
}
const pool = new Pool({ connectionString: databaseUrl });
async function fix() {
  await pool.query(`UPDATE models SET name = 'gemini-1.5-flash', configuration = '{"apiModelName": "gemini-1.5-flash"}' WHERE name = 'gemini-3.8-flash'`);
  console.log("Updated");
  process.exit(0);
}
fix();
