import { Router } from "express";
import { ModelProviderHealthController } from "../controllers/health.controller";

const router = Router();
const controller = new ModelProviderHealthController();

router.get("/health", controller.getHealth);

export { router as healthRoutes };
