import type { RequestTrace } from "../../src/types";
import type { TraceRepository } from "../../src/repositories/traces.repository";

export class InMemoryTraceRepository implements TraceRepository {
  private traces: Map<string, RequestTrace> = new Map();

  async upsert(trace: RequestTrace): Promise<void> {
    this.traces.set(trace.id, trace);
  }

  async findByTraceId(traceId: string): Promise<RequestTrace | null> {
    return this.traces.get(traceId) || null;
  }

  async listByOrganization(organizationId: string, limit = 50, _cursor?: string): Promise<{ items: RequestTrace[]; nextCursor: string | null }> {
    const items = Array.from(this.traces.values()).filter(t => t.organizationId === organizationId);
    return {
      items: items.slice(0, limit),
      nextCursor: null,
    };
  }
}
