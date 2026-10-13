import { Router } from "express";
import { OrganizationsController } from "../controllers/organizations.controller";
import { authenticateJWT } from "../middleware/authenticateJWT";
import { requirePermission } from "../middleware/requirePermission";
import { requireRole } from "../middleware/requireRole";
import type { OrganizationsService } from "../services/organizations.service";

export function buildOrganizationsRoutes(organizationsService: OrganizationsService): Router {
  const router = Router();
  const controller = new OrganizationsController(organizationsService);

  router.use(authenticateJWT);

  router.get("/organizations/:id", requirePermission("organizations:read"), controller.getById);
  // Organization settings are administrative — gated by role rather
  // than permission, deliberately exercising requireRole() as well as
  // requirePermission() (both are required by this phase).
  router.patch("/organizations/:id", requireRole("ORGANIZATION_ADMIN"), controller.update);

  return router;
}
