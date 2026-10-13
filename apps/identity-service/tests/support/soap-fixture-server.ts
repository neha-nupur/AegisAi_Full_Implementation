import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as soap from "soap";

/**
 * A real, ephemeral, local SOAP server for `LegacyEmployeeClient`
 * tests — not a mock of the `soap` module's internals. Runs the same
 * `CheckLegacyEmployee` operation and WSDL as `soap-mock/`
 * (loaded from the same file, so the test is against the actual WSDL
 * this project ships, not a copy that could drift), so tests exercise
 * a real WSDL parse and a real SOAP request/response round trip on
 * `localhost` — deterministic and hermetic (no dependency on
 * `soap-mock/` already running as a separate process), same
 * "in-memory fake, but for a network client it's a real local server
 * instead" reasoning as `tests/support/in-memory-repositories.ts`
 * elsewhere in this project.
 *
 * Supports the same deterministic trigger values as `soap-mock/server/index.js`
 * (`FAIL_ONCE`, `FAIL_ALWAYS`, `TIMEOUT`) for resilience tests.
 */
export interface SoapFixtureServer {
  url: string;
  close(): Promise<void>;
  resetFailOnce(): void;
}

const WSDL_PATH = path.join(__dirname, "..", "..", "..", "..", "soap-mock", "service.wsdl");

const DIRECTORY: Record<string, { fullName: string; department: string; status: string }> = {
  E1001: { fullName: "Priya Sharma", department: "Finance", status: "ACTIVE" },
  E1003: { fullName: "Anjali Mehta", department: "Sales", status: "INACTIVE" },
};

export async function startSoapFixtureServer(): Promise<SoapFixtureServer> {
  const wsdlXml = fs.readFileSync(WSDL_PATH, "utf8");
  let failOnceUsed = false;

  const service = {
    LegacyEmployeeService: {
      LegacyEmployeePort: {
        CheckLegacyEmployee: (args: { employeeId: string }, callback?: (result: unknown) => void) => {
          const { employeeId } = args;

          if (employeeId === "TIMEOUT") {
            setTimeout(() => callback?.(lookup(employeeId)), 10_000);
            return;
          }
          if (employeeId === "FAIL_ALWAYS") {
            throw new Error("Legacy directory unavailable (simulated permanent failure).");
          }
          if (employeeId === "FAIL_ONCE") {
            if (!failOnceUsed) {
              failOnceUsed = true;
              throw new Error("Legacy directory timed out (simulated transient failure).");
            }
            callback?.(lookup(employeeId));
            return;
          }
          callback?.(lookup(employeeId));
        },
      },
    },
  };

  function lookup(employeeId: string) {
    const record = DIRECTORY[employeeId];
    if (!record) return { employeeId, exists: false, status: "NOT_FOUND" };
    return { employeeId, exists: true, ...record };
  }

  const httpServer = http.createServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  soap.listen(httpServer, "/legacy-employee", service, wsdlXml);

  const address = httpServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("Failed to determine SOAP fixture server port.");
  }
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    resetFailOnce: () => {
      failOnceUsed = false;
    },
    close: () => new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve()))),
  };
}
