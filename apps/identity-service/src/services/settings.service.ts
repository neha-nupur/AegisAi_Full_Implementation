import { PgSettingsRepository } from "../repositories/settings.repository";
import { AuditService } from "@aegisai/security-audit-service";
import type { OrganizationSettings, UpdateSettingsInput } from "../types/settings.types";

export class SettingsService {
  constructor(
    private readonly repository: PgSettingsRepository = new PgSettingsRepository(),
    private readonly auditService: AuditService = new AuditService()
  ) {}

  /** Get settings for organization, creating defaults on first call (idempotent). */
  async get(organizationId: string): Promise<OrganizationSettings> {
    return this.repository.getOrCreate(organizationId);
  }

  /**
   * Patch organization settings. Only ORGANIZATION_ADMIN can call this.
   * RBAC is enforced at the route level (requirePermission).
   * Records a SETTINGS_UPDATED audit event with changed field names but NO values.
   */
  async update(
    organizationId: string,
    actorId: string,
    correlationId: string,
    patch: UpdateSettingsInput
  ): Promise<OrganizationSettings> {
    const updated = await this.repository.update(organizationId, patch);

    // Audit the settings change — record which fields changed, not their values
    const changedFields = Object.keys(patch);
    await this.auditService.recordEvent({
      traceId: correlationId,
      aiRequestId: "none",
      organizationId,
      eventType: "SETTINGS_UPDATED",
      metadata: {
        actor: actorId,
        changedFields,
        // Never record actual values — just the field names that changed
      },
    });

    return updated;
  }
}
