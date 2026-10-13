import type { AuditEvent } from "../types";
import { getAuditEventsCollection } from "../db/mongo";

export interface AuditEventsRepository {
  create(event: AuditEvent): Promise<void>;
  findByTraceId(traceId: string): Promise<AuditEvent[]>;
  listByOrganization(organizationId: string, limit?: number, cursor?: string): Promise<{ items: AuditEvent[]; nextCursor: string | null }>;
}

export class MongoAuditEventsRepository implements AuditEventsRepository {
  async create(event: AuditEvent): Promise<void> {
    const collection = await getAuditEventsCollection();
    await collection.insertOne({ ...event, _id: event.id });
  }

  async findByTraceId(traceId: string): Promise<AuditEvent[]> {
    const collection = await getAuditEventsCollection();
    const docs = await collection.find({ traceId }).sort({ timestamp: 1 }).toArray();
    return docs.map(doc => {
      const { _id, id, ...rest } = doc;
      return { id: _id, ...rest } as AuditEvent;
    });
  }

  async listByOrganization(organizationId: string, limit = 50, _cursor?: string): Promise<{ items: AuditEvent[]; nextCursor: string | null }> {
    const collection = await getAuditEventsCollection();
    
    const query: any = { organizationId };
    
    const docs = await collection.find(query).sort({ timestamp: -1 }).limit(limit).toArray();
    
    const items = docs.map(doc => {
      const { _id, id, ...rest } = doc;
      return { id: _id, ...rest } as AuditEvent;
    });

    return {
      items,
      nextCursor: items.length === limit ? items[items.length - 1].id : null,
    };
  }
}
