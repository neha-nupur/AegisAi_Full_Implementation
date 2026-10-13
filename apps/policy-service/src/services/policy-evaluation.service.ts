import { evaluatePolicy } from "../domain/policy-engine";
import { buildDefaultPolicy } from "../domain/default-policy";
import type { PoliciesRepository } from "../repositories/policies.repository";
import type { Policy, PolicyDecision, PolicyEvaluationContext } from "../domain/policy-types";

/**
 * Resolves an `AIRequest`'s `policyId` to an actual policy, then
 * evaluates it. This is the method `AiRequestsService`
 * (gateway-service) calls in-process for the "Policy Evaluation" step
 * of the request flow.
 */
export class PolicyEvaluationService {
  constructor(private readonly repository: PoliciesRepository) {}

  async evaluate(context: PolicyEvaluationContext): Promise<PolicyDecision> {
    const policy = await this.resolvePolicy(context);
    return evaluatePolicy(policy, context);
  }

  /**
   * If the caller specified a `policyId` and an ACTIVE policy with
   * that id exists in their organization, use it. Otherwise — no
   * `policyId`, an unknown one (e.g. `"policy_default"` before any
   * admin has created a real policy), or one belonging to another
   * organization (never leaked; treated as unknown) — fall back to
   * the built-in default policy. See `default-policy.ts`.
   */
  private async resolvePolicy(context: PolicyEvaluationContext): Promise<Policy> {
    if (context.policyId && context.policyId !== "policy_default") {
      const policy = await this.repository.findById(context.policyId);
      if (policy && policy.organizationId === context.organizationId && policy.status === "ACTIVE") {
        return policy;
      }
    }
    return buildDefaultPolicy(context.organizationId);
  }
}
