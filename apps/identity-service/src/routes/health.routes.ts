import { Router } from "express";
import { IdentityHealthController } from "../controllers/health.controller";

const router = Router();
const controller = new IdentityHealthController();

router.get("/health", controller.getHealth);

export { router as healthRoutes };
