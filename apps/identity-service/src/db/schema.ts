/**
 * Identity & Access Management Service — PostgreSQL schema.
 *
 * Owning service: identity-service (see docs/database-ownership.md).
 * No other service may create, alter, or query these tables directly
 * — cross-service access goes through `IdentityServiceContract`
 * (CLAUDE.md section 3).
 *
 * Kept as a plain exported string (rather than a `.sql` asset file)
 * so `tsc` ships it inside `dist/` without a separate asset-copy
 * step — `migrate.ts` runs it as-is against the pool.
 *
 * Idempotent: every statement uses `IF NOT EXISTS` so re-running the
 * migration is safe. There is no migration framework yet (no prior
 * schema to migrate *from*) — this is intentionally the simplest
 * thing that works for Phase 2; a real migration tool can replace
 * this if/when the schema needs versioned changes.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_unique UNIQUE (slug),
  CONSTRAINT organizations_status_check CHECK (status IN ('active', 'suspended'))
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_role_check CHECK (role IN ('ORGANIZATION_ADMIN', 'DEVELOPER', 'SECURITY_AUDITOR')),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- Mark all pre-existing users as verified so they are not locked out
UPDATE users SET email_verified = true WHERE email_verified = false AND verification_token_hash IS NULL;

CREATE TABLE IF NOT EXISTS service_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  credential_hash TEXT NOT NULL,
  credential_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_accounts_org_name_unique UNIQUE (organization_id, name),
  CONSTRAINT service_accounts_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_service_accounts_organization_id ON service_accounts (organization_id);

CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  default_model_preference TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  default_policy_name TEXT,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
  require_approval_for_sensitive BOOLEAN NOT NULL DEFAULT true,
  privacy_scanning_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_masking_enabled BOOLEAN NOT NULL DEFAULT false,
  request_timeout_ms INTEGER NOT NULL DEFAULT 30000,
  max_input_length INTEGER NOT NULL DEFAULT 8000,
  requests_per_minute INTEGER NOT NULL DEFAULT 100,
  audit_logging_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_settings_org_unique UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_settings_org_id ON organization_settings (organization_id);
`;

