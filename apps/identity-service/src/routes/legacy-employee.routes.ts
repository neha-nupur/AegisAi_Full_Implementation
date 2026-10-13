import { Router } from "express";
import { LegacyEmployeeController } from "../controllers/legacy-employee.controller";
import { authenticateJWT } from "../middleware/authenticateJWT";
import { requirePermission } from "../middleware/requirePermission";
import type { LegacyEmployeeClient } from "../integrations/soap/legacy-employee.client";

/**
 * `/v1/legacy-employees/:employeeId` (Phase 10) — the one REST
 * operation that demonstrates the SOAP connector. Reuses
 * `users:read` rather than introducing a new permission for a single
 * demo endpoint — checking legacy employee status is directory
 * lookup, the same class of read `users:read` already covers.
 */
export function buildLegacyEmployeeRoutes(client: LegacyEmployeeClient): Router {
  const router = Router();
  const controller = new LegacyEmployeeController(client);

  router.use(authenticateJWT);
  router.get("/legacy-employees/:employeeId", requirePermission("users:read"), controller.checkEmployee);

  return router;
}
