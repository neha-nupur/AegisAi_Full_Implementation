import { Router } from "express";
import { scanSandbox } from "../controllers/scan.controller";
import { authenticateJWT } from "@aegisai/identity-service";

const router = Router();

/**
 * POST /v1/privacy/scan — Sandbox endpoint that exposes the real
 * PrivacyScanner to the frontend. Requires JWT authentication for
 * organization scoping. Does NOT persist sandbox results (transient
 * by design — see decision note in scan.controller.ts).
 */
router.post("/scan", authenticateJWT, scanSandbox);

export { router as scanRoutes };
