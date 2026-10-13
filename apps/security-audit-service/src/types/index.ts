export type SecurityEventSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RequestTrace {
  id: string; // Typically corresponds to the traceId generated at gateway
  aiRequestId: string;
  organizationId: string;
  requesterId: string;
  events: AuditEvent[];
  startedAt: string; // ISO8601
  completedAt: string | null; // ISO8601
}

export interface AuditEvent {
  id: string;
  traceId: string;
  aiRequestId: string;
  organizationId: string;
  eventType: string;
  metadata: Record<string, unknown>;
  timestamp: string; // ISO8601
}

export interface SecurityEvent {
  id: string;
  traceId: string;
  aiRequestId: string;
  organizationId: string;
  eventType: string;
  severity: SecurityEventSeverity;
  metadata: Record<string, unknown>;
  timestamp: string; // ISO8601
}

export interface CreateAuditEventInput {
  traceId: string;
  aiRequestId: string;
  organizationId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSecurityEventInput extends CreateAuditEventInput {
  severity: SecurityEventSeverity;
}

export interface TraceUpsertInput {
  traceId: string;
  aiRequestId: string;
  organizationId: string;
  requesterId: string;
  startedAt?: string;
  completedAt?: string;
}
