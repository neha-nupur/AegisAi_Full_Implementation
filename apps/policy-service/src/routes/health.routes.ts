import { Router } from "express";
import { PolicyHealthController } from "../controllers/health.controller";

const router = Router();
const controller = new PolicyHealthController();

router.get("/health", controller.getHealth);

export { router as healthRoutes };
