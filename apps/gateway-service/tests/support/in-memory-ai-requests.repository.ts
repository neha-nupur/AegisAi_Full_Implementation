import { randomUUID } from "node:crypto";
import type {
  AiRequestsRepository,
  CreateAIRequestRow,
  UpdateAIRequestRow,
} from "../../src/repositories/ai-requests.repository";
import type { AIRequest } from "../../src/types";

/**
 * In-memory stand-in for `PgAiRequestsRepository`, used by this
 * service's own tests so they exercise real business logic
 * (services, controllers, middleware, HTTP status codes, state
 * transitions) without requiring a live PostgreSQL connection.
 * Same convention as `apps/identity-service/tests/support/in-memory-repositories.ts`.
 * Test-only — never imported by production code.
 */
export class InMemoryAiRequestsRepository implements AiRequestsRepository {
  private readonly rows = new Map<string, AIRequest>();

  seed(request: AIRequest): void {
    this.rows.set(request.id, request);
  }

  async create(input: CreateAIRequestRow): Promise<AIRequest> {
    const now = new Date().toISOString();
    const request: AIRequest = {
      id: randomUUID(),
      organizationId: input.organizationId,
      requesterId: input.requesterId,
      input: input.input,
      modelPreference: input.modelPreference,
      policyId: input.policyId,
      status: "RECEIVED",
      modelId: null,
      providerId: null,
      traceId: input.traceId,
      output: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(request.id, request);
    return request;
  }

  async findById(id: string): Promise<AIRequest | null> {
    return this.rows.get(id) ?? null;
  }

  async listByOrganization(organizationId: string, limit: number = 20, cursor?: string): Promise<{ items: AIRequest[]; nextCursor: string | null }> {
    let sorted = [...this.rows.values()]
      .filter((row) => row.organizationId === organizationId)
      .sort((a, b) => {
         // Sort by createdAt desc, then ID desc
         if (a.createdAt !== b.createdAt) {
           return b.createdAt.localeCompare(a.createdAt);
         }
         return b.id.localeCompare(a.id);
      });

    if (cursor) {
      const cursorRow = this.rows.get(cursor);
      if (cursorRow) {
        sorted = sorted.filter(r => 
          r.createdAt < cursorRow.createdAt || 
          (r.createdAt === cursorRow.createdAt && r.id < cursorRow.id)
        );
      } else {
        // Fallback
        sorted = sorted.filter(r => r.id < cursor);
      }
    }

    const items = sorted.slice(0, limit);
    const nextCursor = sorted.length > limit ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  async update(id: string, patch: UpdateAIRequestRow): Promise<AIRequest | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: AIRequest = {
      ...existing,
      status: patch.status ?? existing.status,
      modelId: patch.modelId !== undefined ? patch.modelId : existing.modelId,
      providerId: patch.providerId !== undefined ? patch.providerId : existing.providerId,
      output: patch.output !== undefined ? patch.output : existing.output,
      errorMessage: patch.errorMessage !== undefined ? patch.errorMessage : existing.errorMessage,
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return updated;
  }
}
