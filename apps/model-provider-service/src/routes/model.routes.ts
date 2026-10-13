import { Router } from "express";
import { ModelController } from "../controllers/model.controller";
import { authenticateJWT, requirePermission } from "@aegisai/identity-service";
import { validateBody } from "../middleware/validateBody";
import { validateCreateModel } from "../schemas";

const router = Router();

router.use(authenticateJWT);

router.get("/", requirePermission("organizations:read"), ModelController.listModels);
router.post("/", requirePermission("organizations:write"), validateBody(validateCreateModel), ModelController.createModel);
router.get("/:id", requirePermission("organizations:read"), ModelController.getModel);

export default router;
