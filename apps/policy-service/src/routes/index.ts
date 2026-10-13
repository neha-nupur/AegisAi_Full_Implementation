import { Router } from "express";
import { healthRoutes } from "./health.routes";

/**
 * Aggregate router for the Policy & Approval Service.
 *
 * Mounted by apps/api under /v1/policy for now (modular monolith —
 * see CLAUDE.md section 14). Business routes for this service's own
 * resources (policies, approvals) are added to this router starting Phase 4.
 */
const router = Router();

router.use(healthRoutes);

export { router as policyRouter };
