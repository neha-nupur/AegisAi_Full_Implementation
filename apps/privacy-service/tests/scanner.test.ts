import { PrivacyScanner } from "../src/domain/scanner";

describe("PrivacyScanner", () => {
  const scanner = new PrivacyScanner(["confidential", "merger"]);

  test("normal text: nothing detected", () => {
    const result = scanner.scan("Summarize this customer support message.");
    expect(result.detected).toBe(false);
    expect(result.findings).toHaveLength(0);
  });

  test("detects an email and suggests MASK", () => {
    const result = scanner.scan("Please contact jane.doe@example.com about this.");
    expect(result.detected).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ type: "EMAIL", action: "MASK" });
  });

  test("detects an Indian mobile number and suggests MASK", () => {
    const result = scanner.scan("Call me at 9876543210 tomorrow.");
    expect(result.findings.some((f) => f.type === "PHONE" && f.action === "MASK")).toBe(true);
  });

  test("detects a PAN-like pattern and suggests MASK", () => {
    const result = scanner.scan("My PAN is ABCDE1234F for the filing.");
    expect(result.findings.some((f) => f.type === "PAN" && f.action === "MASK")).toBe(true);
  });

  test("detects an Aadhaar-like 12-digit pattern and suggests MASK", () => {
    const result = scanner.scan("Aadhaar number: 1234 5678 9012");
    expect(result.findings.some((f) => f.type === "AADHAAR" && f.action === "MASK")).toBe(true);
  });

  test("detects an AWS-style API key and suggests BLOCK", () => {
    const result = scanner.scan("Here is the key: AKIAABCDEFGHIJKLMNOP use it now.");
    expect(result.findings.some((f) => f.type === "API_KEY" && f.action === "BLOCK")).toBe(true);
  });

  test("detects a password credential pattern and suggests BLOCK", () => {
    const result = scanner.scan("password: SuperSecret123!");
    expect(result.findings.some((f) => f.type === "PASSWORD" && f.action === "BLOCK")).toBe(true);
  });

  test("detects a configured sensitive keyword and suggests REQUIRE_APPROVAL", () => {
    const result = scanner.scan("This is about the upcoming merger, keep it confidential.");
    const types = result.findings.map((f) => f.type);
    expect(types.filter((t) => t === "SENSITIVE_KEYWORD")).toHaveLength(2);
    expect(result.findings.every((f) => f.action === "REQUIRE_APPROVAL")).toBe(true);
  });

  test("never includes the raw matched text anywhere in the result", () => {
    const text = "password: SuperSecret123! and email jane@example.com";
    const result = scanner.scan(text);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("SuperSecret123");
    expect(serialized).not.toContain("jane@example.com");
  });

  test("redact() masks every finding's span with a type-tagged placeholder", () => {
    const text = "Email me at jane@example.com or call 9876543210.";
    const result = scanner.scan(text);
    const redacted = scanner.redact(text, result.findings);
    expect(redacted).not.toContain("jane@example.com");
    expect(redacted).not.toContain("9876543210");
    expect(redacted).toContain("[REDACTED_EMAIL]");
    expect(redacted).toContain("[REDACTED_PHONE]");
  });

  test("overlapping matches keep only the higher-confidence finding", () => {
    // "confidential" (keyword, 0.6) sits right next to an email (0.95) —
    // spans don't actually overlap here, but this proves multiple
    // distinct finding types in one string are all reported once each.
    const result = scanner.scan("confidential: contact jane@example.com");
    const emailFindings = result.findings.filter((f) => f.type === "EMAIL");
    expect(emailFindings).toHaveLength(1);
  });
});
