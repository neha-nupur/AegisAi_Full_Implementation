import { HttpError } from "@aegisai/shared-types";
import type { AuthenticatedPrincipal } from "@aegisai/identity-service";
import type { Approval, ApprovalsRepository, ApprovalStatus, CreateApprovalRow } from "../repositories/approvals.repository";
import type { ApprovalResumeHandler } from "./approval-resume-handler";

export class ApprovalsService {
  constructor(
    private readonly repository: ApprovalsRepository,
    private readonly resumeHandler?: ApprovalResumeHandler
  ) {}

  /** Called by `AiRequestsService` (in-process) when Policy's decision is REQUIRE_APPROVAL. */
  async create(input: CreateApprovalRow): Promise<Approval> {
    return this.repository.create(input);
  }

  async getById(id: string, actor: AuthenticatedPrincipal): Promise<Approval> {
    return this.findScoped(id, actor);
  }

  async list(actor: AuthenticatedPrincipal, status?: ApprovalStatus): Promise<Approval[]> {
    return this.repository.listByOrganization(actor.organizationId, status);
  }

  async approve(id: string, actor: AuthenticatedPrincipal, reason: string | null): Promise<Approval> {
    return this.decide(id, actor, "APPROVED", reason);
  }

  async reject(id: string, actor: AuthenticatedPrincipal, reason: string | null): Promise<Approval> {
    return this.decide(id, actor, "REJECTED", reason);
  }

  private async decide(id: string, actor: AuthenticatedPrincipal, status: "APPROVED" | "REJECTED", reason: string | null): Promise<Approval> {
    const approval = await this.findScoped(id, actor);
    if (approval.status !== "PENDING") {
      throw new HttpError(409, "APPROVAL_ALREADY_DECIDED", `This approval was already ${approval.status.toLowerCase()}.`);
    }

    const decided = await this.repository.decide(id, { status, decidedBy: actor.userId, decisionReason: reason });
    if (!decided) {
      // Lost a race with another decision between findScoped and decide — same conflict, reported the same way.
      throw new HttpError(409, "APPROVAL_ALREADY_DECIDED", "This approval was already decided.");
    }

    await this.resumeHandler?.onApprovalDecided(decided.aiRequestId, status, reason);
    return decided;
  }

  /** Same org-scoping convention as `PoliciesService`/`AiRequestsService`: an approval in another organization is 404, not 403. */
  private async findScoped(id: string, actor: AuthenticatedPrincipal): Promise<Approval> {
    const approval = await this.repository.findById(id);
    if (!approval || approval.organizationId !== actor.organizationId) {
      throw new HttpError(404, "APPROVAL_NOT_FOUND", "Approval not found.");
    }
    return approval;
  }
}
