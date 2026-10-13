import type { SecurityEvent, SecurityEventSeverity } from "../types";
import { getSecurityEventsCollection } from "../db/mongo";

export interface SecurityEventsRepository {
  create(event: SecurityEvent): Promise<void>;
  listByOrganization(organizationId: string, severity?: SecurityEventSeverity, limit?: number, cursor?: string): Promise<{ items: SecurityEvent[]; nextCursor: string | null }>;
}

export class MongoSecurityEventsRepository implements SecurityEventsRepository {
  async create(event: SecurityEvent): Promise<void> {
    const collection = await getSecurityEventsCollection();
    await collection.insertOne({ ...event, _id: event.id });
  }

  async listByOrganization(organizationId: string, severity?: SecurityEventSeverity, limit = 50, _cursor?: string): Promise<{ items: SecurityEvent[]; nextCursor: string | null }> {
    const collection = await getSecurityEventsCollection();
    
    const query: any = { organizationId };
    if (severity) {
      query.severity = severity;
    }
    
    const docs = await collection.find(query).sort({ timestamp: -1 }).limit(limit).toArray();
    
    const items = docs.map(doc => {
      const { _id, id, ...rest } = doc;
      return { id: _id, ...rest } as SecurityEvent;
    });

    return {
      items,
      nextCursor: items.length === limit ? items[items.length - 1].id : null,
    };
  }
}
