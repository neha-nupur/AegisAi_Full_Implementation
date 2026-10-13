import { Router } from "express";
import { authenticateJWT, requirePermission } from "@aegisai/identity-service";
import { TracesController } from "../controllers/traces.controller";
import { AuditEventsController } from "../controllers/audit-events.controller";
import { SecurityEventsController } from "../controllers/security-events.controller";

export interface SecurityAuditApiDependencies {
  tracesController?: TracesController;
  auditEventsController?: AuditEventsController;
  securityEventsController?: SecurityEventsController;
}

/**
 * Security & Audit Service's business API router: `/traces`,
 * `/audit-events`, `/security-events` (mounted by `apps/api` at `/v1`
 * directly, same convention as every other service's business
 * routes — NOT nested under `/v1/security-audit`, which remains
 * this service's own `GET /health` only, per `docs/api-conventions.md`).
 *
 * Phase 11 hardening: these controllers, their services, and their
 * MongoDB repositories were all built in Phase 8, but were never
 * actually reachable — `routes/index.ts` (the health-only router)
 * wired them up directly with **no authentication middleware at
 * all**, and each controller read `req.user` (a property nothing in
 * this codebase ever sets — `authenticateJWT` sets `req.principal`),
 * which would have thrown a `TypeError` on every call once reached.
 * Both fixed here: real `authenticateJWT`/`requirePermission`
 * (`audit:read`, Identity's RBAC model — see
 * `apps/identity-service/src/domain/rbac.ts`), and the controllers
 * now read `req.principal`.
 */
export function createSecurityAuditApiRouter(deps: SecurityAuditApiDependencies = {}): Router {
  const tracesController = deps.tracesController ?? new TracesController();
  const auditEventsController = deps.auditEventsController ?? new AuditEventsController();
  const securityEventsController = deps.securityEventsController ?? new SecurityEventsController();

  const router = Router();
  router.use(authenticateJWT);

  router.get("/traces", requirePermission("audit:read"), tracesController.list.bind(tracesController));
  router.get("/traces/:traceId", requirePermission("audit:read"), tracesController.get.bind(tracesController));
  router.get("/audit-events", requirePermission("audit:read"), auditEventsController.list.bind(auditEventsController));
  router.get("/security-events", requirePermission("audit:read"), securityEventsController.list.bind(securityEventsController));

  return router;
}
