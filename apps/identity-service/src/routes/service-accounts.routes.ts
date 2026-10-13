import { Router } from "express";
import { ServiceAccountsController } from "../controllers/service-accounts.controller";
import { authenticateJWT } from "../middleware/authenticateJWT";
import { requirePermission } from "../middleware/requirePermission";
import type { ServiceAccountsService } from "../services/service-accounts.service";

export function buildServiceAccountsRoutes(serviceAccountsService: ServiceAccountsService): Router {
  const router = Router();
  const controller = new ServiceAccountsController(serviceAccountsService);

  router.use(authenticateJWT);

  router.get("/service-accounts", requirePermission("service_accounts:read"), controller.list);
  router.post("/service-accounts", requirePermission("service_accounts:write"), controller.create);
  router.patch("/service-accounts/:id", requirePermission("service_accounts:write"), controller.update);
  router.delete("/service-accounts/:id", requirePermission("service_accounts:write"), controller.disable);

  return router;
}
