import request from "supertest";
import express from "express";
import { InMemorySecurityEventsRepository } from "./support/in-memory-security-events.repository";
import { SecurityEventsController } from "../src/controllers/security-events.controller";

describe("Security Events API", () => {
  let app: express.Express;
  let securityEventsRepo: InMemorySecurityEventsRepository;

  beforeEach(async () => {
    securityEventsRepo = new InMemorySecurityEventsRepository();

    await securityEventsRepo.create({
      id: "event-1",
      traceId: "trace-1",
      aiRequestId: "req-1",
      organizationId: "org-1",
      eventType: "POLICY_BLOCK",
      severity: "HIGH",
      metadata: {},
      timestamp: new Date().toISOString(),
    });
    
    await securityEventsRepo.create({
      id: "event-2",
      traceId: "trace-2",
      aiRequestId: "req-2",
      organizationId: "org-1",
      eventType: "PII_DETECTED",
      severity: "MEDIUM",
      metadata: {},
      timestamp: new Date().toISOString(),
    });

    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.principal = { organizationId: "org-1", userId: "user-1", role: "SECURITY_AUDITOR", permissions: ["audit:read"] };
      next();
    });

    const securityEventsController = new SecurityEventsController(securityEventsRepo);
    app.get("/v1/security-audit/security-events", securityEventsController.list.bind(securityEventsController));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.status ?? 500).json({ error: { code: err.code ?? "INTERNAL_ERROR", message: err.message } });
    });
  });

  it("should list all security events", async () => {
    const res = await request(app).get("/v1/security-audit/security-events");
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.items.length).toBe(2);
  });

  it("should filter security events by severity", async () => {
    const res = await request(app).get("/v1/security-audit/security-events?severity=HIGH");
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.items.length).toBe(1);
    expect(body.items[0].severity).toBe("HIGH");
  });
});
