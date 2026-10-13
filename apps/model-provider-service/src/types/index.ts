/**
 * Model & Provider Management Service — local domain types.
 */

export type ProviderStatus = "active" | "inactive" | "deprecated";
export type ProviderHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";
export type ProviderType = "openai" | "gemini" | "anthropic" | "mock" | "azure" | "bedrock";

export interface Provider {
  id: string;
  organizationId?: string; // If null/undefined, it's a global system provider
  name: string;
  type: ProviderType;
  baseUrl: string;
  status: ProviderStatus;
  healthStatus: ProviderHealthStatus;
  priority: number;
  configurationReference: string; // Pointer to Secret/Config store, NOT the actual key
  createdAt: string;
  updatedAt: string;
}

export type SensitivityLevel = "low" | "medium" | "high" | "critical";

export interface CostMetadata {
  inputCostPer1k: number;
  outputCostPer1k: number;
  currency: string;
}

export interface Model {
  id: string;
  providerId: string;
  name: string;
  capabilities: string[]; // e.g. ["chat", "embeddings", "vision"]
  sensitivityLevel: SensitivityLevel;
  costMetadata: CostMetadata;
  active: boolean;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
