import { Router } from "express";
import { PgAiRequestsRepository } from "../repositories/ai-requests.repository";
import { AiRequestsService, type AuditLogger } from "../services/ai-requests.service";

import { buildAiRequestsRoutes } from "./ai-requests.routes";

export interface GatewayApiDependencies {
  aiRequestsService?: AiRequestsService;
  logger?: AuditLogger;
}

/**
 * Builds the Gateway service's business API router: `/ai-requests`
 * (mounted by `apps/api` at `/v1` — see `docs/api-conventions.md`).
 *
 * Same override-for-testing pattern as
 * `apps/identity-service/src/routes/api.routes.ts`: a real
 * `PgAiRequestsRepository` by default, with each dependency
 * overridable so tests can inject in-memory fakes instead of
 * requiring a real PostgreSQL connection — see `tests/support/`.
 */
export function createGatewayApiRouter(deps: GatewayApiDependencies = {}): Router {
  const aiRequestsRepository = new PgAiRequestsRepository();
  // Service defaults will populate modelRouter, repositories, factory, and logger
  const aiRequestsService =
    deps.aiRequestsService ?? new AiRequestsService(
      aiRequestsRepository, 
      undefined, 
      undefined, 
      undefined, 
      undefined, 
      deps.logger
    );

  const router = Router();
  router.use(buildAiRequestsRoutes(aiRequestsService));

  return router;
}

/**
 * Production singleton — a real `PgAiRequestsRepository` underneath,
 * but note it only touches the database (and therefore only requires
 * `DATABASE_URL`) on an actual request, not at import time (see
 * `db/pool.ts`). `apps/api` does not use this singleton — it calls
 * `createGatewayApiRouter` directly so it can supply the shared
 * logger and, since Phase 4, wire `setApprovalCreator` after
 * construction (see `apps/api/src/app.ts`). A caller that imports
 * this singleton directly gets a working ALLOW/MASK/BLOCK flow but no
 * REQUIRE_APPROVAL -> Approval-record creation, since nothing has
 * called `setApprovalCreator` on it.
 */
export const gatewayApiRouter = createGatewayApiRouter();
