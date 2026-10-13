import { Router } from "express";
import { GatewayHealthController } from "../controllers/health.controller";

const router = Router();
const controller = new GatewayHealthController();

router.get("/health", controller.getHealth);

export { router as healthRoutes };
