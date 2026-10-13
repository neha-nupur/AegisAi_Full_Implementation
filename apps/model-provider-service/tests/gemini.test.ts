/**
 * gemini.test.ts — Security-hardened test suite for GeminiProviderAdapter.
 *
 * This suite verifies:
 *   1. Missing GEMINI_API_KEY fails safely (controlled error, no leak).
 *   2. API key is sent ONLY in the x-goog-api-key header.
 *   3. API key does NOT appear in the constructed URL.
 *   4. API key does NOT appear in the request body.
 *   5. API key does NOT appear in the normalized response.
 *   6. Error messages do NOT expose the raw API key.
 *   7. model.configuration.apiModelName controls which model is called.
 *   8. Malformed Gemini response returns empty content without crashing.
 *   9. Successful response maps usage and metadata correctly.
 */

import { GeminiProviderAdapter } from "../src/services/adapters/gemini.provider";
import { Provider, Model } from "../src/types";
import { GenerateRequest } from "../src/services/provider-adapter.interface";

// ---------------------------------------------------------------------------
// Environment setup — mirrors what is required by @aegisai/config validation
// ---------------------------------------------------------------------------
beforeAll(() => {
  process.env.PORT = "4000";
  process.env.DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy";
  process.env.MONGODB_URL = "mongodb://dummy:27017/dummy";
  process.env.REDIS_URL = "redis://dummy:6379";
  process.env.JWT_SECRET = "dummy-jwt-secret-for-tests";
  process.env.CORS_ORIGINS = "http://localhost:5173";
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const FAKE_API_KEY = "test-fake-gemini-key-SHOULD-NOT-APPEAR-IN-OUTPUTS";
const CONFIGURED_MODEL = "gemini-3.8-flash";

function makeProvider(): Provider {
  return {
    id: "test-gemini-provider",
    name: "gemini-provider",
    type: "gemini",
    status: "active",
    healthStatus: "healthy",
    priority: 3,
    configurationReference: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    createdAt: "",
    updatedAt: "",
  };
}

function makeModel(apiModelName = CONFIGURED_MODEL): Model {
  return {
    id: "test-gemini-model",
    name: apiModelName,
    providerId: "test-gemini-provider",
    active: true,
    capabilities: ["chat"],
    sensitivityLevel: "low",
    costMetadata: { inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, currency: "USD" },
    configuration: { apiModelName },
    createdAt: "",
    updatedAt: "",
  };
}

function makeRequest(): GenerateRequest {
  return {
    modelId: "test-gemini-model",
    messages: [{ role: "user", content: "Explain binary search." }],
    correlationId: "test-trace-001",
  };
}

function makeGeminiSuccessResponse(text = "Binary search is an O(log n) algorithm.") {
  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
          role: "model",
        },
        finishReason: "STOP",
        index: 0,
        safetyRatings: [],
      },
    ],
    usageMetadata: {
      promptTokenCount: 9,
      candidatesTokenCount: 12,
      totalTokenCount: 21,
    },
    modelVersion: CONFIGURED_MODEL,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GeminiProviderAdapter — Security & Correctness", () => {
  let adapter: GeminiProviderAdapter;
  let capturedFetchArgs: { url: string; init: RequestInit }[];

  beforeEach(() => {
    adapter = new GeminiProviderAdapter();
    capturedFetchArgs = [];

    // Default: key not set. Individual tests set it when needed.
    delete process.env.GEMINI_API_KEY;

    global.fetch = jest.fn().mockImplementation(
      async (url: string, init: RequestInit) => {
        capturedFetchArgs.push({ url, init });
        // Default mock response — individual tests can override.
        return {
          ok: true,
          json: async () => makeGeminiSuccessResponse(),
          text: async () => JSON.stringify(makeGeminiSuccessResponse()),
        };
      }
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1 — Missing API key fails safely
  // -------------------------------------------------------------------------
  test("1. Missing GEMINI_API_KEY throws a controlled error that does not leak secrets", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(adapter.generate(makeRequest(), makeProvider(), makeModel()))
      .rejects.toThrow(/GEMINI_API_KEY is not configured/i);

    // No fetch call must have been made — fail before any network I/O.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 2 — API key is sent ONLY in x-goog-api-key header
  // -------------------------------------------------------------------------
  test("2. Successful request sends API key ONLY in x-goog-api-key header", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    await adapter.generate(makeRequest(), makeProvider(), makeModel());

    expect(capturedFetchArgs).toHaveLength(1);
    const { init } = capturedFetchArgs[0];
    const headers = init.headers as Record<string, string>;

    expect(headers["x-goog-api-key"]).toBe(FAKE_API_KEY);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  // -------------------------------------------------------------------------
  // Test 3 — API key does NOT appear in the URL
  // -------------------------------------------------------------------------
  test("3. The request URL does NOT contain the API key", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    await adapter.generate(makeRequest(), makeProvider(), makeModel());

    const { url } = capturedFetchArgs[0];
    expect(url).not.toContain(FAKE_API_KEY);
    expect(url).not.toContain("key=");
    // URL should only contain the model name and endpoint
    expect(url).toContain(`/models/${CONFIGURED_MODEL}:generateContent`);
    expect(url).not.toContain("?");
  });

  // -------------------------------------------------------------------------
  // Test 4 — API key does NOT appear in the request body
  // -------------------------------------------------------------------------
  test("4. The request body does NOT contain the API key", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    await adapter.generate(makeRequest(), makeProvider(), makeModel());

    const { init } = capturedFetchArgs[0];
    const bodyStr = init.body as string;

    expect(bodyStr).not.toContain(FAKE_API_KEY);
    // Verify body has expected structure instead
    const bodyObj = JSON.parse(bodyStr);
    expect(bodyObj).toHaveProperty("contents");
    expect(bodyObj.contents[0].parts[0].text).toBe("Explain binary search.");
  });

  // -------------------------------------------------------------------------
  // Test 5 — Response/metadata does NOT contain the API key
  // -------------------------------------------------------------------------
  test("5. Normalized response does NOT contain the API key", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    const res = await adapter.generate(makeRequest(), makeProvider(), makeModel());

    // Serialize entire response to catch nested leakage
    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain(FAKE_API_KEY);
  });

  // -------------------------------------------------------------------------
  // Test 6 — Error messages do NOT expose the API key
  // -------------------------------------------------------------------------
  test("6. Provider error from Google does NOT expose the API key in the thrown error", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }),
    });

    let caughtError: Error | null = null;
    try {
      await adapter.generate(makeRequest(), makeProvider(), makeModel());
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).not.toContain(FAKE_API_KEY);
    expect(caughtError!.message).toContain("400");
  });

  test("6b. Even if Google echoes the key back in the error body, it is redacted", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    // Unusual but defensive: what if the response body somehow contained the key?
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => `You sent key=${FAKE_API_KEY} which is invalid`,
    });

    let caughtError: Error | null = null;
    try {
      await adapter.generate(makeRequest(), makeProvider(), makeModel());
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).not.toContain(FAKE_API_KEY);
    expect(caughtError!.message).toContain("redacted");
  });

  // -------------------------------------------------------------------------
  // Test 7 — model.configuration.apiModelName controls which model is called
  // -------------------------------------------------------------------------
  test("7. The URL uses model.configuration.apiModelName — not a hardcoded value", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    // Test with the seeded model
    await adapter.generate(makeRequest(), makeProvider(), makeModel("gemini-3.8-flash"));
    expect(capturedFetchArgs[0].url).toContain("gemini-3.8-flash");

    capturedFetchArgs.length = 0;

    // Verify a different model name flows through correctly (operator can swap models in DB)
    await adapter.generate(makeRequest(), makeProvider(), makeModel("gemini-3.7-flash"));
    expect(capturedFetchArgs[0].url).toContain("gemini-3.7-flash");
    expect(capturedFetchArgs[0].url).not.toContain("gemini-3.8-flash");
  });

  // -------------------------------------------------------------------------
  // Test 8 — Malformed / empty candidates response handled gracefully
  // -------------------------------------------------------------------------
  test("8. Malformed Gemini response (empty candidates) returns empty content without throwing", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [], usageMetadata: {} }),
    });

    const res = await adapter.generate(makeRequest(), makeProvider(), makeModel());
    expect(res.content).toBe("");
    expect(res.usage?.totalTokens).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 9 — Correct mapping of usage and metadata from a full response
  // -------------------------------------------------------------------------
  test("9. Successful response correctly maps content, usage, and provider metadata", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    const res = await adapter.generate(makeRequest(), makeProvider(), makeModel());

    expect(res.content).toBe("Binary search is an O(log n) algorithm.");
    expect(res.usage?.promptTokens).toBe(9);
    expect(res.usage?.completionTokens).toBe(12);
    expect(res.usage?.totalTokens).toBe(21);
    expect(res.providerResponseMetadata?.modelVersion).toBe(CONFIGURED_MODEL);
    expect(res.providerResponseMetadata?.finishReason).toBe("STOP");
  });

  // -------------------------------------------------------------------------
  // Test 10 — Health check uses header auth, not URL auth
  // -------------------------------------------------------------------------
  test("10. healthCheck sends x-goog-api-key header and does NOT put key in URL", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    (global.fetch as jest.Mock).mockImplementationOnce(
      async (url: string, init: RequestInit) => {
        capturedFetchArgs.push({ url, init });
        return { ok: true };
      }
    );

    const status = await adapter.healthCheck(makeProvider());

    expect(status).toBe("healthy");
    expect(capturedFetchArgs).toHaveLength(1);
    const { url, init } = capturedFetchArgs[0];
    expect(url).not.toContain(FAKE_API_KEY);
    expect(url).not.toContain("key=");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe(FAKE_API_KEY);
  });

  test("10b. healthCheck returns unhealthy on network error without logging secrets", async () => {
    process.env.GEMINI_API_KEY = FAKE_API_KEY;

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network unreachable"));

    const status = await adapter.healthCheck(makeProvider());
    expect(status).toBe("unhealthy");
  });
});
