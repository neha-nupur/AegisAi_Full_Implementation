import type { SecurityAuditServiceContract, HealthStatus } from "@aegisai/shared-types";
import { SERVICE_NAME } from "../service-name";

/**
 * Security, Audit & Observability Service — health check.
 *
 * This is the only operation this service's contract implements in
 * Phase 1. Domain operations (see docs/service-boundaries.md — owns:
 * request_traces, security_events, audit_events) are added starting Phase 8, as concrete methods on
 * SecurityAuditServiceContract plus their own service/repository implementations —
 * not speculated here.
 */
export class SecurityAuditHealthService implements SecurityAuditServiceContract {
  async getHealth(): Promise<HealthStatus> {
    return {
      service: SERVICE_NAME,
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
