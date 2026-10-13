import RedisMock from "ioredis-mock";
jest.mock("../src/db/redis", () => {
  const mock = new RedisMock();
  return { getRedisClient: () => mock };
});
import request from "supertest";
import { PrivacyScanner, PrivacyScanService } from "@aegisai/privacy-service";
import { PolicyEvaluationService } from "@aegisai/policy-service";
import { ModelRouterService, ProviderRepository, ModelRepository, ProviderAdapterFactory, Provider, Model } from "@aegisai/model-provider-service";
import { AiRequestsService } from "../src/services/ai-requests.service";
import { InMemoryAiRequestsRepository } from "./support/in-memory-ai-requests.repository";
import { InMemoryScannerResultsRepository } from "./support/in-memory-scanner-results.repository";
import { InMemoryPoliciesRepository } from "./support/in-memory-policies.repository";
import { FakeApprovalCreator } from "./support/fake-approval-creator";
import { buildPrincipal, issueTokenFor } from "./support/fixtures";
import { buildTestApp } from "./support/test-app";

class StubProviderRepository implements ProviderRepository {
  async create() { return {} as any; }
  async getById() { return null; }
  async update() { return null; }
  async delete() { return false; }
  async findById(_id: string): Promise<Provider | null> { return null; }
  async listAll(): Promise<Provider[]> {
    return [{ id: "mock-provider", name: "mock", type: "mock", status: "active", healthStatus: "healthy", priority: 1, configurationReference: "MOCK", baseUrl: "", createdAt: "", updatedAt: "" }];
  }
}

class StubModelRepository implements ModelRepository {
  async create() { return {} as any; }
  async getById() { return null; }
  async update() { return null; }
  async delete() { return false; }
  async findById(_id: string): Promise<Model | null> { return null; }
  async findByProviderId(_providerId: string): Promise<Model[]> { return []; }
  async listAll(): Promise<Model[]> {
    return [
      { id: "low-model", name: "low-model", providerId: "mock-provider", active: true, capabilities: ["chat"], sensitivityLevel: "low", costMetadata: { inputCostPer1k: 0.1, outputCostPer1k: 0.1, currency: "USD" }, configuration: {}, createdAt: "", updatedAt: "" },
      { id: "medium-model", name: "medium-model", providerId: "mock-provider", active: true, capabilities: ["chat"], sensitivityLevel: "medium", costMetadata: { inputCostPer1k: 0.5, outputCostPer1k: 0.5, currency: "USD" }, configuration: {}, createdAt: "", updatedAt: "" },
      { id: "high-model", name: "high-model", providerId: "mock-provider", active: true, capabilities: ["chat"], sensitivityLevel: "high", costMetadata: { inputCostPer1k: 1.0, outputCostPer1k: 1.0, currency: "USD" }, configuration: {}, createdAt: "", updatedAt: "" },
    ];
  }
}

describe("AI Gateway — Phase 12.1: Dynamic Model Routing", () => {
  function buildApp() {
    const repository = new InMemoryAiRequestsRepository();
    const modelRouter = new ModelRouterService();
    const providerRepository = new StubProviderRepository();
    const modelRepository = new StubModelRepository();
    const providerFactory = new ProviderAdapterFactory();
    
    const privacyScanService = new PrivacyScanService(new PrivacyScanner(), new InMemoryScannerResultsRepository());
    // Create an empty policy repo so it falls back to the default policy
    const policyEvaluationService = new PolicyEvaluationService(new InMemoryPoliciesRepository());
    const approvalCreator = new FakeApprovalCreator();
    const service = new AiRequestsService(repository, modelRouter, providerRepository, modelRepository, providerFactory, undefined, privacyScanService, policyEvaluationService);
    service.setApprovalCreator(approvalCreator);
    const app = buildTestApp({ aiRequestsService: service });
    return { app, repository, service, approvalCreator };
  }

  test("clean input routes to low-model (lowest cost, sufficient sensitivity)", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "Tell me a joke." });

    expect(res.status).toBe(201);
    expect(res.body.data.modelId).toBe("low-model");
  });

  test("PII input routes to medium-model (elevates sensitivity to medium)", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "My email is test@example.com." }); // EMAIL finding -> medium

    expect(res.status).toBe(201);
    // Medium model should be selected because low-model isn't approved for medium sensitivity
    expect(res.body.data.modelId).toBe("medium-model");
  });

  test("modelPreference uses requested model if it meets sensitivity constraints", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "Tell me a joke.", modelPreference: "high-model" });

    expect(res.status).toBe(201);
    // The input is clean (low), so high-model is more than sufficient.
    // The router honors the preference.
    expect(res.body.data.modelId).toBe("high-model");
  });

  test("modelPreference is overridden if the requested model cannot handle the required sensitivity", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    // We send PII (requires medium model) but request the low-model.
    const res = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "My email is test@example.com.", modelPreference: "low-model" });

    // Assuming the router logic prioritizes security, it should fallback to medium-model or high-model.
    expect(res.status).toBe(201);
    expect(res.body.data.modelId).not.toBe("low-model");
    expect(["medium-model", "high-model"]).toContain(res.body.data.modelId);
  });
});
