/**
 * Consumer-defined interface (dependency inversion): policy-service
 * declares the shape it needs to notify *something* when a human
 * decides an approval, without depending on `apps/gateway-service`'s
 * package at all (that would be a circular workspace dependency,
 * since gateway-service already depends on policy-service to
 * evaluate policy). `apps/api` — the composition root — wires the
 * real implementation in, backed by gateway-service's
 * `AiRequestsService.resumeAfterApproval`. See
 * `docs/service-boundaries.md`'s Phase 4 section for the full
 * reasoning.
 */
export interface ApprovalResumeHandler {
  onApprovalDecided(aiRequestId: string, decision: "APPROVED" | "REJECTED", reason: string | null): Promise<void>;
}
