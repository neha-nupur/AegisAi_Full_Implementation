/**
 * AI Request Gateway Service — PostgreSQL schema.
 *
 * Owning service: gateway-service (see docs/database-ownership.md).
 * No other service may create, alter, or query this table directly.
 * Same idempotent, plain-string-SQL convention as
 * `apps/identity-service/src/db/schema.ts` — see that file for why
 * there is no migration framework yet.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  input TEXT NOT NULL,
  model_preference TEXT NOT NULL DEFAULT 'auto',
  policy_id TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  model_id TEXT,
  provider_id TEXT,
  trace_id TEXT NOT NULL,
  output TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_requests_status_check CHECK (
    status IN ('RECEIVED', 'VALIDATED', 'ROUTING', 'PROVIDER_CALL', 'COMPLETED', 'FAILED', 'BLOCKED', 'APPROVAL_REQUIRED')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_organization_id ON ai_requests (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_organization_created ON ai_requests (organization_id, created_at DESC);

-- Phase 4: widens the status check constraint for tables created by
-- Phase 3's migration (which only allowed the six original states).
-- Safe to run repeatedly: drops the constraint only if present, then
-- always recreates it with the current, wider set of valid statuses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_requests_status_check'
  ) THEN
    ALTER TABLE ai_requests DROP CONSTRAINT ai_requests_status_check;
  END IF;
  ALTER TABLE ai_requests ADD CONSTRAINT ai_requests_status_check CHECK (
    status IN ('RECEIVED', 'VALIDATED', 'ROUTING', 'PROVIDER_CALL', 'COMPLETED', 'FAILED', 'BLOCKED', 'APPROVAL_REQUIRED')
  );
END $$;
`;
