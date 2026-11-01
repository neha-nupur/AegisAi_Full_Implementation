import { PgSettingsRepository } from "../repositories/settings.repository";
import type { OrganizationSettings, UpdateSettingsInput } from "../types/settings.types";
import type { SettingsAuditLogger } from "../interfaces/settings-audit-logger.interface";

export interface SettingsRepository {
  getOrCreate(organizationId: string): Promise<OrganizationSettings>;
  update(organizationId: string, patch: UpdateSettingsInput): Promise<OrganizationSettings>;
}

export class SettingsService {
  private readonly repository: SettingsRepository;
  private readonly auditService: SettingsAuditLogger;

  constructor(auditService: SettingsAuditLogger, repository?: SettingsRepository);
  constructor(repository: SettingsRepository | undefined, auditService: SettingsAuditLogger);
  constructor(
    first: SettingsAuditLogger | SettingsRepository | undefined,
    second?: SettingsRepository | SettingsAuditLogger
  ) {
    if (second) {
      if (typeof (second as SettingsAuditLogger).recordEvent === "function") {
        this.repository = (first as SettingsRepository) ?? new PgSettingsRepository();
        this.auditService = second as SettingsAuditLogger;
      } else {
        this.auditService = first as SettingsAuditLogger;
        this.repository = (second as SettingsRepository) ?? new PgSettingsRepository();
      }
    } else {
      this.auditService = first as SettingsAuditLogger;
      this.repository = new PgSettingsRepository();
    }
  }

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
