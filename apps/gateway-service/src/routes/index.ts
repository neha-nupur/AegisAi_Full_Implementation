import { Router } from "express";
import { healthRoutes } from "./health.routes";

/**
 * Aggregate router for the AI Request Gateway Service.
 *
 * Mounted by apps/api under /v1/gateway for now (modular monolith —
 * see CLAUDE.md section 14). Business routes for this service's own
 * resources (ai_requests, request lifecycle metadata) are added to this router starting Phase 3.
 */
const router = Router();

router.use(healthRoutes);

export { router as gatewayRouter };
