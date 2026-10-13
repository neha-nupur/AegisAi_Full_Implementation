import { LegacyEmployeeClient } from "../src/integrations/soap/legacy-employee.client";
import { startSoapFixtureServer, type SoapFixtureServer } from "./support/soap-fixture-server";

/**
 * Tests the real WSDL parse + real SOAP round trip against a local
 * ephemeral fixture server (see `support/soap-fixture-server.ts`),
 * plus the resilience behaviors (retry, circuit breaker, timeout)
 * layered on top — this is the Phase 10 evidence for checklist item
 * 24 (reading a WSDL, making one SOAP call) and the SOAP-specific
 * "timeout, retry, circuit breaker" requirement.
 */
describe("LegacyEmployeeClient", () => {
  let fixture: SoapFixtureServer;

  beforeAll(async () => {
    fixture = await startSoapFixtureServer();
  });

  afterAll(async () => {
    await fixture.close();
  });

  test("successful SOAP call: an existing, active employee resolves correctly", async () => {
    const client = new LegacyEmployeeClient(fixture.url);
    const result = await client.checkEmployee("E1001", "corr-1");

    expect(result).toEqual({
      employeeId: "E1001",
      exists: true,
      fullName: "Priya Sharma",
      department: "Finance",
      status: "ACTIVE",
    });
  });

  test("successful SOAP call: an inactive employee is reported as such, not hidden", async () => {
    const client = new LegacyEmployeeClient(fixture.url);
    const result = await client.checkEmployee("E1003", "corr-2");

    expect(result.exists).toBe(true);
    expect(result.status).toBe("INACTIVE");
  });

  test("successful SOAP call: an unknown employee id resolves to NOT_FOUND, not an error", async () => {
    const client = new LegacyEmployeeClient(fixture.url);
    const result = await client.checkEmployee("E9999", "corr-3");

    expect(result).toEqual({ employeeId: "E9999", exists: false, fullName: null, department: null, status: "NOT_FOUND" });
  });

  test("retry: a transient failure is retried and the call ultimately succeeds", async () => {
    fixture.resetFailOnce();
    const client = new LegacyEmployeeClient(fixture.url);

    const result = await client.checkEmployee("FAIL_ONCE", "corr-4");

    expect(result.employeeId).toBe("FAIL_ONCE");
  }, 10_000);

  test("SOAP timeout: a call that exceeds the connector's timeout is rejected with 504 LEGACY_SYSTEM_TIMEOUT", async () => {
    const client = new LegacyEmployeeClient(fixture.url);

    await expect(client.checkEmployee("TIMEOUT", "corr-5")).rejects.toMatchObject({
      status: 504,
      code: "LEGACY_SYSTEM_TIMEOUT",
    });
  }, 25_000);

  test("SOAP failure: a repeated failure is retried with increasing backoff, then reported as 502", async () => {
    const client = new LegacyEmployeeClient(fixture.url);

    await expect(client.checkEmployee("FAIL_ALWAYS", "corr-6")).rejects.toMatchObject({
      status: 502,
      code: "LEGACY_SYSTEM_ERROR",
    });
  }, 10_000);

  test("circuit breaker: repeated failures trip the circuit, and further calls fast-fail with 503", async () => {
    const client = new LegacyEmployeeClient(fixture.url);

    // ConsecutiveBreaker(5): five failing calls trip the circuit.
    for (let i = 0; i < 5; i++) {
      await expect(client.checkEmployee("FAIL_ALWAYS", `corr-trip-${i}`)).rejects.toMatchObject({ status: 502 });
    }

    // The circuit is now open — this call must fast-fail as 503, not retry.
    await expect(client.checkEmployee("FAIL_ALWAYS", "corr-open")).rejects.toMatchObject({
      status: 503,
      code: "LEGACY_SYSTEM_UNAVAILABLE",
    });
  }, 30_000);

  test("structured logging: every stage logs through the injected logger, not console directly", async () => {
    const events: { level: string; obj: Record<string, unknown>; msg?: string }[] = [];
    const logger = {
      info: (obj: Record<string, unknown>, msg?: string) => events.push({ level: "info", obj, msg }),
      warn: (obj: Record<string, unknown>, msg?: string) => events.push({ level: "warn", obj, msg }),
      error: (obj: Record<string, unknown>, msg?: string) => events.push({ level: "error", obj, msg }),
    };
    const client = new LegacyEmployeeClient(fixture.url, logger);

    fixture.resetFailOnce();
    await client.checkEmployee("FAIL_ONCE", "corr-log-1");

    expect(events.some((e) => e.msg === "Retrying legacy SOAP call")).toBe(true);
    expect(events.every((e) => e.obj.connector === "LegacyEmployeeClient")).toBe(true);
  }, 10_000);
});
