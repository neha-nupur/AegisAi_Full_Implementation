"use strict";

/**
 * AegisAI legacy SOAP mock server (Phase 10).
 *
 * A standalone, deliberately simple SOAP 1.1 service implementing the
 * single `CheckLegacyEmployee` operation defined in `../service.wsdl`.
 * Simulates the kind of legacy on-prem HR/directory system a real
 * AegisAI deployment might integrate with. Plain CommonJS (no
 * TypeScript build step) since this represents a legacy system
 * *outside* AegisAI's own codebase, not a service we're building out
 * with the same conventions as the six logical services.
 *
 * Special employeeId values (documented, deterministic, for testing
 * the SOAP connector's resilience behavior — see
 * apps/identity-service/src/integrations/soap/legacy-employee.client.ts):
 *   - "FAIL_ONCE"   -> throws a SOAP fault on the first call after
 *                      server start, then succeeds on every call after
 *                      (simulates a transient failure, for retry tests).
 *   - "FAIL_ALWAYS" -> always throws a SOAP fault (for circuit-breaker tests).
 *   - "TIMEOUT"     -> delays the response by 10s (for timeout tests).
 *   - anything else -> looked up in the fixture directory below.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const express = require("express");
const soap = require("soap");

const PORT = process.env.SOAP_MOCK_PORT ? Number(process.env.SOAP_MOCK_PORT) : 5005;

const EMPLOYEE_DIRECTORY = {
  E1001: { fullName: "Priya Sharma", department: "Finance", status: "ACTIVE" },
  E1002: { fullName: "Rahul Verma", department: "Engineering", status: "ACTIVE" },
  E1003: { fullName: "Anjali Mehta", department: "Sales", status: "INACTIVE" },
};

let failOnceUsed = false;

function lookupEmployee(employeeId) {
  const record = EMPLOYEE_DIRECTORY[employeeId];
  if (!record) {
    return { employeeId, exists: false, status: "NOT_FOUND" };
  }
  return { employeeId, exists: true, fullName: record.fullName, department: record.department, status: record.status };
}

const service = {
  LegacyEmployeeService: {
    LegacyEmployeePort: {
      CheckLegacyEmployee: function (args, callback) {
        const employeeId = args && args.employeeId;

        if (employeeId === "TIMEOUT") {
          setTimeout(() => callback(lookupEmployee(employeeId)), 10_000);
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
          // Subsequent calls succeed, as if the transient issue resolved.
          callback(lookupEmployee(employeeId));
          return;
        }

        callback(lookupEmployee(employeeId));
      },
    },
  },
};

const wsdlPath = path.join(__dirname, "..", "service.wsdl");
const wsdlXml = fs.readFileSync(wsdlPath, "utf8");

const app = express();
app.get("/", (_req, res) => res.status(200).json({ status: "ok", service: "aegisai-soap-mock" }));

const server = http.createServer(app);
server.listen(PORT, () => {
  soap.listen(server, "/legacy-employee", service, wsdlXml);
  console.log(`aegisai-soap-mock listening on :${PORT}`);
  console.log(`WSDL:  http://localhost:${PORT}/legacy-employee?wsdl`);
  console.log(`SOAP:  http://localhost:${PORT}/legacy-employee`);
});
