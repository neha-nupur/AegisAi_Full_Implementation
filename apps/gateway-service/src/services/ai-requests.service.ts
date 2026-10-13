import { HttpError } from "@aegisai/shared-types";
import type { AuthenticatedPrincipal } from "@aegisai/identity-service";
import { PrivacyScanService, type Finding, type FindingType, type ScanResult } from "@aegisai/privacy-service";
import { PolicyEvaluationService, PgPoliciesRepository } from "@aegisai/policy-service";
import type { AiRequestsRepository } from "../repositories/ai-requests.repository";
import type { AIRequest, CreateAIRequestInput } from "../types";
import { 
  ModelRouterService, 
  ProviderRepository, 
  ModelRepository, 
  ProviderAdapterFactory, 
  PgProviderRepository, 
  PgModelRepository,
  type SensitivityLevel,
} from "@aegisai/model-provider-service";
import type { AuditService } from "@aegisai/security-audit-service";

/**
 * Minimal structural logger interface (satisfied by Pino's `Logger`,
 * among others) — kept local rather than importing the `pino` type so
 * this service does not need `pino` as a dependency just for typing.
 */
export interface AuditLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
}

/**
 * Consumer-defined interface (dependency inversion, same pattern as
 * policy-service's `ApprovalResumeHandler`): `AiRequestsService` needs
 * to create an `Approval` record when Policy's decision is
 * REQUIRE_APPROVAL, without gateway-service importing
 * `ApprovalsService`'s concrete class at construction time — see
 * `setApprovalCreator` below for why (construction-order: the real
 * `ApprovalsService` needs *this* service already constructed, to
 * wire as its own resume handler — apps/api ties the knot after both
 * exist).
 */
export interface ApprovalCreator {
  create(input: {
    organizationId: string;
    aiRequestId: string;
    policyId: string;
    matchedRuleId: string | null;
    requesterId: string;
    reason: string;
  }): Promise<{ id: string }>;
}

/**
 * Orchestrates the full request flow:
 *
 *   RECEIVED -> VALIDATED -> Privacy Scan -> Policy Evaluation -> {
 *     BLOCK            -> BLOCKED (terminal)
 *     REQUIRE_APPROVAL -> APPROVAL_REQUIRED (paused; resumes via `resumeAfterApproval`)
 *     ALLOW/MASK/ROUTE -> ROUTING -> PROVIDER_CALL -> COMPLETED | FAILED
 *   }
 *
 * Design choice (Phase 3, unchanged): **synchronous**. The HTTP
 * response for `POST /v1/ai-requests` is not sent until the request
 * reaches a stable state — a terminal one (`COMPLETED`/`FAILED`/
 * `BLOCKED`) or a paused one (`APPROVAL_REQUIRED`).
 *
 * Audit trail (Phase 3, unchanged): structured Pino log events per
 * transition, standing in for Phase 8's real
 * `security-audit-service` persistence.
 */
export class AiRequestsService {
  /**
   * Not constructor-injected — see `ApprovalCreator`'s doc comment
   * for why. `apps/api` calls `setApprovalCreator` once both this
   * service and policy-service's `ApprovalsService` exist.
   */
  private approvalCreator?: ApprovalCreator;

  constructor(
    private readonly repository: AiRequestsRepository,
    private readonly modelRouter: ModelRouterService = new ModelRouterService(),
    private readonly providerRepository: ProviderRepository = new PgProviderRepository(),
    private readonly modelRepository: ModelRepository = new PgModelRepository(),
    private readonly providerFactory: ProviderAdapterFactory = new ProviderAdapterFactory(),
    private readonly logger?: AuditLogger,
    private readonly privacyScanService: PrivacyScanService = new PrivacyScanService(),
    private readonly policyEvaluationService: PolicyEvaluationService = new PolicyEvaluationService(new PgPoliciesRepository()),
    private readonly auditService?: AuditService
  ) {}

  setApprovalCreator(approvalCreator: ApprovalCreator): void {
    this.approvalCreator = approvalCreator;
  }

  async submit(input: unknown, actor: AuthenticatedPrincipal, correlationId: string): Promise<AIRequest> {
    const validated = input as CreateAIRequestInput;
    const traceId = correlationId;

    let request = await this.repository.create({
      organizationId: actor.organizationId,
      requesterId: actor.userId,
      input: validated.input,
      modelPreference: validated.modelPreference ?? "auto",
      policyId: validated.policyId ?? null,
      traceId,
    });
    this.audit(request, "REQUEST_RECEIVED");

    request = await this.transition(request, "VALIDATED");
    this.audit(request, "REQUEST_VALIDATED");

    // --- Privacy Scan -------------------------------------------------
    const scanResult = await this.privacyScanService.scanAndRecord({
      organizationId: request.organizationId,
      aiRequestId: request.id,
      text: request.input,
    });
    const findingTypes = [...new Set(scanResult.findings.map((f: Finding) => f.type))];
    this.audit(request, "PRIVACY_SCAN_COMPLETED", { detected: scanResult.detected, findingTypes });

    // --- Policy Evaluation ---------------------------------------------
    const decision = await this.policyEvaluationService.evaluate({
      organizationId: request.organizationId,
      policyId: request.policyId,
      requesterRole: actor.role,
      findingTypes,
      modelPreference: request.modelPreference,
    });
    this.audit(request, "POLICY_EVALUATED", {
      action: decision.action,
      policyId: decision.policyId,
      matchedRuleId: decision.matchedRuleId,
    });

    if (decision.action === "BLOCK") {
      const blocked = await this.repository.update(request.id, { status: "BLOCKED", errorMessage: decision.reason });
      this.audit(blocked ?? request, "POLICY_BLOCK");
      throw new HttpError(403, "POLICY_BLOCK", "This request was blocked by policy.", {
        aiRequestId: request.id,
        traceId,
        reason: decision.reason,
      });
    }

    if (decision.action === "REQUIRE_APPROVAL") {
      const paused = await this.repository.update(request.id, { status: "APPROVAL_REQUIRED" });
      const approval = await this.approvalCreator?.create({
        organizationId: request.organizationId,
        aiRequestId: request.id,
        policyId: decision.policyId ?? "policy_default",
        matchedRuleId: decision.matchedRuleId,
        requesterId: request.requesterId,
        reason: decision.reason,
      });
      this.audit(paused ?? request, "APPROVAL_REQUIRED", { approvalId: approval?.id });
      return paused ?? request;
    }

    // ALLOW, MASK, or ROUTE (Phase 5 will give ROUTE real behavior;
    // for now it proceeds exactly like ALLOW — see PolicyRuleCondition's doc comment).
    const effectiveInput = decision.action === "MASK" ? this.privacyScanService.redact(request.input, scanResult.findings) : request.input;
    if (decision.action === "MASK") {
      this.audit(request, "REQUEST_MASKED");
    }

    const result = await this.runProviderPipeline(request, effectiveInput, scanResult);
    if (result.status === "FAILED") {
      throw new HttpError(502, "PROVIDER_FAILURE", "The AI provider failed to process this request.", {
        aiRequestId: request.id,
        traceId,
      });
    }
    return result;
  }

  /**
   * Resumes a request left in `APPROVAL_REQUIRED` once a human
   * decides it (`ApprovalsService.approve`/`.reject`, via the
   * `ApprovalResumeHandler` `apps/api` wires to this method). Called
   * from the approve/reject HTTP request, not the original
   * `POST /v1/ai-requests` one — so unlike `submit`, this never
   * throws on provider failure; it persists the outcome and returns.
   * Idempotent: a request already resolved (resumed twice, or
   * resumed after some other path already moved it on) is a silent
   * no-op rather than an error, since this is an internal callback,
   * not a user-facing request the caller can retry differently.
   *
   * Phase 12.2: Re-runs privacy masking before calling the provider,
   * ensuring approved requests still have PII masked (policy remains
   * enforced even after human approval).
   */
  async resumeAfterApproval(aiRequestId: string, decision: "APPROVED" | "REJECTED", reason: string | null): Promise<void> {
    const request = await this.repository.findById(aiRequestId);
    if (!request || request.status !== "APPROVAL_REQUIRED") {
      return;
    }

    if (decision === "REJECTED") {
      const blocked = await this.repository.update(request.id, {
        status: "BLOCKED",
        errorMessage: reason ?? "Rejected by approver.",
      });
      this.audit(blocked ?? request, "APPROVAL_REJECTED");
      return;
    }

    this.audit(request, "APPROVAL_GRANTED");

    // Re-scan and re-mask: privacy constraints must remain enforced even
    // after approval. The approver reviewed the request, not the raw PII.
    const reScanResult = await this.privacyScanService.scanAndRecord({
      organizationId: request.organizationId,
      aiRequestId: request.id,
      text: request.input,
    });
    const effectiveInput = reScanResult.detected
      ? this.privacyScanService.redact(request.input, reScanResult.findings)
      : request.input;

    if (reScanResult.detected) {
      this.audit(request, "REQUEST_MASKED", { reason: "re-masked on approval resume" });
    }

    await this.runProviderPipeline(request, effectiveInput, reScanResult);
  }

  async getById(id: string, actor: AuthenticatedPrincipal): Promise<AIRequest> {
    const request = await this.findScoped(id, actor);
    return request;
  }

  async list(actor: AuthenticatedPrincipal, limit?: number, cursor?: string): Promise<{ items: AIRequest[]; nextCursor: string | null }> {
    return this.repository.listByOrganization(actor.organizationId, limit, cursor);
  }

  /** Scoped like `UsersService.findScoped` in identity-service: a request in another organization is 404, not 403 (see docs/api-conventions.md). */
  private async findScoped(id: string, actor: AuthenticatedPrincipal): Promise<AIRequest> {
    const request = await this.repository.findById(id);
    if (!request || request.organizationId !== actor.organizationId) {
      throw new HttpError(404, "AI_REQUEST_NOT_FOUND", "AI request not found.");
    }
    return request;
  }

  private async transition(request: AIRequest, status: AIRequest["status"]): Promise<AIRequest> {
    const updated = await this.repository.update(request.id, { status });
    if (!updated) {
      throw new HttpError(500, "INTERNAL_ERROR", "AI request disappeared during processing.");
    }
    return updated;
  }

  /** `ROUTING -> PROVIDER_CALL -> COMPLETED | FAILED`. Never throws — provider failures are persisted as `FAILED` and returned, not thrown; callers decide whether that should become an HTTP error (`submit` does, `resumeAfterApproval` does not). */
  private async runProviderPipeline(request: AIRequest, effectiveInput: string, scanResult: ScanResult): Promise<AIRequest> {
    let current = await this.transition(request, "ROUTING");

    // --- Dynamic Routing: derive sensitivity and complexity from privacy scan ---
    const sensitivityLevel = deriveSensitivityLevel(scanResult.findings.map((f: Finding) => f.type));
    const complexity = deriveComplexity(request.input, scanResult.findings.length);
    const modelPreferenceOverrideAttempted = request.modelPreference !== "auto" && request.modelPreference !== "";

    this.audit(current, "MODEL_ROUTING_STARTED", {
      sensitivityLevel,
      complexity,
      modelPreference: request.modelPreference,
    });

    const allProviders = await this.providerRepository.listAll();
    const allModels = await this.modelRepository.listAll();

    const routingResult = this.modelRouter.route({
      organizationId: request.organizationId,
      capabilitiesRequired: ["chat"],
      sensitivityLevel,
      complexity,
      modelPreference: request.modelPreference,
    }, allProviders, allModels);

    const normalizedPref = request.modelPreference?.toLowerCase().trim() || "";
    const apiModelName = (routingResult.selectedModel?.configuration as any)?.apiModelName?.toLowerCase() || "";
    const selectedName = routingResult.selectedModel?.name.toLowerCase() || "";
    
    const modelPreferenceOverridden = modelPreferenceOverrideAttempted &&
      routingResult.selectedModel !== null &&
      selectedName !== normalizedPref && 
      apiModelName !== normalizedPref;

    if (routingResult.blocked || !routingResult.selectedProvider || !routingResult.selectedModel) {
      const blocked = await this.repository.update(current.id, { status: "BLOCKED", errorMessage: routingResult.routingReason });
      this.audit(blocked ?? current, "ROUTING_BLOCK", {
        reason: routingResult.routingReason,
        sensitivityLevel,
        complexity,
      });
      throw new HttpError(403, "ROUTING_BLOCK", routingResult.routingReason, {
        aiRequestId: request.id,
        traceId: request.traceId,
      });
    }

    current = await this.transition(current, "PROVIDER_CALL");
    this.audit(current, "PROVIDER_CALL_STARTED", {
      providerId: routingResult.selectedProvider.id,
      providerName: routingResult.selectedProvider.name,
      modelId: routingResult.selectedModel.id,
      modelName: routingResult.selectedModel.name,
      sensitivityLevel,
      complexity,
      routingReason: routingResult.routingReason,
      modelPreferenceOverridden,
    });

    try {
      const adapter = this.providerFactory.getAdapter(routingResult.selectedProvider.type);
      
      const result = await adapter.generate({
        modelId: routingResult.selectedModel.id,
        messages: [{ role: "user", content: effectiveInput }],
        correlationId: request.traceId
      }, routingResult.selectedProvider, routingResult.selectedModel);

      const completed = await this.repository.update(current.id, {
        status: "COMPLETED",
        modelId: routingResult.selectedModel.id,
        providerId: routingResult.selectedProvider.id,
        output: result.content,
      });
      if (!completed) {
        throw new HttpError(500, "INTERNAL_ERROR", "AI request disappeared during processing.");
      }
      this.audit(completed, "REQUEST_COMPLETED", {
        modelId: routingResult.selectedModel.id,
        modelName: routingResult.selectedModel.name,
        providerId: routingResult.selectedProvider.id,
        providerName: routingResult.selectedProvider.name,
        sensitivityLevel,
        complexity,
        modelPreferenceOverridden,
        ...((result as any).resilience ? { resilience: (result as any).resilience } : {})
      });
      return completed;
    } catch (err) {
      const providerId = routingResult.selectedProvider.id;
      const message = err instanceof Error ? err.message : "Unknown provider error.";
      
      const resilience = err instanceof HttpError && err.details?.resilience ? err.details.resilience : undefined;

      const failed = await this.repository.update(current.id, { status: "FAILED", providerId, errorMessage: message });
      this.audit(failed ?? current, "REQUEST_FAILED", { 
        providerId, 
        reason: message, 
        sensitivityLevel,
        ...(resilience ? { resilience } : {})
      });
      return failed ?? current;
    }
  }

  private audit(request: AIRequest, eventType: string, metadata: Record<string, unknown> = {}): void {
    this.logger?.info(
      {
        eventType,
        aiRequestId: request.id,
        traceId: request.traceId,
        organizationId: request.organizationId,
        requesterId: request.requesterId,
        status: request.status,
        ...metadata,
      },
      `ai-request:${eventType}`
    );

    if (this.auditService) {
      this.auditService.recordEvent({
        traceId: request.traceId,
        aiRequestId: request.id,
        organizationId: request.organizationId,
        eventType,
        metadata
      }).catch((e: unknown) => console.error("Failed to record audit event", e));

      this.auditService.upsertTrace({
        traceId: request.traceId,
        aiRequestId: request.id,
        organizationId: request.organizationId,
        requesterId: request.requesterId,
        startedAt: eventType === "REQUEST_RECEIVED" ? new Date().toISOString() : undefined,
        completedAt: ["COMPLETED", "FAILED", "BLOCKED"].includes(request.status) ? new Date().toISOString() : undefined
      }).catch((e: unknown) => console.error("Failed to upsert trace", e));

      if (eventType === "PRIVACY_SCAN_COMPLETED" && metadata.detected) {
        this.auditService.recordSecurityEvent({
          traceId: request.traceId,
          aiRequestId: request.id,
          organizationId: request.organizationId,
          eventType: "PII_DETECTED",
          severity: "MEDIUM",
          metadata
        }).catch((e: unknown) => console.error("Failed to record security event", e));
      }

      if (eventType === "POLICY_BLOCK" || eventType === "ROUTING_BLOCK") {
        this.auditService.recordSecurityEvent({
          traceId: request.traceId,
          aiRequestId: request.id,
          organizationId: request.organizationId,
          eventType: "POLICY_BLOCK",
          severity: "HIGH",
          metadata
        }).catch((e: unknown) => console.error("Failed to record security event", e));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 12.1: Dynamic routing helpers
// ---------------------------------------------------------------------------

/**
 * Maps privacy finding types to a routing sensitivity level.
 * The model router uses this to ensure the selected model is approved
 * for the detected sensitivity (e.g. credentials must not go to a
 * public "low" model — only "high"+ models may handle them).
 *
 * Taxonomy (matches `SensitivityLevel` in model-provider-service):
 *   low      — no findings
 *   medium   — PII (email, phone, national IDs) or sensitive keywords
 *   high     — credentials (API keys, passwords)
 *   critical — not yet auto-derived; reserved for future classification
 */
export function deriveSensitivityLevel(findingTypes: FindingType[]): SensitivityLevel {
  if (findingTypes.length === 0) return "low";
  if (findingTypes.some(t => t === "API_KEY" || t === "PASSWORD")) return "high";
  // EMAIL, PHONE, PAN, AADHAAR, SENSITIVE_KEYWORD → medium
  return "medium";
}

/**
 * Derives request complexity as a routing hint for model selection.
 * Complex requests are routed to more capable (typically higher-cost)
 * models; simple requests to cheaper ones — balancing quality and cost.
 *
 * Heuristic (deterministic, explainable — no ML needed):
 *   complex — long input (> 500 chars) OR many privacy findings (> 3)
 *   simple  — everything else
 */
export function deriveComplexity(inputText: string, findingCount: number): "simple" | "complex" {
  if (inputText.length > 500 || findingCount > 3) return "complex";
  return "simple";
}

