import { PrivacyScanner } from "../domain/scanner";
import type { Finding, ScanResult } from "../domain/finding-types";
import { MongoScannerResultsRepository, type ScannerResultsRepository } from "../repositories/scanner-results.repository";

export interface ScanAndRecordInput {
  organizationId: string;
  aiRequestId: string;
  text: string;
}

/**
 * Privacy Scanner Service's contract, called in-process by
 * `AiRequestsService` (`apps/gateway-service`) — same "contracts are
 * called in-process today, would become the HTTP/RPC adapter shape
 * later" convention as `@aegisai/shared-types`' service contracts.
 * gateway-service imports this class directly, the same way it
 * already imports Identity's `authenticateJWT`.
 */
export class PrivacyScanService {
  constructor(
    private readonly scanner: PrivacyScanner = new PrivacyScanner(),
    private readonly repository: ScannerResultsRepository = new MongoScannerResultsRepository()
  ) {}

  /** Scans `text`, persists the (raw-value-free) result to `scanner_results`, and returns it to the caller for policy evaluation. */
  async scanAndRecord(input: ScanAndRecordInput): Promise<ScanResult> {
    const result = this.scanner.scan(input.text);
    await this.repository.record({
      organizationId: input.organizationId,
      aiRequestId: input.aiRequestId,
      detected: result.detected,
      findings: result.findings,
    });
    return result;
  }

  /** Masks every detected span in `text` with a type-tagged placeholder. Used by the Gateway when Policy's decision is MASK. */
  redact(text: string, findings: Finding[]): string {
    return this.scanner.redact(text, findings);
  }
}
