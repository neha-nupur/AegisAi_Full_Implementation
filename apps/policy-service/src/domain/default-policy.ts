import type { Policy } from "./policy-types";

/**
 * Built-in fallback policy (Phase 4). Used whenever an
 * `AIRequest`'s `policyId` doesn't resolve to a policy an
 * organization has actually created (including the very first
 * request an organization ever makes, before any admin has visited
 * `POST /v1/policies` — e.g. the `"policy_default"` id used in the
 * Phase 3 example payload). Never persisted; synthesized on demand
 * by `PolicyEvaluationService.resolvePolicy`.
 *
 * Encodes exactly the four decisions this phase's demo requires:
 * normal -> ALLOW, detected PII -> MASK, detected secret -> BLOCK,
 * sensitive keyword -> REQUIRE_APPROVAL. Rules are evaluated in
 * order, first match wins, so secrets are checked (and BLOCKed)
 * before a co-occurring PII finding would otherwise MASK the request.
 */
export function buildDefaultPolicy(organizationId: string): Policy {
  const now = new Date(0).toISOString();
  return {
    id: "policy_default",
    organizationId,
    name: "Built-in default policy",
    version: 0,
    status: "ACTIVE",
    rules: [
      { id: "block-secrets", action: "BLOCK", when: { findingTypes: ["API_KEY", "PASSWORD"] } },
      { id: "require-approval-sensitive", action: "REQUIRE_APPROVAL", when: { findingTypes: ["SENSITIVE_KEYWORD"] } },
      { id: "mask-pii", action: "MASK", when: { findingTypes: ["EMAIL", "PHONE", "PAN", "AADHAAR"] } },
      { id: "allow-default", action: "ALLOW" },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
