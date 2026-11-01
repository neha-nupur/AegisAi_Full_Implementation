import { SettingsService } from "../src/services/settings.service";
import type { SettingsAuditLogger, SettingsAuditEventInput } from "../src/interfaces/settings-audit-logger.interface";
import type { OrganizationSettings, UpdateSettingsInput } from "../src/types/settings.types";
import { DEFAULT_SETTINGS } from "../src/types/settings.types";
import type { PgSettingsRepository } from "../src/repositories/settings.repository";

describe("SettingsService", () => {
  let mockRepo: jest.Mocked<Partial<PgSettingsRepository>>;
  let recordedEvents: SettingsAuditEventInput[];
  let auditLogger: SettingsAuditLogger;

  const mockSettings: OrganizationSettings = {
    id: "settings-1",
    organizationId: "org-1",
    ...DEFAULT_SETTINGS,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    recordedEvents = [];
    auditLogger = {
      recordEvent: jest.fn(async (input: SettingsAuditEventInput) => {
        recordedEvents.push(input);
        return { id: "audit-1", ...input };
      }),
    };

    mockRepo = {
      getOrCreate: jest.fn().mockResolvedValue(mockSettings),
      update: jest.fn().mockImplementation(async (_orgId: string, patch: UpdateSettingsInput) => ({
        ...mockSettings,
        ...patch,
      })),
    };
  });

  it("retrieves settings via repository getOrCreate", async () => {
    const service = new SettingsService(mockRepo as PgSettingsRepository, auditLogger);
    const result = await service.get("org-1");

    expect(result).toEqual(mockSettings);
    expect(mockRepo.getOrCreate).toHaveBeenCalledWith("org-1");
  });

  it("updates settings and emits a SETTINGS_UPDATED audit event with changed fields", async () => {
    const service = new SettingsService(mockRepo as PgSettingsRepository, auditLogger);
    const patch: UpdateSettingsInput = {
      defaultModelPreference: "gpt-4o",
      sessionTimeoutMinutes: 30,
    };

    const updated = await service.update("org-1", "user-123", "trace-xyz", patch);

    expect(mockRepo.update).toHaveBeenCalledWith("org-1", patch);
    expect(updated.defaultModelPreference).toBe("gpt-4o");
    expect(updated.sessionTimeoutMinutes).toBe(30);

    expect(auditLogger.recordEvent).toHaveBeenCalledTimes(1);
    expect(recordedEvents).toHaveLength(1);
    expect(recordedEvents[0]).toEqual({
      traceId: "trace-xyz",
      aiRequestId: "none",
      organizationId: "org-1",
      eventType: "SETTINGS_UPDATED",
      metadata: {
        actor: "user-123",
        changedFields: ["defaultModelPreference", "sessionTimeoutMinutes"],
      },
    });
  });

  it("supports (auditLogger, repository) constructor order", async () => {
    const service = new SettingsService(auditLogger, mockRepo as PgSettingsRepository);
    const result = await service.get("org-1");
    expect(result).toEqual(mockSettings);
  });

  it("propagates errors when audit logger fails rather than silently ignoring", async () => {
    const failingLogger: SettingsAuditLogger = {
      recordEvent: jest.fn().mockRejectedValue(new Error("Audit logging failed")),
    };
    const service = new SettingsService(mockRepo as PgSettingsRepository, failingLogger);

    await expect(
      service.update("org-1", "user-123", "trace-xyz", { sessionTimeoutMinutes: 15 })
    ).rejects.toThrow("Audit logging failed");
  });
});
