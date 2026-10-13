/**
 * AI Request Gateway Service — request lifecycle states.
 *
 * A request moves through these states left-to-right; several branch
 * points exist after `VALIDATED` (Phase 4 — Privacy Scan + Policy
 * Evaluation):
 *
 *   RECEIVED -> VALIDATED -> [privacy scan + policy evaluation] -> ...
 *
 *     policy BLOCK            -> BLOCKED (terminal)
 *     policy REQUIRE_APPROVAL -> APPROVAL_REQUIRED (paused, waiting on a human)
 *     policy ALLOW/MASK/ROUTE -> ROUTING -> PROVIDER_CALL -> COMPLETED | FAILED
 *
 * `APPROVAL_REQUIRED` resumes into the same `ROUTING -> PROVIDER_CALL
 * -> COMPLETED | FAILED` branch once approved (`AiRequestsService
 * .resumeAfterApproval`), or terminates at `BLOCKED` if rejected.
 */
export const AI_REQUEST_STATUSES = [
  "RECEIVED",
  "VALIDATED",
  "ROUTING",
  "PROVIDER_CALL",
  "COMPLETED",
  "FAILED",
  "BLOCKED",
  "APPROVAL_REQUIRED",
] as const;

export type AIRequestStatus = (typeof AI_REQUEST_STATUSES)[number];

export function isAIRequestStatus(value: unknown): value is AIRequestStatus {
  return typeof value === "string" && (AI_REQUEST_STATUSES as readonly string[]).includes(value);
}
