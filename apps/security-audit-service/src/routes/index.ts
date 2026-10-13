import { Router } from "express";
import { healthRoutes } from "./health.routes";

/**
 * This service's own `GET /health`, mounted by `apps/api` under
 * `/v1/security-audit` — unchanged since Phase 1. The business API
 * (`/traces`, `/audit-events`, `/security-events`) lives in
 * `api.routes.ts` and is mounted at `/v1` directly instead (see that
 * file's doc comment for why, and for the Phase 11 fixes it carries).
 */
export const securityAuditRouter = Router();
securityAuditRouter.use(healthRoutes);
