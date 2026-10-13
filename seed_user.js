const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {
  // dotenv is available via the workspace install; if it is missing,
  // the script still works when the caller has already exported env vars.
}
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not configured. Copy .env.example to .env and set DATABASE_URL.");
  process.exit(1);
}

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const orgName = process.env.SEED_ORG_NAME || "AegisAI Demo Organization";
const orgSlug = process.env.SEED_ORG_SLUG || "aegisai-demo-organization";
const role = process.env.SEED_ROLE || "ORGANIZATION_ADMIN";

if (!email || !password) {
  console.error(
    "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not configured. Set them in .env before seeding."
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function seed() {
  try {
    const userRes = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userRes.rows.length > 0) {
      console.log("User already exists:", email);
      return;
    }

    let orgRes = await pool.query("SELECT id FROM organizations WHERE slug = $1", [orgSlug]);
    if (orgRes.rows.length === 0) {
      orgRes = await pool.query(
        "INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id",
        [orgName, orgSlug]
      );
    }
    const orgId = orgRes.rows[0].id;

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (organization_id, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5)",
      [orgId, email, hash, role, "active"]
    );
    console.log("User created:", email);
  } catch (err) {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
