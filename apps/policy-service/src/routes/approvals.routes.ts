import { Router } from "express";
import { authenticateJWT, requirePermission } from "@aegisai/identity-service";
import { ApprovalsController } from "../controllers/approvals.controller";
import { validateBody } from "../middleware/validateBody";
import { validateDecideApproval } from "../schemas/policy.schemas";
import type { ApprovalsService } from "../services/approvals.service";

/** `/v1/approvals` — mounted directly at `/v1`. Creation is internal (called by `AiRequestsService` when Policy's decision is REQUIRE_APPROVAL, not a public POST — see `docs/api-conventions.md`). */
export function buildApprovalsRoutes(approvalsService: ApprovalsService): Router {
  const router = Router();
  const controller = new ApprovalsController(approvalsService);

  const approvalsRouter = Router();

  approvalsRouter.use(authenticateJWT);

  approvalsRouter.get("/", requirePermission("approvals:read"), controller.list);
  approvalsRouter.get("/:id", requirePermission("approvals:read"), controller.getById);
  approvalsRouter.post("/:id/approve", requirePermission("approvals:write"), validateBody(validateDecideApproval), controller.approve);
  approvalsRouter.post("/:id/reject", requirePermission("approvals:write"), validateBody(validateDecideApproval), controller.reject);

  router.use("/approvals", approvalsRouter);
  return router;
}
