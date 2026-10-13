import { MongoClient, type Collection, type Db } from "mongodb";
import { loadConfig } from "@aegisai/config";
import type { RequestTrace, AuditEvent, SecurityEvent } from "../types";

let client: MongoClient | undefined;
let db: Db | undefined;

export async function getDb(): Promise<Db> {
  if (!db) {
    const config = loadConfig();
    client = new MongoClient(config.mongodbUrl);
    await client.connect();
    db = client.db();
  }
  return db;
}

export async function getTracesCollection(): Promise<Collection<RequestTrace & { _id: string }>> {
  const database = await getDb();
  return database.collection("request_traces");
}

export async function getAuditEventsCollection(): Promise<Collection<AuditEvent & { _id: string }>> {
  const database = await getDb();
  return database.collection("audit_events");
}

export async function getSecurityEventsCollection(): Promise<Collection<SecurityEvent & { _id: string }>> {
  const database = await getDb();
  return database.collection("security_events");
}

export async function closeMongoConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
