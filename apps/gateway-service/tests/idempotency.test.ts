import request from "supertest";
import RedisMock from "ioredis-mock";
import { PrivacyScanner, PrivacyScanService } from "@aegisai/privacy-service";
import { PolicyEvaluationService } from "@aegisai/policy-service";
import { ModelRouterService, ProviderAdapterFactory, ProviderRepository, ModelRepository, Provider, Model } from "@aegisai/model-provider-service";
import { AiRequestsService } from "../src/services/ai-requests.service";
import { InMemoryAiRequestsRepository } from "./support/in-memory-ai-requests.repository";
import { InMemoryScannerResultsRepository } from "./support/in-memory-scanner-results.repository";
import { InMemoryPoliciesRepository } from "./support/in-memory-policies.repository";
import { FakeApprovalCreator } from "./support/fake-approval-creator";
import { buildPrincipal, issueTokenFor } from "./support/fixtures";
import { buildTestApp } from "./support/test-app";
import { getRedisClient } from "../src/db/redis";

jest.mock("../src/db/redis", () => {
  const mock = new RedisMock();
  return { getRedisClient: () => mock };
});

class StubProviderRepository implements ProviderRepository {
  async create() { return {} as any; }
  async getById() { return null; }
  async update() { return null; }
  async delete() { return false; }
  async findById() { return null; }
  async listAll(): Promise<Provider[]> { return [{ id: "mock-provider", name: "mock", type: "mock" as any, status: "active" as any, healthStatus: "healthy" as any, priority: 1, configurationReference: "MOCK", baseUrl: "", createdAt: "", updatedAt: "" }]; }
}
class StubModelRepository implements ModelRepository {
  async create() { return {} as any; }
  async getById() { return null; }
  async update() { return null; }
  async delete() { return false; }
  async findById() { return null; }
  async findByProviderId() { return []; }
  async listAll(): Promise<Model[]> { return [{ id: "mock-model-1", name: "mock-model", providerId: "mock-provider", active: true, capabilities: ["chat"] as any, sensitivityLevel: "low" as any, costMetadata: { inputCostPer1k: 0, outputCostPer1k: 0, currency: "USD" }, configuration: {}, createdAt: "", updatedAt: "" }]; }
}

describe("Idempotency Middleware", () => {
  let app: any;
  let redisClient: any;
  let token: string;

  beforeEach(async () => {
    redisClient = getRedisClient();
    await redisClient.flushall();
    
    const repository = new InMemoryAiRequestsRepository();
    const service = new AiRequestsService(
      repository, new ModelRouterService(), new StubProviderRepository(), new StubModelRepository(),
      new ProviderAdapterFactory(), undefined, new PrivacyScanService(new PrivacyScanner(), new InMemoryScannerResultsRepository()),
      new PolicyEvaluationService(new InMemoryPoliciesRepository())
    );
    service.setApprovalCreator(new FakeApprovalCreator());
    app = buildTestApp({ aiRequestsService: service });
    
    token = issueTokenFor(buildPrincipal("DEVELOPER"));
  });

  test("Missing Idempotency-Key header on POST returns 400", async () => {
    const res = await request(app)
      .post("/ai-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "hello" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_IDEMPOTENCY_KEY");
  });

  test("Duplicate POST with same key returns cached response", async () => {
    const key = "test-key-123";
    const res1 = await request(app)
      .post("/ai-requests")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({ input: "hello" });

    expect(res1.status).toBe(201);
    
    // Send again with same key
    const res2 = await request(app)
      .post("/ai-requests")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({ input: "this input should be ignored" });

    expect(res2.status).toBe(201);
    expect(res2.body).toEqual(res1.body);
  });

  test("Different keys create independent requests", async () => {
    const res1 = await request(app)
      .post("/ai-requests")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "key1")
      .send({ input: "hello 1" });

    const res2 = await request(app)
      .post("/ai-requests")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "key2")
      .send({ input: "hello 2" });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.data.id).not.toBe(res2.body.data.id);
  });
});
