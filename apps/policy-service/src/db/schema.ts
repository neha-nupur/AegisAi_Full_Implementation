/**
 * Policy & Approval Service — PostgreSQL schema (Phase 4).
 * Owning service: policy-service. No other service may query these
 * tables directly (docs/database-ownership.md).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  rules JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT policies_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_policies_organization_id ON policies (organization_id);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  ai_request_id UUID NOT NULL,
  policy_id TEXT NOT NULL,
  matched_rule_id TEXT,
  requester_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  decided_by UUID,
  decision_reason TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT approvals_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_approvals_organization_id ON approvals (organization_id);
CREATE INDEX IF NOT EXISTS idx_approvals_ai_request_id ON approvals (ai_request_id);
`;
