import type { AuditEvent } from "../../src/types";
import type { AuditEventsRepository } from "../../src/repositories/audit-events.repository";

export class InMemoryAuditEventsRepository implements AuditEventsRepository {
  public events: AuditEvent[] = [];

  async create(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async findByTraceId(traceId: string): Promise<AuditEvent[]> {
    return this.events.filter(e => e.traceId === traceId);
  }

  async listByOrganization(organizationId: string, limit = 50, _cursor?: string): Promise<{ items: AuditEvent[]; nextCursor: string | null }> {
    const items = this.events.filter(e => e.organizationId === organizationId);
    return {
      items: items.slice(0, limit),
      nextCursor: null,
    };
  }
}
