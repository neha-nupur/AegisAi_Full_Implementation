/** Organization-scoped operational settings. No secrets are stored here. */
export interface OrganizationSettings {
  id: string;
  organizationId: string;
  // General
  defaultModelPreference: string;
  defaultPolicyName: string | null;
  // Security
  sessionTimeoutMinutes: number;
  requireApprovalForSensitive: boolean;
  // Privacy
  privacyScanningEnabled: boolean;
  autoMaskingEnabled: boolean;
  // AI Gateway
  requestTimeoutMs: number;
  maxInputLength: number;
  // Rate Limiting
  requestsPerMinute: number;
  // Audit
  auditLoggingEnabled: boolean;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/** Partial settings payload for PATCH endpoint. */
export type UpdateSettingsInput = Partial<
  Omit<OrganizationSettings, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
>;

/** Default settings returned when no record exists yet. */
export const DEFAULT_SETTINGS: Omit<OrganizationSettings, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> = {
  defaultModelPreference: 'gemini-2.0-flash',
  defaultPolicyName: null,
  sessionTimeoutMinutes: 60,
  requireApprovalForSensitive: true,
  privacyScanningEnabled: true,
  autoMaskingEnabled: false,
  requestTimeoutMs: 30000,
  maxInputLength: 8000,
  requestsPerMinute: 100,
  auditLoggingEnabled: true,
};
