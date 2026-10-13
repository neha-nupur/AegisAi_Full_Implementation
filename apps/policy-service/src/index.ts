/**
 * Policy & Approval Service
 *
 * Owns: policies, approvals
 *
 * Phase 4: policy CRUD (`/v1/policies`), a rule-based evaluation
 * engine (`evaluatePolicy` — first-match-wins, fails toward BLOCK if
 * nothing matches), a built-in default policy used until an
 * organization creates its own, and the human approval workflow
 * (`/v1/approvals/:id/approve|reject`).
 *
 * `PolicyEvaluationService` is exported so `AiRequestsService`
 * (gateway-service) can call it in-process for the "Policy
 * Evaluation" step. `ApprovalResumeHandler` is exported (an
 * interface, not an implementation) so `apps/api` — the composition
 * root — can wire gateway-service's `AiRequestsService` in as the
 * thing that resumes an `AIRequest` once a human decides an
 * approval, without policy-service ever depending on
 * gateway-service's package. See `services/approval-resume-handler.ts`.
 */
export { SERVICE_NAME } from "./service-name";
export { policyRouter } from "./routes";
export { createPolicyApiRouter, type PolicyApiDependencies } from "./routes/api.routes";
export { PoliciesService } from "./services/policies.service";
export { PolicyEvaluationService } from "./services/policy-evaluation.service";
export { ApprovalsService } from "./services/approvals.service";
export type { ApprovalResumeHandler } from "./services/approval-resume-handler";
export { PgPoliciesRepository, type PoliciesRepository } from "./repositories/policies.repository";
export { PgApprovalsRepository, type ApprovalsRepository, type Approval, type ApprovalStatus, type CreateApprovalRow } from "./repositories/approvals.repository";
export { evaluatePolicy } from "./domain/policy-engine";
export { buildDefaultPolicy } from "./domain/default-policy";
export {
  POLICY_ACTIONS,
  POLICY_STATUSES,
  type PolicyAction,
  type PolicyStatus,
  type Policy,
  type PolicyRule,
  type PolicyRuleCondition,
  type PolicyEvaluationContext,
  type PolicyDecision,
  type CreatePolicyInput,
} from "./domain/policy-types";
