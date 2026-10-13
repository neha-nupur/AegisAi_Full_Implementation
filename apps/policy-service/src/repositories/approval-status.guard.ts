import { APPROVAL_STATUSES, type ApprovalStatus } from "./approvals.repository";

/** Type guard for the `?status=` query filter on `GET /v1/approvals`. */
export function isApprovalStatus(value: string): value is ApprovalStatus {
  return (APPROVAL_STATUSES as readonly string[]).includes(value);
}
