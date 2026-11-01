/**
 * Minimal audit logger interface required by SettingsService.
 *
 * Structurally compatible with `AuditService.recordEvent` from
 * `@aegisai/security-audit-service`, but decoupled so identity-service
 * does not depend on security-audit-service.
 */
export interface SettingsAuditEventInput {
  traceId: string;
  aiRequestId: string;
  organizationId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}

export interface SettingsAuditLogger {
  recordEvent(input: SettingsAuditEventInput): Promise<unknown>;
}

