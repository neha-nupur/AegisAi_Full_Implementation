import { Router } from "express";
import { healthRoutes } from "./health.routes";
import providerRoutes from "./provider.routes";
import modelRoutes from "./model.routes";

/**
 * Aggregate router for the Model & Provider Management Service.
 *
 * Mounted by apps/api under /v1/model-provider for now (modular monolith —
 * see CLAUDE.md section 14).
 */
const router = Router();

router.use(healthRoutes);
router.use("/providers", providerRoutes);
router.use("/models", modelRoutes);

export { router as modelProviderRouter };
