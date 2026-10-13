import { MongoClient, type Collection, type Db } from "mongodb";
import { loadConfig } from "@aegisai/config";
import type { ScannerResultDocument } from "../repositories/scanner-results.repository";

/**
 * Privacy Scanner Service's MongoDB connection — the only connection
 * to `scanner_results` in the whole project (see
 * docs/database-ownership.md). Same lazy-singleton pattern as
 * `apps/gateway-service/src/db/pool.ts`'s Postgres pool, adapted for
 * the Mongo driver's own connect lifecycle.
 */
let client: MongoClient | undefined;
let db: Db | undefined;

async function getDb(): Promise<Db> {
  if (!db) {
    const config = loadConfig();
    client = new MongoClient(config.mongodbUrl);
    await client.connect();
    db = client.db();
  }
  return db;
}

export async function getScannerResultsCollection(): Promise<Collection<ScannerResultDocument>> {
  const database = await getDb();
  return database.collection<ScannerResultDocument>("scanner_results");
}

/** Test/shutdown helper: closes the connection and clears the memoized instance. */
export async function closeMongoConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
