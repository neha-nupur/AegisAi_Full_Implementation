import { Router } from "express";
import { PrivacyHealthController } from "../controllers/health.controller";

const router = Router();
const controller = new PrivacyHealthController();

router.get("/health", controller.getHealth);

export { router as healthRoutes };
