import { Router } from "express";
import { PgPoliciesRepository } from "../repositories/policies.repository";
import { PgApprovalsRepository } from "../repositories/approvals.repository";
import { PoliciesService } from "../services/policies.service";
import { ApprovalsService } from "../services/approvals.service";
import type { ApprovalResumeHandler } from "../services/approval-resume-handler";
import { buildPoliciesRoutes } from "./policies.routes";
import { buildApprovalsRoutes } from "./approvals.routes";

export interface PolicyApiDependencies {
  policiesService?: PoliciesService;
  approvalsService?: ApprovalsService;
  resumeHandler?: ApprovalResumeHandler;
}

/**
 * Builds Policy & Approval's business API router (`/policies`,
 * `/approvals`, mounted by `apps/api` at `/v1`). `resumeHandler` is
 * how `apps/api` wires gateway-service's `AiRequestsService` in
 * without policy-service ever importing gateway-service's package —
 * see `services/approval-resume-handler.ts`.
 */
export function createPolicyApiRouter(deps: PolicyApiDependencies = {}): Router {
  const policiesRepository = new PgPoliciesRepository();
  const approvalsRepository = new PgApprovalsRepository();

  const policiesService = deps.policiesService ?? new PoliciesService(policiesRepository);
  const approvalsService = deps.approvalsService ?? new ApprovalsService(approvalsRepository, deps.resumeHandler);

  const router = Router();
  router.use(buildPoliciesRoutes(policiesService));
  router.use(buildApprovalsRoutes(approvalsService));

  return router;
}
