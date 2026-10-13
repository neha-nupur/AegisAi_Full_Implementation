/**
 * Privacy Scanner Service — finding taxonomy (Phase 4).
 *
 * `SuggestedAction` is this scanner's own recommendation for a
 * finding, not the final decision — Policy & Approval Service makes
 * the actual ALLOW/BLOCK/MASK/REQUIRE_APPROVAL/ROUTE call, taking
 * these findings (via `findingTypes`) as one input among several
 * (role, organization, requested model, policy rules). See
 * `apps/policy-service/src/domain/policy-engine.ts`.
 */
export const FINDING_TYPES = [
  "EMAIL",
  "PHONE",
  "PAN",
  "AADHAAR",
  "API_KEY",
  "PASSWORD",
  "SENSITIVE_KEYWORD",
] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const SUGGESTED_ACTIONS = ["MASK", "BLOCK", "REQUIRE_APPROVAL"] as const;
export type SuggestedAction = (typeof SUGGESTED_ACTIONS)[number];

/** Default suggested action per finding type — see the phase 4 demo matrix in `apps/privacy-service/README.md`. */
export const DEFAULT_ACTION_BY_TYPE: Record<FindingType, SuggestedAction> = {
  EMAIL: "MASK",
  PHONE: "MASK",
  PAN: "MASK",
  AADHAAR: "MASK",
  API_KEY: "BLOCK",
  PASSWORD: "BLOCK",
  SENSITIVE_KEYWORD: "REQUIRE_APPROVAL",
};

/** Character-offset location of a finding within the scanned field. Never the matched text itself — see `scanner.ts`. */
export interface FindingLocation {
  field: string;
  start: number;
  end: number;
}

export interface Finding {
  type: FindingType;
  location: FindingLocation;
  confidence: number;
  action: SuggestedAction;
}

export interface ScanResult {
  detected: boolean;
  findings: Finding[];
}
