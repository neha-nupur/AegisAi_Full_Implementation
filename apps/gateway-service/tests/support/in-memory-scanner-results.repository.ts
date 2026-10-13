import type { Finding, ScannerResultsRepository } from "@aegisai/privacy-service";

/**
 * In-memory stand-in for privacy-service's `MongoScannerResultsRepository`,
 * used only to keep this service's own tests from requiring a real
 * MongoDB connection. Test-only — never imported by production code.
 */
export class InMemoryScannerResultsRepository implements ScannerResultsRepository {
  readonly records: { organizationId: string; aiRequestId: string; detected: boolean; findings: Finding[] }[] = [];

  async record(input: { organizationId: string; aiRequestId: string; detected: boolean; findings: Finding[] }) {
    this.records.push(input);
    return { _id: `${this.records.length}`, ...input, findingTypes: [...new Set(input.findings.map((f) => f.type))], createdAt: new Date().toISOString() };
  }

  async findByAiRequestId(aiRequestId: string) {
    const found = this.records.find((r) => r.aiRequestId === aiRequestId);
    if (!found) return null;
    return { _id: "1", ...found, findingTypes: [...new Set(found.findings.map((f) => f.type))], createdAt: new Date().toISOString() };
  }
}
