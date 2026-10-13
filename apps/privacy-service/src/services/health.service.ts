import type { PrivacyServiceContract, HealthStatus } from "@aegisai/shared-types";
import { SERVICE_NAME } from "../service-name";

/**
 * Privacy Scanner Service — health check.
 *
 * This is the only operation this service's contract implements in
 * Phase 1. Domain operations (see docs/service-boundaries.md — owns:
 * scanner_results, scanner findings) are added starting Phase 4, as concrete methods on
 * PrivacyServiceContract plus their own service/repository implementations —
 * not speculated here.
 */
export class PrivacyHealthService implements PrivacyServiceContract {
  async getHealth(): Promise<HealthStatus> {
    return {
      service: SERVICE_NAME,
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
