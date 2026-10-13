import request from "supertest";
import RedisMock from "ioredis-mock";
import { buildTestApp } from "./support/test-app";
import { AiRequestsService } from "../src/services/ai-requests.service";
import { InMemoryAiRequestsRepository } from "./support/in-memory-ai-requests.repository";
import { ModelRouterService, ProviderAdapterFactory, ProviderRepository, ModelRepository } from "@aegisai/model-provider-service";
import { PrivacyScanner, PrivacyScanService } from "@aegisai/privacy-service";
import { PolicyEvaluationService } from "@aegisai/policy-service";
import { InMemoryScannerResultsRepository } from "./support/in-memory-scanner-results.repository";
import { InMemoryPoliciesRepository } from "./support/in-memory-policies.repository";
import { FakeApprovalCreator } from "./support/fake-approval-creator";
import { buildPrincipal, issueTokenFor } from "./support/fixtures";
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
  async listAll() { return []; }
}
class StubModelRepository implements ModelRepository {
  async create() { return {} as any; }
  async getById() { return null; }
  async update() { return null; }
  async delete() { return false; }
  async findById() { return null; }
  async findByProviderId() { return []; }
  async listAll() { return []; }
}

describe("Rate Limiting Middleware", () => {
  let app: any;
  let redisClient: any;
  let token: string;

  beforeAll(() => {
    // Override max for easier testing
    process.env["RATE_LIMIT_MAX"] = "2";
    process.env["RATE_LIMIT_WINDOW_MS"] = "60000";
  });

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
    
    // We only test the GET /ai-requests route here for rate limit to avoid needing to mock everything
    app = buildTestApp({ aiRequestsService: service });
    token = issueTokenFor(buildPrincipal("DEVELOPER"));
  });

  test("Headers present on every response", async () => {
    const res = await request(app)
      .get("/ai-requests")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.header["x-ratelimit-limit"]).toBe("2");
    expect(res.header["x-ratelimit-remaining"]).toBe("1");
    expect(res.header["x-ratelimit-reset"]).toBeDefined();
  });

  test("429 returned when limit exceeded", async () => {
    // Request 1
    await request(app).get("/ai-requests").set("Authorization", `Bearer ${token}`);
    // Request 2
    await request(app).get("/ai-requests").set("Authorization", `Bearer ${token}`);
    
    // Request 3 (exceeds limit of 2)
    const res = await request(app)
      .get("/ai-requests")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(res.header["retry-after"]).toBeDefined();
    expect(res.header["x-ratelimit-remaining"]).toBe("0");
  });
});
