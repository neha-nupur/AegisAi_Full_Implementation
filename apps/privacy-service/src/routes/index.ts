import { Router } from "express";
import { healthRoutes } from "./health.routes";
import { scanRoutes } from "./scan.routes";

/**
 * Aggregate router for the Privacy Scanner Service.
 *
 * Mounted by apps/api under /v1/privacy. Business routes for this
 * service are added here:
 *   POST /v1/privacy/scan — sandbox endpoint for the frontend.
 */
const router = Router();

router.use(healthRoutes);
router.use(scanRoutes);

export { router as privacyRouter };
