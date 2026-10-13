import { randomUUID } from "node:crypto";
import { getScannerResultsCollection } from "../db/mongo";
import type { Finding, FindingType } from "../domain/finding-types";

/**
 * `scanner_results` document shape. Deliberately stores only
 * `type`/`location`/`confidence`/`action` per finding — never the
 * matched substring (see `scanner.ts`'s doc comment: "never store
 * raw secrets" is enforced at the source, and this repository has no
 * raw text to store even if it wanted to).
 */
export interface ScannerResultDocument {
  _id: string;
  organizationId: string;
  aiRequestId: string;
  detected: boolean;
  findingTypes: FindingType[];
  findings: Finding[];
  createdAt: string;
}

export interface RecordScanInput {
  organizationId: string;
  aiRequestId: string;
  detected: boolean;
  findings: Finding[];
}

/**
 * Repository contract for `scanner_results` — the only code allowed
 * to query this collection directly (docs/database-ownership.md).
 * `PrivacyScanService` depends on this interface (not the concrete
 * Mongo implementation) so tests can inject an in-memory fake.
 */
export interface ScannerResultsRepository {
  record(input: RecordScanInput): Promise<ScannerResultDocument>;
  findByAiRequestId(aiRequestId: string): Promise<ScannerResultDocument | null>;
}

export class MongoScannerResultsRepository implements ScannerResultsRepository {
  async record(input: RecordScanInput): Promise<ScannerResultDocument> {
    const doc: ScannerResultDocument = {
      _id: randomUUID(),
      organizationId: input.organizationId,
      aiRequestId: input.aiRequestId,
      detected: input.detected,
      findingTypes: [...new Set(input.findings.map((f) => f.type))],
      findings: input.findings,
      createdAt: new Date().toISOString(),
    };
    const collection = await getScannerResultsCollection();
    await collection.insertOne(doc);
    return doc;
  }

  async findByAiRequestId(aiRequestId: string): Promise<ScannerResultDocument | null> {
    const collection = await getScannerResultsCollection();
    return collection.findOne({ aiRequestId });
  }
}
