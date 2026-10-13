import { OpenAiProviderAdapter } from "../src/services/adapters/openai.provider";
import { Provider, Model } from "../src/types";
import { GenerateRequest } from "../src/services/provider-adapter.interface";

describe("OpenAiProviderAdapter", () => {
  let adapter: OpenAiProviderAdapter;
  let provider: Provider;
  let model: Model;
  let request: GenerateRequest;

  beforeEach(() => {
    process.env.PORT = "4000";
    process.env.DATABASE_URL = "postgres://dummy";
    process.env.MONGODB_URL = "mongodb://dummy";
    process.env.REDIS_URL = "redis://dummy";
    process.env.JWT_SECRET = "dummy";
    process.env.CORS_ORIGINS = "dummy";

    adapter = new OpenAiProviderAdapter();

    provider = {
      id: "test-openai-provider",
      name: "OpenAI",
      type: "openai",
      status: "active",
      healthStatus: "healthy",
      priority: 1,
      configurationReference: "OPENAI_API_KEY",
      baseUrl: "https://api.openai.com/v1",
      createdAt: "",
      updatedAt: ""
    };

    model = {
      id: "test-openai-model",
      name: "gpt-3.5-turbo",
      providerId: "test-openai-provider",
      active: true,
      capabilities: ["chat"],
      sensitivityLevel: "low",
      costMetadata: { inputCostPer1k: 0, outputCostPer1k: 0, currency: "USD" },
      configuration: { apiModelName: "gpt-3.5-turbo" },
      createdAt: "",
      updatedAt: ""
    };

    request = {
      modelId: "test-openai-model",
      messages: [{ role: "user", content: "Explain binary search." }],
      correlationId: "test-trace"
    };

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("missing API key throws controlled error", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(adapter.generate(request, provider, model))
      .rejects.toThrow("OPENAI_API_KEY is not configured. Configure it in .env to enable OpenAI provider.");
  });

  test("successful API call sends normalized request and returns normalized response", async () => {
    process.env.OPENAI_API_KEY = "test-fake-key";
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677652288,
        model: "gpt-3.5-turbo",
        system_fingerprint: "fp_44709d6fcb",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "Binary search is an algorithm..."
          },
          logprobs: null,
          finish_reason: "stop"
        }],
        usage: {
          prompt_tokens: 9,
          completion_tokens: 12,
          total_tokens: 21
        }
      })
    });

    const res = await adapter.generate(request, provider, model);

    // Verify fetch was called correctly
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer test-fake-key",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "Explain binary search." }]
        })
      })
    );

    // Verify normalized response
    expect(res.content).toBe("Binary search is an algorithm...");
    expect(res.usage?.promptTokens).toBe(9);
    expect(res.providerResponseMetadata?.id).toBe("chatcmpl-123");
    
    // Verify API key is NOT exposed in response metadata
    expect(JSON.stringify(res)).not.toContain("test-fake-key");
  });

  test("provider failure throws error", async () => {
    process.env.OPENAI_API_KEY = "test-fake-key";
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "Invalid API key" } })
    });

    await expect(adapter.generate(request, provider, model))
      .rejects.toThrow(/OpenAI Provider error: 401/);
  });
});
