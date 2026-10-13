import { Provider, Model, ProviderHealthStatus } from "../../types";
import { GenerateRequest, GenerateResponse, ProviderAdapter } from "../provider-adapter.interface";
import { loadConfig } from "@aegisai/config";

/**
 * Adapter for OpenAI.
 * Reads the actual API key from a configuration store / environment
 * using the provider's configurationReference to avoid storing it in DB.
 */
export class OpenAiProviderAdapter implements ProviderAdapter {
  private getApiKey(configurationReference: string): string {
    loadConfig(); // ensure config is loaded
    // In a real app this might call a Secret Manager using the reference.
    // For now we look it up in the env using the reference as the key name.
    const key = process.env[configurationReference];
    if (!key) {
      throw new Error(
        `${configurationReference} is not configured. Configure it in .env to enable OpenAI provider.`
      );
    }
    return key;
  }

  private sanitizeErrorBody(errBody: string, apiKey: string): string {
    if (errBody.includes(apiKey)) {
      return "[error body redacted for security]";
    }
    return errBody.length > 500 ? errBody.substring(0, 500) + "...[truncated]" : errBody;
  }

  async generate(request: GenerateRequest, provider: Provider, model: Model): Promise<GenerateResponse> {
    const apiKey = this.getApiKey(provider.configurationReference);
    const url = `${provider.baseUrl || "https://api.openai.com/v1"}/chat/completions`;

    const body = {
      model: model.configuration?.apiModelName || model.name,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "OpenAI-Organization": provider.organizationId || "" // If applicable
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errBody = await response.text();
      const safeBody = this.sanitizeErrorBody(errBody, apiKey);
      throw new Error(`OpenAI Provider error: ${response.status} - ${safeBody}`);
    }

    const data = await response.json() as any;

    return {
      content: data.choices?.[0]?.message?.content || "",
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      providerResponseMetadata: {
        id: data.id,
        system_fingerprint: data.system_fingerprint,
        model: data.model
      }
    };
  }

  async healthCheck(provider: Provider): Promise<ProviderHealthStatus> {
    try {
      const apiKey = this.getApiKey(provider.configurationReference);
      const url = `${provider.baseUrl || "https://api.openai.com/v1"}/models`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        return "healthy";
      } else {
        return "degraded";
      }
    } catch (err) {
      return "unhealthy";
    }
  }

  getCapabilities(): string[] {
    return ["chat"];
  }
}
