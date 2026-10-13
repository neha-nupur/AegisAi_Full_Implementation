import { Router } from "express";
import { healthRoutes } from "./health.routes";

/**
 * Health-only router for the Identity & Access Management Service.
 *
 * Mounted by apps/api under `/v1/identity` (modular monolith — see
 * CLAUDE.md section 14), so `GET /v1/identity/health` keeps working
 * exactly as it did in Phase 1.
 *
 * This service's Phase 2 business routes (`/auth/login`, `/users`,
 * `/service-accounts`, `/organizations/:id`) are a *separate* router
 * — `identityApiRouter`, from `./api.routes` — mounted by apps/api
 * directly at `/v1` instead, per the resource-shaped URL convention
 * in docs/api-conventions.md (identity's public resources are not
 * nested under `/identity`; only its own health check is).
 */
const router = Router();

router.use(healthRoutes);

export { router as identityRouter };
export { createIdentityApiRouter, identityApiRouter, type IdentityApiDependencies } from "./api.routes";

