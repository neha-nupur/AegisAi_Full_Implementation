import { CorrelationId } from "@aegisai/shared-types";
import { Provider, Model, ProviderHealthStatus } from "../types";

export interface GenerateRequest {
  modelId: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  correlationId: CorrelationId;
}

export interface GenerateResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  providerResponseMetadata?: Record<string, any>;
}

export interface ProviderAdapter {
  /** Generate a response using the specified model. */
  generate(request: GenerateRequest, provider: Provider, model: Model): Promise<GenerateResponse>;
  
  /** Check the health of the provider API. */
  healthCheck(provider: Provider): Promise<ProviderHealthStatus>;
  
  /** Retrieve capabilities supported by this adapter. */
  getCapabilities(): string[];
}
