import type { ModelProviderServiceContract, HealthStatus } from "@aegisai/shared-types";
import { SERVICE_NAME } from "../service-name";

/**
 * Model & Provider Management Service — health check.
 *
 * This is the only operation this service's contract implements in
 * Phase 1. Domain operations (see docs/service-boundaries.md — owns:
 * providers, models, routing metadata) are added starting Phase 5, as concrete methods on
 * ModelProviderServiceContract plus their own service/repository implementations —
 * not speculated here.
 */
export class ModelProviderHealthService implements ModelProviderServiceContract {
  async getHealth(): Promise<HealthStatus> {
    return {
      service: SERVICE_NAME,
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
