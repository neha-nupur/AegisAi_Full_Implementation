import { randomUUID } from "node:crypto";
import type {
  Approval,
  ApprovalsRepository,
  ApprovalStatus,
  CreateApprovalRow,
  DecideApprovalRow,
} from "../../src/repositories/approvals.repository";

export class InMemoryApprovalsRepository implements ApprovalsRepository {
  private readonly rows = new Map<string, Approval>();

  async create(input: CreateApprovalRow): Promise<Approval> {
    const now = new Date().toISOString();
    const approval: Approval = {
      id: randomUUID(),
      organizationId: input.organizationId,
      aiRequestId: input.aiRequestId,
      policyId: input.policyId,
      matchedRuleId: input.matchedRuleId,
      requesterId: input.requesterId,
      reason: input.reason,
      status: "PENDING",
      decidedBy: null,
      decisionReason: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(approval.id, approval);
    return approval;
  }

  async findById(id: string): Promise<Approval | null> {
    return this.rows.get(id) ?? null;
  }

  async listByOrganization(organizationId: string, status?: ApprovalStatus): Promise<Approval[]> {
    return [...this.rows.values()].filter((a) => a.organizationId === organizationId && (!status || a.status === status));
  }

  async decide(id: string, patch: DecideApprovalRow): Promise<Approval | null> {
    const existing = this.rows.get(id);
    if (!existing || existing.status !== "PENDING") return null;
    const updated: Approval = {
      ...existing,
      status: patch.status,
      decidedBy: patch.decidedBy,
      decisionReason: patch.decisionReason,
      decidedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return updated;
  }
}
