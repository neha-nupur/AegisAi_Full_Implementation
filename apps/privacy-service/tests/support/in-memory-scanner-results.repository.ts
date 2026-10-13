import { randomUUID } from "node:crypto";
import type {
  RecordScanInput,
  ScannerResultDocument,
  ScannerResultsRepository,
} from "../../src/repositories/scanner-results.repository";

/** In-memory stand-in for `MongoScannerResultsRepository`. Test-only — never imported by production code. */
export class InMemoryScannerResultsRepository implements ScannerResultsRepository {
  readonly records: ScannerResultDocument[] = [];

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
    this.records.push(doc);
    return doc;
  }

  async findByAiRequestId(aiRequestId: string): Promise<ScannerResultDocument | null> {
    return this.records.find((r) => r.aiRequestId === aiRequestId) ?? null;
  }
}
