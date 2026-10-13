import request from "supertest";
import RedisMock from "ioredis-mock";
import { buildTestApp } from "./support/test-app";
import { AiRequestsService } from "../src/services/ai-requests.service";
import { InMemoryAiRequestsRepository } from "./support/in-memory-ai-requests.repository";
import { ModelRouterService, ProviderAdapterFactory } from "@aegisai/model-provider-service";
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

describe("Cursor Pagination & Cache-Control", () => {
  let app: any;
  let repository: InMemoryAiRequestsRepository;
  let token: string;
  let principal: any;

  beforeEach(async () => {
    const redisClient = await getRedisClient();
    await redisClient.flushall();
    
    repository = new InMemoryAiRequestsRepository();
    const service = new AiRequestsService(
      repository, new ModelRouterService(), {} as any, {} as any,
      new ProviderAdapterFactory(), undefined, new PrivacyScanService(new PrivacyScanner(), new InMemoryScannerResultsRepository()),
      new PolicyEvaluationService(new InMemoryPoliciesRepository())
    );
    service.setApprovalCreator(new FakeApprovalCreator());
    app = buildTestApp({ aiRequestsService: service });
    
    principal = buildPrincipal("DEVELOPER");
    token = issueTokenFor(principal);
  });

  test("Pagination: returns limit and nextCursor", async () => {
    // Seed 5 requests
    for (let i = 0; i < 5; i++) {
      await repository.create({
        organizationId: principal.organizationId,
        requesterId: principal.userId,
        input: `req ${i}`,
        modelPreference: "auto",
        policyId: null,
        traceId: `trace-${i}`
      });
      // Small delay so timestamps/UUIDs sort correctly
      await new Promise(r => setTimeout(r, 10));
    }

    // Request first page (limit=2)
    const res1 = await request(app)
      .get("/ai-requests?limit=2")
      .set("Authorization", `Bearer ${token}`);

    expect(res1.status).toBe(200);
    expect(res1.body.data).toHaveLength(2);
    expect(res1.body.meta.limit).toBe(2);
    expect(res1.body.meta.nextCursor).toBeDefined();

    // Request second page
    const res2 = await request(app)
      .get(`/ai-requests?limit=2&cursor=${res1.body.meta.nextCursor}`)
      .set("Authorization", `Bearer ${token}`);
      
    expect(res2.status).toBe(200);
    expect(res2.body.data).toHaveLength(2);
    expect(res2.body.meta.nextCursor).toBeDefined();

    // Request third page
    const res3 = await request(app)
      .get(`/ai-requests?limit=2&cursor=${res2.body.meta.nextCursor}`)
      .set("Authorization", `Bearer ${token}`);
      
    expect(res3.status).toBe(200);
    expect(res3.body.data).toHaveLength(1); // Only 1 left
    expect(res3.body.meta.nextCursor).toBeNull();
  });

  test("Cache-Control and ETag headers", async () => {
    const created = await repository.create({
      organizationId: principal.organizationId,
      requesterId: principal.userId,
      input: "test",
      modelPreference: "auto",
      policyId: null,
      traceId: "trace-1"
    });

    // List should have no-cache
    const listRes = await request(app).get("/ai-requests").set("Authorization", `Bearer ${token}`);
    expect(listRes.header["cache-control"]).toBe("private, no-cache");

    // Single item should have max-age
    const singleRes = await request(app)
      .get(`/ai-requests/${created.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-ID", "test-trace-1");
    expect(singleRes.header["cache-control"]).toBe("private, max-age=30");
    
    // ETag should be present
    const etag = singleRes.header["etag"];
    expect(etag).toBeDefined();
    expect(etag.startsWith("W/")).toBe(true);

    // 304 Not Modified
    const notModifiedRes = await request(app)
      .get(`/ai-requests/${created.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("If-None-Match", etag)
      .set("X-Correlation-ID", "test-trace-1");
      
    expect(notModifiedRes.status).toBe(304);
  });
});
