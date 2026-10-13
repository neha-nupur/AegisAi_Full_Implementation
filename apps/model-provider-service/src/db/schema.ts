export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  health_status TEXT NOT NULL DEFAULT 'unknown',
  priority INTEGER NOT NULL DEFAULT 1,
  configuration_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT providers_status_check CHECK (status IN ('active', 'inactive', 'deprecated')),
  CONSTRAINT providers_health_status_check CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_providers_organization_id ON providers (organization_id);

CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  sensitivity_level TEXT NOT NULL,
  cost_metadata JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  configuration JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT models_sensitivity_check CHECK (sensitivity_level IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_models_provider_id ON models (provider_id);
`;
