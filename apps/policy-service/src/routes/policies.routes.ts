import { Router } from "express";
import { authenticateJWT, requirePermission } from "@aegisai/identity-service";
import { PoliciesController } from "../controllers/policies.controller";
import { validateBody } from "../middleware/validateBody";
import { validateCreatePolicy, validateUpdatePolicy } from "../schemas/policy.schemas";
import type { PoliciesService } from "../services/policies.service";

/** `/v1/policies` — mounted directly at `/v1`, same convention as Identity/Gateway (see docs/api-conventions.md). */
export function buildPoliciesRoutes(policiesService: PoliciesService): Router {
  const router = Router();
  const controller = new PoliciesController(policiesService);

  router.use(authenticateJWT);

  router.post("/policies", requirePermission("policies:write"), validateBody(validateCreatePolicy), controller.create);
  router.get("/policies", requirePermission("policies:read"), controller.list);
  router.get("/policies/:id", requirePermission("policies:read"), controller.getById);
  router.patch("/policies/:id", requirePermission("policies:write"), validateBody(validateUpdatePolicy), controller.update);
  router.delete("/policies/:id", requirePermission("policies:write"), controller.delete);

  return router;
}
