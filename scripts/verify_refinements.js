const path = require("path");
const fs = require("fs");
const assert = require("assert");
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {}

const { Pool } = require("pg");
const { resolvePgPoolConfig, __resetConfigCacheForTests } = require("@aegisai/config");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("FATAL: DATABASE_URL not set.");
  process.exit(1);
}

const pool = new Pool(resolvePgPoolConfig(databaseUrl, process.env.NODE_ENV));

async function runVerification() {
  console.log("==========================================================");
  console.log("AegisAI Refinements Local Verification Suite");
  console.log("==========================================================\n");

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------
    // TEST 1: Legacy Email Verification Regression Test
    // -------------------------------------------------------------------
    console.log("TEST 1: Verifying legacy email verification fix...");
    const testEmail = `unverified_test_${Date.now()}@example.com`;

    // Ensure test organization exists
    let orgRes = await client.query("SELECT id FROM organizations LIMIT 1");
    let orgId;
    if (orgRes.rows.length === 0) {
      const insOrg = await client.query(
        "INSERT INTO organizations (name, slug) VALUES ('Test Org', 'test-org') RETURNING id"
      );
      orgId = insOrg.rows[0].id;
    } else {
      orgId = orgRes.rows[0].id;
    }

    // Insert user with email_verified = false and verification_token_hash = NULL
    const insUser = await client.query(
      `INSERT INTO users (organization_id, email, password_hash, role, status, email_verified, verification_token_hash)
       VALUES ($1, $2, 'dummyhash', 'DEVELOPER', 'active', false, NULL)
       RETURNING id, email_verified`,
      [orgId, testEmail]
    );
    const userId = insUser.rows[0].id;
    assert.strictEqual(insUser.rows[0].email_verified, false, "Initial user should be unverified");

    // Run identity service schema (simulating migration run)
    const identitySchema = require("../apps/identity-service/dist/db/schema").SCHEMA_SQL;
    await client.query(identitySchema);

    // Verify user is STILL unverified (the unconditional UPDATE was removed)
    const checkUser = await client.query(
      "SELECT email_verified FROM users WHERE id = $1",
      [userId]
    );
    assert.strictEqual(
      checkUser.rows[0].email_verified,
      false,
      "Regression check passed: User MUST remain email_verified = false after migration!"
    );
    console.log("  [PASS] Unverified user remained unverified after running schema migration.\n");

    // Clean up test user
    await client.query("DELETE FROM users WHERE id = $1", [userId]);

    // -------------------------------------------------------------------
    // TEST 2: Advisory Lock Concurrency & Serialization Test
    // -------------------------------------------------------------------
    console.log("TEST 2: Verifying PostgreSQL advisory locking...");
    const MIGRATION_LOCK_ID = 1793738503;

    // Acquire lock on client 1
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);

    // Client 2 attempts non-blocking try_lock on the same key
    const client2 = await pool.connect();
    try {
      const tryLock1 = await client2.query("SELECT pg_try_advisory_lock($1) as acquired", [MIGRATION_LOCK_ID]);
      assert.strictEqual(
        tryLock1.rows[0].acquired,
        false,
        "Concurrent lock attempt must return false while client 1 holds the lock"
      );
      console.log("  [PASS] Concurrent migration runner successfully blocked by advisory lock.");

      // Release lock on client 1
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);

      // Client 2 can now acquire the lock
      const tryLock2 = await client2.query("SELECT pg_try_advisory_lock($1) as acquired", [MIGRATION_LOCK_ID]);
      assert.strictEqual(
        tryLock2.rows[0].acquired,
        true,
        "Lock must be obtainable once client 1 releases it"
      );
      // Release lock on client 2
      await client2.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
      console.log("  [PASS] Advisory lock release and subsequent acquisition verified.\n");
    } finally {
      client2.release();
    }

    // -------------------------------------------------------------------
    // TEST 3: Gateway ai_requests_status_check Constraint Scoping & NOT VALID
    // -------------------------------------------------------------------
    console.log("TEST 3: Verifying ai_requests_status_check constraint & status support...");
    const constrRes = await client.query(
      `SELECT pg_get_constraintdef(oid) as def
       FROM pg_constraint
       WHERE conname = 'ai_requests_status_check'
         AND conrelid = 'ai_requests'::regclass;`
    );
    assert.strictEqual(constrRes.rows.length, 1, "Constraint must be scoped to ai_requests");
    assert.ok(
      constrRes.rows[0].def.includes("APPROVAL_REQUIRED"),
      "Constraint must permit APPROVAL_REQUIRED"
    );

    // Test valid status insertion
    const testReqId = `00000000-0000-0000-0000-${Date.now().toString().slice(-12)}`;
    await client.query(
      `INSERT INTO ai_requests (id, organization_id, requester_id, input, status, trace_id)
       VALUES ($1, $2, $2, 'test input', 'APPROVAL_REQUIRED', 'trace-123')`,
      [testReqId, orgId]
    );
    console.log("  [PASS] Inserted ai_request with status 'APPROVAL_REQUIRED'.");

    // Test invalid status insertion (should fail with check constraint violation)
    let checkViolationCaught = false;
    try {
      await client.query(
        `INSERT INTO ai_requests (organization_id, requester_id, input, status, trace_id)
         VALUES ($1, $1, 'test input', 'INVALID_STATUS', 'trace-456')`,
        [orgId]
      );
    } catch (e) {
      if (e.code === "23514") { // check_violation
        checkViolationCaught = true;
      } else {
        throw e;
      }
    }
    assert.ok(checkViolationCaught, "Invalid status must trigger check constraint violation (23514)");
    console.log("  [PASS] Check constraint correctly rejected invalid status value.");

    // Clean up test request
    await client.query("DELETE FROM ai_requests WHERE id = $1", [testReqId]);
    console.log("");

    // -------------------------------------------------------------------
    // TEST 4: PostgreSQL TLS Configuration Logic & CA Support
    // -------------------------------------------------------------------
    console.log("TEST 4: Verifying resolvePgPoolConfig TLS & CA certificate resolution...");

    // Subtest 4a: Localhost URL defaults to ssl: false
    const localCfg = resolvePgPoolConfig("postgresql://user:pass@localhost:5432/db");
    assert.strictEqual(localCfg.ssl, false, "Localhost must default to ssl: false");
    console.log("  [PASS] Localhost correctly defaults to ssl: false.");

    // Subtest 4b: Remote hosted URL without CA defaults to rejectUnauthorized: false
    const remoteCfg = resolvePgPoolConfig("postgresql://user:pass@dpg-abc-a.oregon-postgres.render.com/aegisai");
    assert.deepStrictEqual(remoteCfg.ssl, { rejectUnauthorized: false }, "Remote must default to rejectUnauthorized: false");
    console.log("  [PASS] Remote cloud PostgreSQL defaults to TLS with rejectUnauthorized: false.");

    // Subtest 4c: DATABASE_CA_CERT sets ca and rejectUnauthorized: true
    const savedCaCert = process.env.DATABASE_CA_CERT;
    const savedCaPath = process.env.DATABASE_CA_PATH;
    const savedReject = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;

    try {
      delete process.env.DATABASE_CA_PATH;
      delete process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
      process.env.DATABASE_CA_CERT = "-----BEGIN CERTIFICATE-----\\nMIIB...\\n-----END CERTIFICATE-----";
      const caCertCfg = resolvePgPoolConfig("postgresql://user:pass@dpg-abc-a.oregon-postgres.render.com/aegisai");
      assert.strictEqual(typeof caCertCfg.ssl, "object");
      assert.strictEqual(caCertCfg.ssl.rejectUnauthorized, true);
      assert.strictEqual(caCertCfg.ssl.ca, "-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----");
      console.log("  [PASS] DATABASE_CA_CERT successfully enables strict TLS (rejectUnauthorized: true).");

      // Subtest 4d: DATABASE_CA_PATH loads CA file
      delete process.env.DATABASE_CA_CERT;
      const tmpCaFile = path.join(__dirname, "..", "tmp_ca_test.pem");
      fs.writeFileSync(tmpCaFile, "-----BEGIN CERTIFICATE-----\nTEST_CA_FROM_FILE\n-----END CERTIFICATE-----");
      process.env.DATABASE_CA_PATH = tmpCaFile;
      const caPathCfg = resolvePgPoolConfig("postgresql://user:pass@dpg-abc-a.oregon-postgres.render.com/aegisai");
      assert.strictEqual(typeof caPathCfg.ssl, "object");
      assert.strictEqual(caPathCfg.ssl.rejectUnauthorized, true);
      assert.strictEqual(caPathCfg.ssl.ca, "-----BEGIN CERTIFICATE-----\nTEST_CA_FROM_FILE\n-----END CERTIFICATE-----");
      fs.unlinkSync(tmpCaFile);
      console.log("  [PASS] DATABASE_CA_PATH successfully loads CA file and enables strict TLS.");

      // Subtest 4e: sslmode=disable on local vs remote
      delete process.env.DATABASE_CA_PATH;
      const localDisableCfg = resolvePgPoolConfig("postgresql://user:pass@localhost:5432/db?sslmode=disable");
      assert.strictEqual(localDisableCfg.ssl, false, "Localhost accepts sslmode=disable");
      console.log("  [PASS] sslmode=disable accepted for local connections.");

      let remoteDisableBlocked = false;
      try {
        resolvePgPoolConfig("postgresql://user:pass@dpg-abc-a.oregon-postgres.render.com/aegisai?sslmode=disable");
      } catch (err) {
        if (err.message && err.message.includes("sslmode=disable is not permitted for remote")) {
          remoteDisableBlocked = true;
        }
      }
      assert.ok(remoteDisableBlocked, "Remote connection must reject sslmode=disable");
      console.log("  [PASS] sslmode=disable strictly rejected for remote connections.");
    } finally {
      if (savedCaCert) process.env.DATABASE_CA_CERT = savedCaCert; else delete process.env.DATABASE_CA_CERT;
      if (savedCaPath) process.env.DATABASE_CA_PATH = savedCaPath; else delete process.env.DATABASE_CA_PATH;
      if (savedReject) process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = savedReject; else delete process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
    }

    console.log("\n==========================================================");
    console.log("ALL 4 REFINEMENT VERIFICATIONS PASSED SUCCESSFULLY!");
    console.log("==========================================================");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runVerification();
