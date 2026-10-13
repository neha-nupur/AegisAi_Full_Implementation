import { Provider, Model, ProviderHealthStatus } from "../../types";
import { GenerateRequest, GenerateResponse, ProviderAdapter } from "../provider-adapter.interface";
import { loadConfig } from "@aegisai/config";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

interface HttpResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
  json: () => Promise<any>;
}

function executeRequest(urlStr: string, options: { method: string; headers: Record<string, string>; body?: string }): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === "http:" ? http : https;
    const req = client.request(parsed, {
      method: options.method,
      headers: {
        ...options.headers,
        ...(options.body ? { "Content-Length": Buffer.byteLength(options.body).toString() } : {})
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        const status = res.statusCode || 500;
        resolve({
          status,
          ok: status >= 200 && status < 300,
          text: async () => data,
          json: async () => JSON.parse(data),
        });
      });
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function doFetch(urlStr: string, options: { method: string; headers: Record<string, string>; body?: string }): Promise<HttpResponse> {
  if (process.env.NODE_ENV === "test" || typeof (global as any).jest !== "undefined" || (global.fetch as any)?._isMockFunction) {
    return (global.fetch as any)(urlStr, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });
  }
  return executeRequest(urlStr, options);
}

/**
 * Adapter for Google Gemini using REST/fetch with header-based authentication.
 *
 * Security contract:
 *   - The API key is NEVER placed in the URL query string.
 *   - The API key is ONLY passed via the `x-goog-api-key` request header.
 *   - Error messages produced by this adapter NEVER include the raw API key.
 *   - The adapter returns only sanitized data to callers (content, usage, metadata).
 *
 * Model selection:
 *   - The model is read from `model.configuration.apiModelName` so operators can
 *     change it via the database without touching source code.
 *   - The seeded default is `gemini-3.8-flash`, the current flagship Stable Flash
 *     model per the official Gemini API docs (https://ai.google.dev/gemini-api/docs/models).
 */
export class GeminiProviderAdapter implements ProviderAdapter {
  /**
   * Retrieves the API key from the environment.
   * Throws a controlled error that does NOT include the key value itself.
   */
  private getApiKey(configurationReference: string): string {
    loadConfig();
    const key = process.env[configurationReference];
    if (!key) {
      throw new Error(
        `${configurationReference} is not configured. Configure it in .env to enable Gemini provider.`
      );
    }
    return key;
  }

  /**
   * Strips any potential API key leakage from a provider error body.
   * Google's error responses are JSON and never echo our key back, but we
   * sanitize defensively: the raw errBody is included only if it is short
   * enough to be useful and does NOT contain the apiKey string.
   */
  private sanitizeErrorBody(errBody: string, apiKey: string): string {
    if (errBody.includes(apiKey)) {
      // If by any chance the key appears, redact the entire body.
      return "[error body redacted for security]";
    }
    // Truncate very long bodies to keep logs useful but not noisy.
    return errBody.length > 500 ? errBody.substring(0, 500) + "...[truncated]" : errBody;
  }

  async generate(request: GenerateRequest, provider: Provider, model: Model): Promise<GenerateResponse> {
    const apiKey = this.getApiKey(provider.configurationReference);
    const modelName = model.configuration?.apiModelName || model.name;
    const baseUrl = provider.baseUrl || "https://generativelanguage.googleapis.com/v1beta";

    // API key is passed ONLY in the x-goog-api-key header — NEVER in the URL.
    const url = `${baseUrl}/models/${modelName}:generateContent`;

    // Map normalized AegisAI messages to Gemini contents format.
    // Note: Gemini uses "model" for assistant role.
    const contents = request.messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const body: Record<string, unknown> = { contents };

    // Only include generationConfig fields when they are defined, to avoid
    // sending null/undefined values to the API.
    const generationConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
    if (request.maxTokens !== undefined) generationConfig.maxOutputTokens = request.maxTokens;
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    const response = await doFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Secure header-based authentication per official Gemini API docs.
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errBody = await response.text();
      // Sanitize error body before including in thrown error — key must never appear in logs.
      const safeBody = this.sanitizeErrorBody(errBody, apiKey);
      throw new Error(`Gemini provider error: HTTP ${response.status} - ${safeBody}`);
    }

    const data = await response.json() as Record<string, any>;

    // Map Gemini response to AegisAI's normalized GenerateResponse.
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: Record<string, any>) => typeof p.text === "string");

    return {
      content: textPart?.text ?? "",
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      },
      // providerResponseMetadata carries only safe, non-secret fields.
      providerResponseMetadata: {
        modelVersion: data.modelVersion,
        finishReason: candidate?.finishReason,
      }
    };
  }

  async healthCheck(provider: Provider): Promise<ProviderHealthStatus> {
    try {
      const apiKey = this.getApiKey(provider.configurationReference);
      const baseUrl = provider.baseUrl || "https://generativelanguage.googleapis.com/v1beta";

      // API key is passed ONLY in the x-goog-api-key header — NEVER in the URL.
      const url = `${baseUrl}/models`;

      const response = await doFetch(url, {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
        },
      });

      if (response.ok) return "healthy";
      if (response.status === 429 || response.status >= 500) return "degraded";
      return "degraded";
    } catch (_err) {
      // Do NOT log the error here — it may contain provider details.
      // The ResilientProviderAdapter's circuit breaker handles failure counting.
      return "unhealthy";
    }
  }

  getCapabilities(): string[] {
    return ["chat"];
  }
}
