import type { SecurityEvent, SecurityEventSeverity } from "../../src/types";
import type { SecurityEventsRepository } from "../../src/repositories/security-events.repository";

export class InMemorySecurityEventsRepository implements SecurityEventsRepository {
  public events: SecurityEvent[] = [];

  async create(event: SecurityEvent): Promise<void> {
    this.events.push(event);
  }

  async listByOrganization(organizationId: string, severity?: SecurityEventSeverity, limit = 50, _cursor?: string): Promise<{ items: SecurityEvent[]; nextCursor: string | null }> {
    let items = this.events.filter(e => e.organizationId === organizationId);
    if (severity) {
      items = items.filter(e => e.severity === severity);
    }
    return {
      items: items.slice(0, limit),
      nextCursor: null,
    };
  }
}
