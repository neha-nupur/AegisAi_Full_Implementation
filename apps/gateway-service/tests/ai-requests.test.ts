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
    return [{ id: "mock-model-1", name: "mock-model", providerId: "mock-provider", active: true, capabilities: ["chat"], sensitivityLevel: "high", costMetadata: { inputCostPer1k: 0, outputCostPer1k: 0, currency: "USD" }, configuration: {}, createdAt: "", updatedAt: "" }];
  }
}

describe("AI Gateway — POST/GET /v1/ai-requests", () => {
  function buildApp() {
    const repository = new InMemoryAiRequestsRepository();
    const modelRouter = new ModelRouterService();
    const providerRepository = new StubProviderRepository();
    const modelRepository = new StubModelRepository();
    const providerFactory = new ProviderAdapterFactory();
    
    const privacyScanService = new PrivacyScanService(new PrivacyScanner(), new InMemoryScannerResultsRepository());
    const policyEvaluationService = new PolicyEvaluationService(new InMemoryPoliciesRepository());
    const approvalCreator = new FakeApprovalCreator();
    const service = new AiRequestsService(repository, modelRouter, providerRepository, modelRepository, providerFactory, undefined, privacyScanService, policyEvaluationService);
    service.setApprovalCreator(approvalCreator);
    const app = buildTestApp({ aiRequestsService: service });
    return { app, repository, service, approvalCreator };
  }

  test("valid request: logged-in user submits a clean AI request and receives a completed response", async () => {
    const { app } = buildApp();
    const principal = buildPrincipal("DEVELOPER");
    const token = issueTokenFor(principal);

    const res = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ modelPreference: "auto", policyId: "policy_default", input: "Summarize this customer support message." });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("COMPLETED");
    expect(res.body.data.organizationId).toBe(principal.organizationId);
    expect(res.body.data.requesterId).toBe(principal.userId);
    expect(res.body.data.output).toContain("Mock response from mock-model via mock");
    expect(res.body.data.modelId).toBe("mock-model-1");
    expect(res.body.data.providerId).toBe("mock-provider");
    expect(res.body.data.traceId).toBeDefined();
    expect(res.body.traceId).toBeDefined();
  });

  test("invalid request: missing required `input` field is rejected with 400 VALIDATION_ERROR", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app).post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString()).set("Authorization", `Bearer ${token}`).send({ policyId: "policy_default" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.violations.length).toBeGreaterThan(0);
  });

  test("invalid request: empty `input` string is rejected with 400", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app).post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString()).set("Authorization", `Bearer ${token}`).send({ input: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("missing JWT: submitting without a bearer token is rejected with 401", async () => {
    const { app } = buildApp();

    const res = await request(app).post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString()).send({ input: "hello" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_TOKEN");
  });

  test("missing JWT: reading the list without a bearer token is rejected with 401", async () => {
    const { app } = buildApp();

    const res = await request(app).get("/ai-requests");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_TOKEN");
  });

  test("wrong organization: a request belonging to another organization returns 404, not the resource", async () => {
    const { app } = buildApp();
    const ownerToken = issueTokenFor(buildPrincipal("DEVELOPER"));
    const createRes = await request(app).post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString()).set("Authorization", `Bearer ${ownerToken}`).send({ input: "hello" });
    expect(createRes.status).toBe(201);

    const otherToken = issueTokenFor(buildPrincipal("DEVELOPER"));
    const getRes = await request(app).get(`/ai-requests/${createRes.body.data.id}`).set("Authorization", `Bearer ${otherToken}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe("AI_REQUEST_NOT_FOUND");
  });

  test("wrong organization: listing only ever returns the caller's own organization's requests", async () => {
    const { app } = buildApp();
    const principalA = buildPrincipal("DEVELOPER");
    const tokenA = issueTokenFor(principalA);
    await request(app).post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString()).set("Authorization", `Bearer ${tokenA}`).send({ input: "from org A" });

    const principalB = buildPrincipal("DEVELOPER");
    const tokenB = issueTokenFor(principalB);
    await request(app).post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString()).set("Authorization", `Bearer ${tokenB}`).send({ input: "from org B" });

    const listRes = await request(app).get("/ai-requests").set("Authorization", `Bearer ${tokenA}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].organizationId).toBe(principalA.organizationId);
  });

  test("unknown request: a request ID that does not exist returns 404", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app).get("/ai-requests/00000000-0000-0000-0000-000000000000").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("AI_REQUEST_NOT_FOUND");
  });

  test("provider failure: the mock provider's failure trigger results in 502 and a FAILED, queryable request", async () => {
    const { app, repository } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "please FORCE_PROVIDER_FAILURE now" });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("PROVIDER_FAILURE");
    const aiRequestId = res.body.error.details.aiRequestId;
    expect(aiRequestId).toBeDefined();

    const persisted = await repository.findById(aiRequestId);
    expect(persisted?.status).toBe("FAILED");
    expect(persisted?.errorMessage).toContain("simulated failure");
  });

  test("SECURITY_AUDITOR can read but not submit AI requests (403)", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("SECURITY_AUDITOR"));

    const listRes = await request(app).get("/ai-requests").set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);

    const submitRes = await request(app).post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString()).set("Authorization", `Bearer ${token}`).send({ input: "hello" });
    expect(submitRes.status).toBe(403);
    expect(submitRes.body.error.code).toBe("FORBIDDEN");
  });
});

describe("AI Gateway — Phase 4: Privacy Scan + Policy Evaluation", () => {
  function buildApp() {
    const repository = new InMemoryAiRequestsRepository();
    const modelRouter = new ModelRouterService();
    const providerRepository = new StubProviderRepository();
    const modelRepository = new StubModelRepository();
    const providerFactory = new ProviderAdapterFactory();
    
    const privacyScanService = new PrivacyScanService(new PrivacyScanner(), new InMemoryScannerResultsRepository());
    const policyEvaluationService = new PolicyEvaluationService(new InMemoryPoliciesRepository());
    const approvalCreator = new FakeApprovalCreator();
    const service = new AiRequestsService(repository, modelRouter, providerRepository, modelRepository, providerFactory, undefined, privacyScanService, policyEvaluationService);
    service.setApprovalCreator(approvalCreator);
    const app = buildTestApp({ aiRequestsService: service });
    return { app, repository, service, approvalCreator };
  }

  test("PII detected -> MASK: the provider receives masked input, never the raw PII", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "My email is jane@example.com, please summarize this." });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("COMPLETED");
    // The provider's output should not contain the raw PII — it only ever
    // received the masked version of the input.
    expect(res.body.data.output).not.toContain("jane@example.com");
    // The output IS the provider's response content (not the masked input itself).
    expect(res.body.data.output).toContain("Mock response from mock-model via mock");
    // The raw input the user submitted is still stored as-is (Phase 3 field) —
    // only what's sent to the provider is masked.
    expect(res.body.data.input).toContain("jane@example.com");
  });

  test("secret detected -> BLOCK: the provider is never called and the request is BLOCKED", async () => {
    const { app, repository } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "Here is the key: AKIAABCDEFGHIJKLMNOP use it now." });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("POLICY_BLOCK");
    const aiRequestId = res.body.error.details.aiRequestId;

    const persisted = await repository.findById(aiRequestId);
    expect(persisted?.status).toBe("BLOCKED");
    expect(persisted?.output).toBeNull();
  });

  test("sensitive keyword -> REQUIRE_APPROVAL: the request pauses and an approval is created", async () => {
    const { app, repository, approvalCreator } = buildApp();
    const principal = buildPrincipal("DEVELOPER");
    const token = issueTokenFor(principal);

    const res = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "This note is about the upcoming merger, please summarize." });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("APPROVAL_REQUIRED");
    expect(res.body.data.output).toBeNull();

    expect(approvalCreator.calls).toHaveLength(1);
    expect(approvalCreator.calls[0]).toMatchObject({
      organizationId: principal.organizationId,
      aiRequestId: res.body.data.id,
      requesterId: principal.userId,
    });

    const persisted = await repository.findById(res.body.data.id);
    expect(persisted?.status).toBe("APPROVAL_REQUIRED");
  });

  test("approved request continues to the provider and completes", async () => {
    const { app, repository, service } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const submitRes = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "This note is about the upcoming merger, please summarize." });
    expect(submitRes.body.data.status).toBe("APPROVAL_REQUIRED");

    await service.resumeAfterApproval(submitRes.body.data.id, "APPROVED", "Reviewed and fine");

    const persisted = await repository.findById(submitRes.body.data.id);
    expect(persisted?.status).toBe("COMPLETED");
    expect(persisted?.output).toContain("Mock response from mock-model via mock");
  });

  test("rejected request is BLOCKED and never reaches the provider", async () => {
    const { app, repository, service } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const submitRes = await request(app)
      .post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString())
      .set("Authorization", `Bearer ${token}`)
      .send({ input: "This note is about the upcoming merger, please summarize." });
    expect(submitRes.body.data.status).toBe("APPROVAL_REQUIRED");

    await service.resumeAfterApproval(submitRes.body.data.id, "REJECTED", "Not appropriate to send externally");

    const persisted = await repository.findById(submitRes.body.data.id);
    expect(persisted?.status).toBe("BLOCKED");
    expect(persisted?.errorMessage).toBe("Not appropriate to send externally");
    expect(persisted?.output).toBeNull();
  });

  test("resumeAfterApproval is a no-op for a request that is not APPROVAL_REQUIRED", async () => {
    const { app, repository, service } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const submitRes = await request(app).post("/ai-requests").set("Idempotency-Key", "test-key-" + Math.random().toString()).set("Authorization", `Bearer ${token}`).send({ input: "hello" });
    expect(submitRes.body.data.status).toBe("COMPLETED");

    await service.resumeAfterApproval(submitRes.body.data.id, "APPROVED", null);

    const persisted = await repository.findById(submitRes.body.data.id);
    expect(persisted?.status).toBe("COMPLETED"); // unchanged
  });
});
