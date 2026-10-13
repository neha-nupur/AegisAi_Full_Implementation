import { Router } from "express";
import { ProviderController } from "../controllers/provider.controller";
import { authenticateJWT, requirePermission } from "@aegisai/identity-service";
import { validateBody } from "../middleware/validateBody";
import { validateCreateProvider } from "../schemas";

const router = Router();

router.use(authenticateJWT);

router.get("/", requirePermission("organizations:read"), ProviderController.listProviders);
router.post("/", requirePermission("organizations:write"), validateBody(validateCreateProvider), ProviderController.createProvider);
router.get("/:id", requirePermission("organizations:read"), ProviderController.getProvider);

export default router;
