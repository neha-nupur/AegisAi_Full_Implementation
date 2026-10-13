import type { IdentityServiceContract, HealthStatus } from "@aegisai/shared-types";
import { SERVICE_NAME } from "../service-name";

/**
 * Identity & Access Management Service — health check.
 *
 * This is the only operation this service's contract implements in
 * Phase 1. Domain operations (see docs/service-boundaries.md — owns:
 * organizations, users, service_accounts) are added starting Phase 2, as concrete methods on
 * IdentityServiceContract plus their own service/repository implementations —
 * not speculated here.
 */
export class IdentityHealthService implements IdentityServiceContract {
  async getHealth(): Promise<HealthStatus> {
    return {
      service: SERVICE_NAME,
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
