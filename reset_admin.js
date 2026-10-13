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
const email = process.env.SEED_ADMIN_EMAIL || "admin@aegisai.local";
const pool = new Pool({ connectionString: databaseUrl });

async function reset() {
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  console.log("Deleted admin:", email);
  await pool.end();
}
reset();

