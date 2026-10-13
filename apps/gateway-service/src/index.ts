/**
 * AI Request Gateway Service
 *
 * Owns: ai_requests, request lifecycle metadata
 *
 * Phase 3: first real vertical slice.
 * - `gatewayRouter` — this service's own `GET /health`, mounted by
 *   apps/api under `/v1/gateway` (unchanged since Phase 1).
 * - `gatewayApiRouter` — this service's business API
 *   (`POST /v1/ai-requests`, `GET /v1/ai-requests`,
 *   `GET /v1/ai-requests/:id`), mounted by apps/api at `/v1` directly
 *   — same convention as Identity's business routes (Phase 2), see
 *   docs/api-conventions.md.
 * - `AiRequestsService` / `PgAiRequestsRepository` — exported so
 *   `apps/api` can wire a shared Pino logger in for structured audit
 *   events (see `services/ai-requests.service.ts`).
 *
 * See docs/service-boundaries.md for the full breakdown.
 */
export { SERVICE_NAME } from "./service-name";
export { gatewayRouter } from "./routes";
export { gatewayApiRouter, createGatewayApiRouter, type GatewayApiDependencies } from "./routes/api.routes";
export { AiRequestsService, type AuditLogger, type ApprovalCreator } from "./services/ai-requests.service";
export { PgAiRequestsRepository, type AiRequestsRepository } from "./repositories/ai-requests.repository";
export { AI_REQUEST_STATUSES, type AIRequestStatus } from "./domain/status";
export type { AIRequest, CreateAIRequestInput } from "./types";
