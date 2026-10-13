import { PrivacyScanner } from "../src/domain/scanner";
import { PrivacyScanService } from "../src/services/privacy-scan.service";
import { InMemoryScannerResultsRepository } from "./support/in-memory-scanner-results.repository";

describe("PrivacyScanService", () => {
  test("scanAndRecord persists a raw-value-free record and returns the scan result", async () => {
    const repository = new InMemoryScannerResultsRepository();
    const service = new PrivacyScanService(new PrivacyScanner(), repository);

    const result = await service.scanAndRecord({
      organizationId: "org-1",
      aiRequestId: "req-1",
      text: "password: TopSecret123!",
    });

    expect(result.detected).toBe(true);
    expect(repository.records).toHaveLength(1);
    const persisted = repository.records[0];
    expect(persisted.organizationId).toBe("org-1");
    expect(persisted.aiRequestId).toBe("req-1");
    expect(persisted.findingTypes).toContain("PASSWORD");
    expect(JSON.stringify(persisted)).not.toContain("TopSecret123");
  });

  test("redact() delegates to the scanner", async () => {
    const repository = new InMemoryScannerResultsRepository();
    const service = new PrivacyScanService(new PrivacyScanner(), repository);
    const text = "contact jane@example.com";
    const scan = await service.scanAndRecord({ organizationId: "org-1", aiRequestId: "req-2", text });

    const redacted = service.redact(text, scan.findings);
    expect(redacted).toBe("contact [REDACTED_EMAIL]");
  });
});
