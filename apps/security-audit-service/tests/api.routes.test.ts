import express from "express";
import request from "supertest";
import { TokenService, permissionsForRole } from "@aegisai/identity-service";
import { createSecurityAuditApiRouter } from "../src/routes/api.routes";
import { TracesController } from "../src/controllers/traces.controller";
import { InMemoryTraceRepository } from "./support/in-memory-traces.repository";
import { InMemoryAuditEventsRepository } from "./support/in-memory-audit-events.repository";

/**
 * Phase 11: this router was previously mounted with **no
 * authentication middleware at all** (see `routes/api.routes.ts`'s
 * doc comment). This suite is the regression test proving that gap
 * is closed.
 */
describe("Security & Audit API — authentication and authorization", () => {
  function buildApp() {
    const tracesRepo = new InMemoryTraceRepository();
    const auditEventsRepo = new InMemoryAuditEventsRepository();
    const tracesController = new TracesController(tracesRepo, auditEventsRepo);

    const app = express();
    app.use(express.json());
    app.use(createSecurityAuditApiRouter({ tracesController }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.status ?? 500).json({ error: { code: err.code ?? "INTERNAL_ERROR", message: err.message } });
    });
    return app;
  }

  function issueToken(role: "ORGANIZATION_ADMIN" | "DEVELOPER" | "SECURITY_AUDITOR"): string {
    const tokenService = new TokenService();
    return tokenService.sign({
      userId: "user-1",
      organizationId: "org-1",
      role,
      permissions: permissionsForRole(role),
    }).token;
  }

  it("rejects a request with no bearer token (401)", async () => {
    const res = await request(buildApp()).get("/traces");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_TOKEN");
  });

  it("rejects a DEVELOPER (no audit:read permission) with 403", async () => {
    const token = issueToken("DEVELOPER");
    const res = await request(buildApp()).get("/traces").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows a SECURITY_AUDITOR (has audit:read) through to a real 200", async () => {
    const token = issueToken("SECURITY_AUDITOR");
    const res = await request(buildApp()).get("/traces").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.items).toEqual([]);
  });

  it("allows an ORGANIZATION_ADMIN (has audit:read) through to a real 200", async () => {
    const token = issueToken("ORGANIZATION_ADMIN");
    const res = await request(buildApp()).get("/traces").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
