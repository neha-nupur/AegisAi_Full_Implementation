/**
 * Policy & Approval Service — domain types (Phase 4).
 */
import type { Role } from "@aegisai/identity-service";
import type { FindingType } from "@aegisai/privacy-service";

export const POLICY_ACTIONS = ["ALLOW", "BLOCK", "MASK", "REQUIRE_APPROVAL", "ROUTE"] as const;
export type PolicyAction = (typeof POLICY_ACTIONS)[number];

export const POLICY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

/**
 * A rule's conditions. Every specified condition must hold for the
 * rule to match (logical AND); an omitted condition is not checked.
 * A rule with no `when` at all (or an empty object) matches every
 * request — the conventional way to write a policy's fallback/default
 * rule (see `default-policy.ts`).
 *
 * `provider` is accepted for forward-compatibility but never
 * populated in Phase 4 — provider selection happens *after* policy
 * evaluation in the request flow (Policy runs before Model &
 * Provider routing, which is Phase 5), so no rule can actually
 * condition on it yet.
 */
export interface PolicyRuleCondition {
  findingTypes?: FindingType[];
  roles?: Role[];
  modelPreference?: string[];
  provider?: string[];
}

export interface PolicyRule {
  id: string;
  action: PolicyAction;
  when?: PolicyRuleCondition;
}

export interface Policy {
  id: string;
  organizationId: string;
  name: string;
  version: number;
  rules: PolicyRule[];
  status: PolicyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePolicyInput {
  name: string;
  rules: PolicyRule[];
  status?: PolicyStatus;
}

export interface UpdatePolicyInput {
  name?: string;
  rules?: PolicyRule[];
  status?: PolicyStatus;
}

/** What `AiRequestsService` (gateway-service) passes in for evaluation. */
export interface PolicyEvaluationContext {
  organizationId: string;
  policyId: string | null;
  requesterRole: Role;
  findingTypes: FindingType[];
  modelPreference: string;
}

export interface PolicyDecision {
  action: PolicyAction;
  policyId: string | null;
  policyVersion: number | null;
  matchedRuleId: string | null;
  reason: string;
}
