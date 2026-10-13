import { Router } from "express";
import { SettingsController } from "../controllers/settings.controller";
import type { SettingsService } from "../services/settings.service";
import { authenticateJWT } from "../middleware/authenticateJWT";
import { requirePermission } from "../middleware/requirePermission";

export function buildSettingsRoutes(service: SettingsService): Router {
  const controller = new SettingsController(service);
  const router = Router();

  // Settings are always organization-scoped; they require an authenticated user.
  router.use("/settings", authenticateJWT);

  // Both ORGANIZATION_ADMIN and DEVELOPER / SECURITY_AUDITOR can read settings.
  router.get("/settings", requirePermission("settings:read"), controller.get);

  // Only ORGANIZATION_ADMIN can update settings.
  router.patch("/settings", requirePermission("settings:write"), controller.update);

  return router;
}
