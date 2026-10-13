import * as crypto from "crypto";
import type { 
  CreateAuditEventInput, 
  CreateSecurityEventInput, 
  TraceUpsertInput,
  AuditEvent,
  SecurityEvent,
  RequestTrace 
} from "../types";
import { TraceRepository, MongoTraceRepository } from "../repositories/traces.repository";
import { AuditEventsRepository, MongoAuditEventsRepository } from "../repositories/audit-events.repository";
import { SecurityEventsRepository, MongoSecurityEventsRepository } from "../repositories/security-events.repository";

export class AuditService {
  constructor(
    private readonly tracesRepo: TraceRepository = new MongoTraceRepository(),
    private readonly auditEventsRepo: AuditEventsRepository = new MongoAuditEventsRepository(),
    private readonly securityEventsRepo: SecurityEventsRepository = new MongoSecurityEventsRepository()
  ) {}

  async recordEvent(input: CreateAuditEventInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      traceId: input.traceId,
      aiRequestId: input.aiRequestId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      metadata: input.metadata ?? {},
      timestamp: new Date().toISOString(),
    };

    await this.auditEventsRepo.create(event);
    return event;
  }

  async recordSecurityEvent(input: CreateSecurityEventInput): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      traceId: input.traceId,
      aiRequestId: input.aiRequestId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      severity: input.severity,
      metadata: input.metadata ?? {},
      timestamp: new Date().toISOString(),
    };

    await this.securityEventsRepo.create(event);
    return event;
  }

  async upsertTrace(input: TraceUpsertInput): Promise<RequestTrace> {
    let trace = await this.tracesRepo.findByTraceId(input.traceId);
    
    if (!trace) {
      trace = {
        id: input.traceId,
        aiRequestId: input.aiRequestId,
        organizationId: input.organizationId,
        requesterId: input.requesterId,
        events: [],
        startedAt: input.startedAt ?? new Date().toISOString(),
        completedAt: input.completedAt ?? null,
      };
    } else {
      if (input.completedAt) {
        trace.completedAt = input.completedAt;
      }
    }

    await this.tracesRepo.upsert(trace);
    return trace;
  }
}
