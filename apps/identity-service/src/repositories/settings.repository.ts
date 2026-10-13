import type { QueryResultRow } from "pg";
import { getPool } from "../db/pool";
import type { OrganizationSettings, UpdateSettingsInput } from "../types/settings.types";
import { DEFAULT_SETTINGS } from "../types/settings.types";

interface SettingsRow extends QueryResultRow {
  id: string;
  organization_id: string;
  default_model_preference: string;
  default_policy_name: string | null;
  session_timeout_minutes: number;
  require_approval_for_sensitive: boolean;
  privacy_scanning_enabled: boolean;
  auto_masking_enabled: boolean;
  request_timeout_ms: number;
  max_input_length: number;
  requests_per_minute: number;
  audit_logging_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

function toSettings(row: SettingsRow): OrganizationSettings {
  return {
    id: row.id,
    organizationId: row.organization_id,
    defaultModelPreference: row.default_model_preference,
    defaultPolicyName: row.default_policy_name,
    sessionTimeoutMinutes: row.session_timeout_minutes,
    requireApprovalForSensitive: row.require_approval_for_sensitive,
    privacyScanningEnabled: row.privacy_scanning_enabled,
    autoMaskingEnabled: row.auto_masking_enabled,
    requestTimeoutMs: row.request_timeout_ms,
    maxInputLength: row.max_input_length,
    requestsPerMinute: row.requests_per_minute,
    auditLoggingEnabled: row.audit_logging_enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Repository for organization_settings table (identity-service owns this table).
 * All queries are parameterized — no dynamic column names from user input.
 */
export class PgSettingsRepository {
  private get pool() {
    return getPool();
  }

  /**
   * Returns existing settings or creates and returns a new record with
   * safe defaults (idempotent — safe to call on every GET).
   */
  async getOrCreate(organizationId: string): Promise<OrganizationSettings> {
    // Try to get existing settings first
    const existing = await this.pool.query<SettingsRow>(
      `SELECT * FROM organization_settings WHERE organization_id = $1`,
      [organizationId]
    );

    if (existing.rows[0]) {
      return toSettings(existing.rows[0]);
    }

    // Create defaults on first access (idempotent via ON CONFLICT DO NOTHING)
    const d = DEFAULT_SETTINGS;
    const result = await this.pool.query<SettingsRow>(
      `INSERT INTO organization_settings
        (organization_id, default_model_preference, default_policy_name,
         session_timeout_minutes, require_approval_for_sensitive,
         privacy_scanning_enabled, auto_masking_enabled,
         request_timeout_ms, max_input_length, requests_per_minute, audit_logging_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (organization_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [
        organizationId,
        d.defaultModelPreference,
        d.defaultPolicyName,
        d.sessionTimeoutMinutes,
        d.requireApprovalForSensitive,
        d.privacyScanningEnabled,
        d.autoMaskingEnabled,
        d.requestTimeoutMs,
        d.maxInputLength,
        d.requestsPerMinute,
        d.auditLoggingEnabled,
      ]
    );

    return toSettings(result.rows[0]);
  }

  /** Patches only the provided fields. Returns updated settings. */
  async update(organizationId: string, patch: UpdateSettingsInput): Promise<OrganizationSettings> {
    // Build SET clause dynamically but safely (column names are hardcoded, not user-input)
    const FIELD_MAP: Record<keyof UpdateSettingsInput, string> = {
      defaultModelPreference: "default_model_preference",
      defaultPolicyName: "default_policy_name",
      sessionTimeoutMinutes: "session_timeout_minutes",
      requireApprovalForSensitive: "require_approval_for_sensitive",
      privacyScanningEnabled: "privacy_scanning_enabled",
      autoMaskingEnabled: "auto_masking_enabled",
      requestTimeoutMs: "request_timeout_ms",
      maxInputLength: "max_input_length",
      requestsPerMinute: "requests_per_minute",
      auditLoggingEnabled: "audit_logging_enabled",
    };

    const keys = Object.keys(patch) as (keyof UpdateSettingsInput)[];
    if (keys.length === 0) {
      // Nothing to update — return current
      return this.getOrCreate(organizationId);
    }

    const setClauses = keys.map((k, i) => `${FIELD_MAP[k]} = $${i + 2}`).join(", ");
    const values = keys.map((k) => patch[k]);

    const result = await this.pool.query<SettingsRow>(
      `UPDATE organization_settings
       SET ${setClauses}, updated_at = now()
       WHERE organization_id = $1
       RETURNING *`,
      [organizationId, ...values]
    );

    if (result.rows[0]) {
      return toSettings(result.rows[0]);
    }

    // If no row existed, create then update
    await this.getOrCreate(organizationId);
    return this.update(organizationId, patch);
  }
}
