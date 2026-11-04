const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {}

const { Pool } = require("pg");
const { resolvePgPoolConfig } = require("@aegisai/config");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FATAL: DATABASE_URL environment variable is not set. Migration cannot proceed.");
  process.exit(1);
}

const poolConfig = resolvePgPoolConfig(databaseUrl, process.env.NODE_ENV);
const pool = new Pool(poolConfig);

const MIGRATION_LOCK_ID = 1793738503;

const schemas = [
  { name: "identity-service", schema: require("../apps/identity-service/dist/db/schema").SCHEMA_SQL },
  { name: "model-provider-service", schema: require("../apps/model-provider-service/dist/db/schema").SCHEMA_SQL },
  { name: "gateway-service", schema: require("../apps/gateway-service/dist/db/schema").SCHEMA_SQL },
  { name: "policy-service", schema: require("../apps/policy-service/dist/db/schema").SCHEMA_SQL },
];

const EXPECTED_SCHEMA = {
  organizations: {
    columns: ["id", "name", "slug", "status", "created_at", "updated_at"],
    constraints: ["organizations_slug_unique", "organizations_status_check"],
  },
  users: {
    columns: [
      "id",
      "organization_id",
      "email",
      "password_hash",
      "role",
      "status",
      "created_at",
      "updated_at",
      "email_verified",
      "verification_token_hash",
      "verification_token_expires_at",
      "reset_token_hash",
      "reset_token_expires_at",
    ],
    constraints: ["users_email_unique", "users_role_check", "users_status_check"],
    indexes: ["idx_users_organization_id"],
  },
  service_accounts: {
    columns: [
      "id",
      "organization_id",
      "name",
      "status",
      "permissions",
      "credential_hash",
      "credential_prefix",
      "created_at",
      "updated_at",
    ],
    constraints: ["service_accounts_org_name_unique", "service_accounts_status_check"],
    indexes: ["idx_service_accounts_organization_id"],
  },
  organization_settings: {
    columns: [
      "id",
      "organization_id",
      "default_model_preference",
      "default_policy_name",
      "session_timeout_minutes",
      "require_approval_for_sensitive",
      "privacy_scanning_enabled",
      "auto_masking_enabled",
      "request_timeout_ms",
      "max_input_length",
      "requests_per_minute",
      "audit_logging_enabled",
      "created_at",
      "updated_at",
    ],
    constraints: ["organization_settings_org_unique"],
    indexes: ["idx_organization_settings_org_id"],
  },
  providers: {
    columns: [
      "id",
      "organization_id",
      "name",
      "type",
      "base_url",
      "status",
      "health_status",
      "priority",
      "configuration_reference",
      "created_at",
      "updated_at",
    ],
    constraints: ["providers_status_check", "providers_health_status_check"],
    indexes: ["idx_providers_organization_id"],
  },
  models: {
    columns: [
      "id",
      "provider_id",
      "name",
      "capabilities",
      "sensitivity_level",
      "cost_metadata",
      "active",
      "configuration",
      "created_at",
      "updated_at",
    ],
    constraints: ["models_sensitivity_check"],
    indexes: ["idx_models_provider_id"],
  },
  ai_requests: {
    columns: [
      "id",
      "organization_id",
      "requester_id",
      "input",
      "model_preference",
      "policy_id",
      "status",
      "model_id",
      "provider_id",
      "trace_id",
      "output",
      "error_message",
      "created_at",
      "updated_at",
    ],
    constraints: ["ai_requests_status_check"],
    indexes: ["idx_ai_requests_organization_id", "idx_ai_requests_organization_created"],
  },
  policies: {
    columns: [
      "id",
      "organization_id",
      "name",
      "version",
      "rules",
      "status",
      "created_at",
      "updated_at",
    ],
    constraints: ["policies_status_check"],
    indexes: ["idx_policies_organization_id"],
  },
  approvals: {
    columns: [
      "id",
      "organization_id",
      "ai_request_id",
      "policy_id",
      "matched_rule_id",
      "requester_id",
      "reason",
      "status",
      "decided_by",
      "decision_reason",
      "decided_at",
      "created_at",
      "updated_at",
    ],
    constraints: ["approvals_status_check"],
    indexes: ["idx_approvals_organization_id", "idx_approvals_ai_request_id"],
  },
};

async function verifySchema(client) {
  console.log("\n--- Performing Comprehensive Schema Verification ---");

  // 1. Verify all 9 expected tables exist
  const tablesRes = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
  );
  const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));
  const expectedTableNames = Object.keys(EXPECTED_SCHEMA);

  for (const tableName of expectedTableNames) {
    if (!existingTables.has(tableName)) {
      throw new Error(`Schema Verification Failed: Missing expected table "${tableName}"`);
    }
  }

  // 2. Fetch all columns in public schema
  const columnsRes = await client.query(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public';`
  );
  const tableColumns = new Map();
  for (const row of columnsRes.rows) {
    if (!tableColumns.has(row.table_name)) {
      tableColumns.set(row.table_name, new Set());
    }
    tableColumns.get(row.table_name).add(row.column_name);
  }

  // 3. Fetch all constraints in public schema
  const constraintsRes = await client.query(
    `SELECT table_name, constraint_name
     FROM information_schema.table_constraints
     WHERE table_schema = 'public';`
  );
  const tableConstraints = new Map();
  for (const row of constraintsRes.rows) {
    if (!tableConstraints.has(row.table_name)) {
      tableConstraints.set(row.table_name, new Set());
    }
    tableConstraints.get(row.table_name).add(row.constraint_name);
  }

  // 4. Fetch all custom indexes
  const indexesRes = await client.query(
    `SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public';`
  );
  const tableIndexes = new Map();
  for (const row of indexesRes.rows) {
    if (!tableIndexes.has(row.tablename)) {
      tableIndexes.set(row.tablename, new Set());
    }
    tableIndexes.get(row.tablename).add(row.indexname);
  }

  // Verify each table's columns, constraints, and indexes
  for (const [tableName, expectations] of Object.entries(EXPECTED_SCHEMA)) {
    const cols = tableColumns.get(tableName) || new Set();
    for (const expectedCol of expectations.columns) {
      if (!cols.has(expectedCol)) {
        throw new Error(`Schema Verification Failed: Table "${tableName}" is missing column "${expectedCol}"`);
      }
    }

    if (expectations.constraints) {
      const constrs = tableConstraints.get(tableName) || new Set();
      for (const expectedConstr of expectations.constraints) {
        if (!constrs.has(expectedConstr)) {
          throw new Error(`Schema Verification Failed: Table "${tableName}" is missing constraint "${expectedConstr}"`);
        }
      }
    }

    if (expectations.indexes) {
      const idxs = tableIndexes.get(tableName) || new Set();
      for (const expectedIdx of expectations.indexes) {
        if (!idxs.has(expectedIdx)) {
          throw new Error(`Schema Verification Failed: Table "${tableName}" is missing index "${expectedIdx}"`);
        }
      }
    }
  }

  // 5. Verify ai_requests_status_check allows APPROVAL_REQUIRED
  const statusCheckRes = await client.query(
    `SELECT pg_get_constraintdef(oid) as def
     FROM pg_constraint
     WHERE conname = 'ai_requests_status_check'
       AND conrelid = 'ai_requests'::regclass;`
  );
  if (statusCheckRes.rows.length === 0) {
    throw new Error("Schema Verification Failed: Constraint ai_requests_status_check not found on ai_requests");
  }
  const checkDef = statusCheckRes.rows[0].def;
  if (!checkDef.includes("APPROVAL_REQUIRED")) {
    throw new Error(`Schema Verification Failed: ai_requests_status_check missing APPROVAL_REQUIRED: ${checkDef}`);
  }

  console.log(`Verified ${expectedTableNames.length} tables, all columns, constraints, and indexes.`);
}

async function runMigrations() {
  console.log("=== AegisAI Database Migration Runner ===");
  const sslStatus = poolConfig.ssl
    ? typeof poolConfig.ssl === "object" && poolConfig.ssl.ca
      ? "SSL/TLS enabled (Custom CA with strict verification)"
      : "SSL/TLS enabled (rejectUnauthorized: " + poolConfig.ssl.rejectUnauthorized + ")"
    : "SSL disabled";
  console.log(`Connecting to database (${sslStatus})...`);

  let client;
  let lockAcquired = false;

  try {
    client = await pool.connect();
  } catch (connErr) {
    console.error("FATAL: Could not establish connection to PostgreSQL:", connErr.message);
    if (connErr.code) console.error("PostgreSQL Error Code:", connErr.code);
    await pool.end();
    process.exit(1);
  }

  try {
    console.log(`Acquiring PostgreSQL advisory lock (${MIGRATION_LOCK_ID})...`);
    await client.query("SELECT pg_advisory_lock($1);", [MIGRATION_LOCK_ID]);
    lockAcquired = true;
    console.log("Advisory lock acquired. Executing service migrations in deterministic order...");

    for (const { name, schema } of schemas) {
      console.log(`Applying migrations for ${name}...`);
      await client.query(schema);
      console.log(`  -> ${name} migrations applied successfully.`);
    }

    await verifySchema(client);

    console.log("\n=== All migrations & schema verifications completed successfully ===");
  } catch (err) {
    console.error("\nFATAL: Migration runner failed:", err.message);
    if (err.code) console.error("PostgreSQL Error Code:", err.code);
    if (err.detail) console.error("Detail:", err.detail);
    process.exitCode = 1;
  } finally {
    if (lockAcquired) {
      try {
        console.log("Releasing PostgreSQL advisory lock...");
        await client.query("SELECT pg_advisory_unlock($1);", [MIGRATION_LOCK_ID]);
        console.log("Advisory lock released successfully.");
      } catch (unlockErr) {
        console.error("Warning: Failed to release advisory lock:", unlockErr.message);
      }
    }
    client.release();
    await pool.end();
  }

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

runMigrations();
