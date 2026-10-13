import type { PolicyServiceContract, HealthStatus } from "@aegisai/shared-types";
import { SERVICE_NAME } from "../service-name";

/**
 * Policy & Approval Service — health check.
 *
 * This is the only operation this service's contract implements in
 * Phase 1. Domain operations (see docs/service-boundaries.md — owns:
 * policies, approvals) are added starting Phase 4, as concrete methods on
 * PolicyServiceContract plus their own service/repository implementations —
 * not speculated here.
 */
export class PolicyHealthService implements PolicyServiceContract {
  async getHealth(): Promise<HealthStatus> {
    return {
      service: SERVICE_NAME,
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
