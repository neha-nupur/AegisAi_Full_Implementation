import type { Pool, QueryResultRow } from "pg";
import { getPool } from "../db/pool";

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface Approval {
  id: string;
  organizationId: string;
  aiRequestId: string;
  policyId: string;
  matchedRuleId: string | null;
  requesterId: string;
  reason: string;
  status: ApprovalStatus;
  decidedBy: string | null;
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApprovalRow {
  organizationId: string;
  aiRequestId: string;
  policyId: string;
  matchedRuleId: string | null;
  requesterId: string;
  reason: string;
}

export interface DecideApprovalRow {
  status: "APPROVED" | "REJECTED";
  decidedBy: string;
  decisionReason: string | null;
}

export interface ApprovalsRepository {
  create(input: CreateApprovalRow): Promise<Approval>;
  findById(id: string): Promise<Approval | null>;
  listByOrganization(organizationId: string, status?: ApprovalStatus): Promise<Approval[]>;
  decide(id: string, patch: DecideApprovalRow): Promise<Approval | null>;
}

interface ApprovalRowDb extends QueryResultRow {
  id: string;
  organization_id: string;
  ai_request_id: string;
  policy_id: string;
  matched_rule_id: string | null;
  requester_id: string;
  reason: string;
  status: string;
  decided_by: string | null;
  decision_reason: string | null;
  decided_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toApproval(row: ApprovalRowDb): Approval {
  return {
    id: row.id,
    organizationId: row.organization_id,
    aiRequestId: row.ai_request_id,
    policyId: row.policy_id,
    matchedRuleId: row.matched_rule_id,
    requesterId: row.requester_id,
    reason: row.reason,
    status: row.status as ApprovalStatus,
    decidedBy: row.decided_by,
    decisionReason: row.decision_reason,
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS = `
  id, organization_id, ai_request_id, policy_id, matched_rule_id, requester_id, reason,
  status, decided_by, decision_reason, decided_at, created_at, updated_at
`;

export class PgApprovalsRepository implements ApprovalsRepository {
  private get pool(): Pool {
    return getPool();
  }

  async create(input: CreateApprovalRow): Promise<Approval> {
    const result = await this.pool.query<ApprovalRowDb>(
      `INSERT INTO approvals (organization_id, ai_request_id, policy_id, matched_rule_id, requester_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
      [input.organizationId, input.aiRequestId, input.policyId, input.matchedRuleId, input.requesterId, input.reason]
    );
    return toApproval(result.rows[0]);
  }

  async findById(id: string): Promise<Approval | null> {
    const result = await this.pool.query<ApprovalRowDb>(`SELECT ${SELECT_COLUMNS} FROM approvals WHERE id = $1`, [id]);
    return result.rows[0] ? toApproval(result.rows[0]) : null;
  }

  async listByOrganization(organizationId: string, status?: ApprovalStatus): Promise<Approval[]> {
    if (status) {
      const result = await this.pool.query<ApprovalRowDb>(
        `SELECT ${SELECT_COLUMNS} FROM approvals WHERE organization_id = $1 AND status = $2 ORDER BY created_at DESC`,
        [organizationId, status]
      );
      return result.rows.map(toApproval);
    }
    const result = await this.pool.query<ApprovalRowDb>(
      `SELECT ${SELECT_COLUMNS} FROM approvals WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    return result.rows.map(toApproval);
  }

  async decide(id: string, patch: DecideApprovalRow): Promise<Approval | null> {
    const result = await this.pool.query<ApprovalRowDb>(
      `UPDATE approvals
       SET status = $2, decided_by = $3, decision_reason = $4, decided_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING ${SELECT_COLUMNS}`,
      [id, patch.status, patch.decidedBy, patch.decisionReason]
    );
    return result.rows[0] ? toApproval(result.rows[0]) : null;
  }
}
