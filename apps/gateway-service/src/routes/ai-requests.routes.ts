import { Router } from "express";
import { authenticateJWT, requirePermission } from "@aegisai/identity-service";
import { AiRequestsController } from "../controllers/ai-requests.controller";
import { validateBody } from "../middleware/validateBody";
import { validateCreateAIRequest } from "../schemas/create-ai-request.schema";
import type { AiRequestsService } from "../services/ai-requests.service";
import { idempotencyMiddleware } from "../middleware/idempotency";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { etagMiddleware } from "../middleware/etag";
import { cacheControlMiddleware } from "../middleware/cache-control";

/**
 * `/v1/ai-requests` — resource-shaped URLs, mounted at `/v1` directly
 * by `apps/api` (same convention as Identity's business routes — see
 * docs/api-conventions.md), not nested under `/v1/gateway`
 * (`/v1/gateway/health` is unaffected).
 *
 * `authenticateJWT` / `requirePermission` are Identity's own
 * middleware, reused here exactly as `docs/api-conventions.md`
 * anticipated ("reused by any other service's routes once that
 * service needs to protect an endpoint — none do yet").
 */
export function buildAiRequestsRoutes(aiRequestsService: AiRequestsService): Router {
  const router = Router();
  const controller = new AiRequestsController(aiRequestsService);

  const aiRequestsRouter = Router();

  aiRequestsRouter.use(authenticateJWT);
  aiRequestsRouter.use(rateLimitMiddleware());
  aiRequestsRouter.use(cacheControlMiddleware);
  aiRequestsRouter.use(etagMiddleware);

  aiRequestsRouter.post("/", requirePermission("ai_requests:write"), idempotencyMiddleware, validateBody(validateCreateAIRequest), controller.submit);
  aiRequestsRouter.get("/", requirePermission("ai_requests:read"), controller.list);
  aiRequestsRouter.get("/:id", requirePermission("ai_requests:read"), controller.getById);

  router.use("/ai-requests", aiRequestsRouter);
  return router;
}
