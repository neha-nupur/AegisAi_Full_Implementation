/**
 * AI Request Gateway Service — local domain types.
 *
 * Owns: `ai_requests`, request lifecycle metadata (Phase 3). These
 * describe this service's own entity and its request/response DTOs —
 * internal to this service, same convention as
 * `apps/identity-service/src/types/index.ts`.
 */
import type { AIRequestStatus } from "../domain/status";

/**
 * Full `ai_requests` row.
 *
 * Field list matches the Phase 3 spec exactly, plus two additions
 * needed to actually return "a controlled response" to the caller
 * (not in the original list, but required to make the vertical slice
 * work end to end): `output` (the provider's response once
 * `COMPLETED`) and `errorMessage` (why the request is `FAILED`).
 */
export interface AIRequest {
  id: string;
  organizationId: string;
  requesterId: string;
  input: string;
  modelPreference: string;
  policyId: string | null;
  status: AIRequestStatus;
  modelId: string | null;
  providerId: string | null;
  /** Resolved human-readable name from the models table (via LEFT JOIN in the repository). Absent on create/update returns. */
  modelName?: string;
  /** Resolved human-readable name from the providers table (via LEFT JOIN in the repository). Absent on create/update returns. */
  providerName?: string;
  traceId: string;
  output: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Request body for `POST /v1/ai-requests`, after AJV validation. */
export interface CreateAIRequestInput {
  input: string;
  modelPreference?: string;
  policyId?: string;
}

/** Cursor-paginated list result. Real cursor pagination (opaque cursor, `next` link) arrives Phase 6 — see docs/checklist-mapping.md item 8. */
export interface AIRequestListResult {
  items: AIRequest[];
}
