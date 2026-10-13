/**
 * Shared types used across every AegisAI service.
 *
 * Only cross-cutting contracts every service needs go here (error
 * envelope, correlation ID, service contracts, health payload shape).
 * Domain models (User, Policy, AIRequest, etc.) belong to their
 * owning service's own `types/` folder and are never speculated here
 * ahead of the phase that introduces them.
 */

/** A correlation ID threads through every service call for a single request. */
export type CorrelationId = string;

/**
 * The one error shape every AegisAI API must use, per the project's
 * error contract (see docs/api-conventions.md).
 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    traceId: CorrelationId;
  };
}

/** Generic success envelope for endpoints that want a consistent wrapper. */
export interface ServiceResponse<T> {
  data: T;
  traceId: CorrelationId;
}

/** Common identifier alias — services may narrow this with branded types later. */
export type Id = string;

/**
 * Base class for errors that should be reported to API callers with a
 * specific HTTP status and error code, in the `ApiErrorBody` shape
 * above. Shared across every service (not just `apps/api`) so any
 * service's controller/middleware can throw a typed HTTP error and
 * have the host process's central error handler
 * (`apps/api/src/middleware/errorHandler.ts`) render it consistently
 * — see docs/api-conventions.md.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Service contracts.
 *
 * Every logical service exposes its capabilities through a contract
 * defined here, never through direct access to another service's
 * repository or tables (see CLAUDE.md section 3). Today these
 * contracts are called in-process; if a service is later split into
 * its own process, the contract shape is what an HTTP/RPC adapter
 * would implement against, so callers do not change.
 *
 * Domain operations are added to a service's own contract interface,
 * phase by phase, alongside the service that implements them — not
 * speculated here ahead of time. Services with no domain operations
 * yet are a plain alias of `ServiceContract`; a service gets its own
 * interface (extending `ServiceContract`) once it has more than
 * health to publish (see `IdentityServiceContract` below, added
 * Phase 2 — still just health, since nothing else in-process calls
 * Identity yet; its HTTP endpoints are Identity's public surface for
 * Phase 2 callers).
 */

/** Health status returned by every service's GET /health endpoint. */
export interface HealthStatus {
  service: string;
  status: "ok";
  timestamp: string;
}

/** Base contract every logical service implements. */
export interface ServiceContract {
  getHealth(): Promise<HealthStatus>;
}

/** Identity & Access Management Service contract. Owns: organizations, users, service_accounts. */
export type IdentityServiceContract = ServiceContract;

/** AI Request Gateway Service contract. Owns: ai_requests, request lifecycle metadata. */
export type GatewayServiceContract = ServiceContract;

/** Privacy Scanner Service contract. Owns: scanner_results, scanner findings. */
export type PrivacyServiceContract = ServiceContract;

/** Policy & Approval Service contract. Owns: policies, approvals. */
export type PolicyServiceContract = ServiceContract;

/** Model & Provider Management Service contract. Owns: providers, models, routing metadata. */
export type ModelProviderServiceContract = ServiceContract;

/** Security, Audit & Observability Service contract. Owns: request_traces, security_events, audit_events. */
export type SecurityAuditServiceContract = ServiceContract;
