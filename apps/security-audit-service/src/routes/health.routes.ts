import { Router } from "express";
import { SecurityAuditHealthController } from "../controllers/health.controller";

const router = Router();
const controller = new SecurityAuditHealthController();

router.get("/health", controller.getHealth);

export { router as healthRoutes };
