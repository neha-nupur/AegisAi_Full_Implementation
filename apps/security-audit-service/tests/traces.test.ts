import request from "supertest";
import express from "express";
import { InMemoryTraceRepository } from "./support/in-memory-traces.repository";
import { InMemoryAuditEventsRepository } from "./support/in-memory-audit-events.repository";
import { TracesController } from "../src/controllers/traces.controller";

describe("Traces API", () => {
  let app: express.Express;
  let tracesRepo: InMemoryTraceRepository;
  let auditEventsRepo: InMemoryAuditEventsRepository;

  beforeEach(async () => {
    tracesRepo = new InMemoryTraceRepository();
    auditEventsRepo = new InMemoryAuditEventsRepository();

    await tracesRepo.upsert({
      id: "trace-1",
      aiRequestId: "req-1",
      organizationId: "org-1",
      requesterId: "user-1",
      events: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    await auditEventsRepo.create({
      id: "event-1",
      traceId: "trace-1",
      aiRequestId: "req-1",
      organizationId: "org-1",
      eventType: "REQUEST_RECEIVED",
      metadata: {},
      timestamp: new Date().toISOString(),
    });

    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.principal = { organizationId: "org-1", userId: "user-1", role: "SECURITY_AUDITOR", permissions: ["audit:read"] };
      next();
    });

    const tracesController = new TracesController(tracesRepo, auditEventsRepo);
    app.get("/v1/security-audit/traces", tracesController.list.bind(tracesController));
    app.get("/v1/security-audit/traces/:traceId", tracesController.get.bind(tracesController));
    // Without this, a thrown HttpError (e.g. 404 TRACE_NOT_FOUND) has
    // nowhere to go — Express never sends a response and the test
    // just hangs until Jest's timeout, which is confusing to debug.
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.status ?? 500).json({ error: { code: err.code ?? "INTERNAL_ERROR", message: err.message } });
    });
  });

  it("should list traces", async () => {
    const res = await request(app).get("/v1/security-audit/traces");
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.items.length).toBe(1);
    expect(body.items[0].id).toBe("trace-1");
  });

  it("should get a trace with events", async () => {
    const res = await request(app).get("/v1/security-audit/traces/trace-1");
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.id).toBe("trace-1");
    expect(body.events.length).toBe(1);
    expect(body.events[0].id).toBe("event-1");
  });
});
