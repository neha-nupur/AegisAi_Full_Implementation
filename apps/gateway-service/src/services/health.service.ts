import type { GatewayServiceContract, HealthStatus } from "@aegisai/shared-types";
import { SERVICE_NAME } from "../service-name";

/**
 * AI Request Gateway Service — health check.
 *
 * This is the only operation this service's contract implements in
 * Phase 1. Domain operations (see docs/service-boundaries.md — owns:
 * ai_requests, request lifecycle metadata) are added starting Phase 3, as concrete methods on
 * GatewayServiceContract plus their own service/repository implementations —
 * not speculated here.
 */
export class GatewayHealthService implements GatewayServiceContract {
  async getHealth(): Promise<HealthStatus> {
    return {
      service: SERVICE_NAME,
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
