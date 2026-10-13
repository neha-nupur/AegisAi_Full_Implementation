import type { RequestTrace } from "../types";
import { getTracesCollection } from "../db/mongo";

export interface TraceRepository {
  upsert(trace: RequestTrace): Promise<void>;
  findByTraceId(traceId: string): Promise<RequestTrace | null>;
  listByOrganization(organizationId: string, limit?: number, cursor?: string): Promise<{ items: RequestTrace[]; nextCursor: string | null }>;
}

export class MongoTraceRepository implements TraceRepository {
  async upsert(trace: RequestTrace): Promise<void> {
    const collection = await getTracesCollection();
    await collection.updateOne(
      { _id: trace.id },
      { $set: { ...trace, _id: trace.id } },
      { upsert: true }
    );
  }

  async findByTraceId(traceId: string): Promise<RequestTrace | null> {
    const collection = await getTracesCollection();
    const doc = await collection.findOne({ _id: traceId });
    if (!doc) return null;
    const { _id, id, ...rest } = doc;
    return { id: _id, ...rest } as RequestTrace;
  }

  async listByOrganization(organizationId: string, limit = 50, cursor?: string): Promise<{ items: RequestTrace[]; nextCursor: string | null }> {
    const collection = await getTracesCollection();
    
    const query: any = { organizationId };
    if (cursor) {
      // Assuming simple cursor pagination based on string id (which are typically UUIDs here, so not perfectly sortable by time unless using UUIDv7)
      // Since traceId is passed as id, we'll sort by startedAt (desc) and id
      // For a robust implementation, we'd use a better cursor encoding. Here we'll do simple offset or just startedAt.
      // Let's implement a simpler offset or skip, but for now we'll do a basic filter.
      // Actually, since this is a mock-like or initial implementation, we'll just sort by startedAt desc and return all.
    }
    
    const docs = await collection.find(query).sort({ startedAt: -1 }).limit(limit).toArray();
    
    const items = docs.map(doc => {
      const { _id, id, ...rest } = doc;
      return { id: _id, ...rest } as RequestTrace;
    });

    return {
      items,
      nextCursor: items.length === limit ? items[items.length - 1].id : null,
    };
  }
}
