import { evaluatePolicy } from "../src/domain/policy-engine";
import { buildDefaultPolicy } from "../src/domain/default-policy";
import type { PolicyEvaluationContext } from "../src/domain/policy-types";

function context(overrides: Partial<PolicyEvaluationContext> = {}): PolicyEvaluationContext {
  return {
    organizationId: "org-1",
    policyId: "policy_default",
    requesterRole: "DEVELOPER",
    findingTypes: [],
    modelPreference: "auto",
    ...overrides,
  };
}

describe("evaluatePolicy — built-in default policy", () => {
  const policy = buildDefaultPolicy("org-1");

  test("normal request (no findings) -> ALLOW", () => {
    const decision = evaluatePolicy(policy, context());
    expect(decision.action).toBe("ALLOW");
    expect(decision.matchedRuleId).toBe("allow-default");
  });

  test("PII findings -> MASK", () => {
    const decision = evaluatePolicy(policy, context({ findingTypes: ["EMAIL"] }));
    expect(decision.action).toBe("MASK");
    expect(decision.matchedRuleId).toBe("mask-pii");
  });

  test("secret findings -> BLOCK", () => {
    const decision = evaluatePolicy(policy, context({ findingTypes: ["API_KEY"] }));
    expect(decision.action).toBe("BLOCK");
    expect(decision.matchedRuleId).toBe("block-secrets");
  });

  test("sensitive keyword findings -> REQUIRE_APPROVAL", () => {
    const decision = evaluatePolicy(policy, context({ findingTypes: ["SENSITIVE_KEYWORD"] }));
    expect(decision.action).toBe("REQUIRE_APPROVAL");
    expect(decision.matchedRuleId).toBe("require-approval-sensitive");
  });

  test("secret + PII together -> BLOCK wins (first-match-wins rule order)", () => {
    const decision = evaluatePolicy(policy, context({ findingTypes: ["API_KEY", "EMAIL"] }));
    expect(decision.action).toBe("BLOCK");
  });
});

describe("evaluatePolicy — custom rules and fail-closed default", () => {
  test("a rule scoped to a role only matches that role", () => {
    const policy = buildDefaultPolicy("org-1");
    policy.rules = [
      { id: "admin-only-route", action: "ROUTE", when: { roles: ["ORGANIZATION_ADMIN"] } },
      { id: "fallback-allow", action: "ALLOW" },
    ];

    const asAdmin = evaluatePolicy(policy, context({ requesterRole: "ORGANIZATION_ADMIN" }));
    expect(asAdmin.action).toBe("ROUTE");

    const asDeveloper = evaluatePolicy(policy, context({ requesterRole: "DEVELOPER" }));
    expect(asDeveloper.action).toBe("ALLOW");
  });

  test("a policy with no matching rule and no fallback fails closed to BLOCK", () => {
    const policy = buildDefaultPolicy("org-1");
    policy.rules = [{ id: "only-secrets", action: "BLOCK", when: { findingTypes: ["API_KEY"] } }];

    const decision = evaluatePolicy(policy, context({ findingTypes: [] }));
    expect(decision.action).toBe("BLOCK");
    expect(decision.matchedRuleId).toBeNull();
    expect(decision.reason).toContain("failing closed");
  });

  test("a modelPreference condition only matches the listed models", () => {
    const policy = buildDefaultPolicy("org-1");
    policy.rules = [
      { id: "premium-approval", action: "REQUIRE_APPROVAL", when: { modelPreference: ["gpt-premium"] } },
      { id: "fallback-allow", action: "ALLOW" },
    ];

    expect(evaluatePolicy(policy, context({ modelPreference: "gpt-premium" })).action).toBe("REQUIRE_APPROVAL");
    expect(evaluatePolicy(policy, context({ modelPreference: "auto" })).action).toBe("ALLOW");
  });
});
