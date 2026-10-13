/**
 * Security, Audit & Observability Service
 *
 * Owns: request_traces, security_events, audit_events
 *
 * Phase 8: request tracing, security event recording, and audit
 * persistence, all backed by MongoDB. `AuditService` is called
 * in-process by other services (e.g. Gateway) to record events as
 * requests flow through the system.
 *
 * Phase 11: the query-side REST API (`GET /v1/traces/:id`,
 * `GET /v1/audit-events`, `GET /v1/security-events`) — whose
 * controllers, services, and repositories were all built in Phase 8
 * — is now actually wired up and protected. See
 * `routes/api.routes.ts`'s doc comment for what was broken and what
 * this fixed.
 */
export { AuditService } from "./services/audit.service";
export { SERVICE_NAME } from "./service-name";
export { securityAuditRouter } from "./routes";
export { createSecurityAuditApiRouter, type SecurityAuditApiDependencies } from "./routes/api.routes";

