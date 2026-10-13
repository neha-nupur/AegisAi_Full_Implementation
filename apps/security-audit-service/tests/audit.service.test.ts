import { AuditService } from "../src/services/audit.service";
import { InMemoryTraceRepository } from "./support/in-memory-traces.repository";
import { InMemoryAuditEventsRepository } from "./support/in-memory-audit-events.repository";
import { InMemorySecurityEventsRepository } from "./support/in-memory-security-events.repository";

describe("AuditService", () => {
  let tracesRepo: InMemoryTraceRepository;
  let auditEventsRepo: InMemoryAuditEventsRepository;
  let securityEventsRepo: InMemorySecurityEventsRepository;
  let service: AuditService;

  beforeEach(() => {
    tracesRepo = new InMemoryTraceRepository();
    auditEventsRepo = new InMemoryAuditEventsRepository();
    securityEventsRepo = new InMemorySecurityEventsRepository();
    service = new AuditService(tracesRepo, auditEventsRepo, securityEventsRepo);
  });

  it("should record an audit event", async () => {
    const event = await service.recordEvent({
      traceId: "trace-1",
      aiRequestId: "req-1",
      organizationId: "org-1",
      eventType: "REQUEST_RECEIVED",
    });

    expect(event.id).toBeDefined();
    expect(event.traceId).toBe("trace-1");
    expect(auditEventsRepo.events.length).toBe(1);
    expect(auditEventsRepo.events[0]).toEqual(event);
  });

  it("should record a security event", async () => {
    const event = await service.recordSecurityEvent({
      traceId: "trace-1",
      aiRequestId: "req-1",
      organizationId: "org-1",
      eventType: "POLICY_BLOCK",
      severity: "HIGH",
    });

    expect(event.id).toBeDefined();
    expect(event.severity).toBe("HIGH");
    expect(securityEventsRepo.events.length).toBe(1);
    expect(securityEventsRepo.events[0]).toEqual(event);
  });

  it("should upsert a trace", async () => {
    await service.upsertTrace({
      traceId: "trace-1",
      aiRequestId: "req-1",
      organizationId: "org-1",
      requesterId: "user-1",
    });

    let trace = await tracesRepo.findByTraceId("trace-1");
    expect(trace).toBeDefined();
    expect(trace?.completedAt).toBeNull();

    await service.upsertTrace({
      traceId: "trace-1",
      aiRequestId: "req-1",
      organizationId: "org-1",
      requesterId: "user-1",
      completedAt: new Date().toISOString(),
    });

    trace = await tracesRepo.findByTraceId("trace-1");
    expect(trace?.completedAt).not.toBeNull();
  });
});
