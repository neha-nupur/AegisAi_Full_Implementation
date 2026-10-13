import type { Policy, PolicyDecision, PolicyEvaluationContext, PolicyRule } from "./policy-types";

/**
 * Evaluates a policy's rules against a request context, first match
 * wins (rules are evaluated in array order — see each policy's
 * `rules` field). A rule with no `when` (or an empty one) always
 * matches, which is how a policy's fallback/default rule is written.
 *
 * If no rule matches at all (a malformed policy missing a fallback),
 * the safe default is `ALLOW` is NOT assumed — this fails toward
 * `BLOCK`, since an unmatched request under a governance gateway
 * should never silently pass through ungoverned.
 */
export function evaluatePolicy(policy: Policy, context: PolicyEvaluationContext): PolicyDecision {
  for (const rule of policy.rules) {
    if (ruleMatches(rule, context)) {
      return {
        action: rule.action,
        policyId: policy.id,
        policyVersion: policy.version,
        matchedRuleId: rule.id,
        reason: describeMatch(rule, context),
      };
    }
  }

  return {
    action: "BLOCK",
    policyId: policy.id,
    policyVersion: policy.version,
    matchedRuleId: null,
    reason: "No policy rule matched this request; failing closed (BLOCK) rather than allowing an ungoverned request.",
  };
}

function ruleMatches(rule: PolicyRule, context: PolicyEvaluationContext): boolean {
  const when = rule.when;
  if (!when) return true;

  if (when.findingTypes && !when.findingTypes.some((type) => context.findingTypes.includes(type))) {
    return false;
  }
  if (when.roles && !when.roles.includes(context.requesterRole)) {
    return false;
  }
  if (when.modelPreference && !when.modelPreference.includes(context.modelPreference)) {
    return false;
  }
  // `when.provider` is never checked — provider isn't known at
  // evaluation time in Phase 4 (see PolicyRuleCondition's doc comment).
  return true;
}

function describeMatch(rule: PolicyRule, context: PolicyEvaluationContext): string {
  if (!rule.when) return `Rule "${rule.id}" (default) matched -> ${rule.action}.`;
  const parts: string[] = [];
  if (rule.when.findingTypes) parts.push(`detected findings [${context.findingTypes.join(", ") || "none"}]`);
  if (rule.when.roles) parts.push(`requester role ${context.requesterRole}`);
  if (rule.when.modelPreference) parts.push(`requested model "${context.modelPreference}"`);
  return `Rule "${rule.id}" matched on ${parts.join(", ") || "no conditions"} -> ${rule.action}.`;
}
