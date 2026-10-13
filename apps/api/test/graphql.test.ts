import request from "supertest";
import { createApp } from "../src/app";
import type { Express } from "express";
import type { AegisAIConfig } from "@aegisai/config";
import jwt from "jsonwebtoken";
import { AiRequestsService } from "@aegisai/gateway-service";
import { ApprovalsService, PoliciesService } from "@aegisai/policy-service";
import { __resetConfigCacheForTests } from "@aegisai/config";

// TokenService.verify calls loadConfig() which reads process.env.
// Set required env vars before the config is first loaded.
const TEST_JWT_SECRET = "test-secret-graphql";
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_EXPIRES_IN = "15m";
process.env.PORT = "3001";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.MONGODB_URL = "mongodb://localhost:27017/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.CORS_ORIGINS = "http://localhost:5173";
// Reset the loadConfig() cache so it re-reads env (other test files may have loaded it first).
__resetConfigCacheForTests();

const testConfig: AegisAIConfig = {
  nodeEnv: "test",
  port: 0,
  databaseUrl: "postgresql://test:test@localhost:5432/test",
  mongodbUrl: "mongodb://localhost:27017/test",
  redisUrl: "redis://localhost:6379",
  jwtSecret: TEST_JWT_SECRET,
  jwtExpiresIn: "15m",
  corsOrigins: ["http://localhost:5173"],
  soapMockUrl: "http://localhost:5005",
};

describe("POST /v1/graphql", () => {
  let app: Express;
  let token: string;

  beforeAll(async () => {
    jest.spyOn(AiRequestsService.prototype, "list").mockResolvedValue({
      items: [],
      nextCursor: null
    });
    jest.spyOn(ApprovalsService.prototype, "list").mockResolvedValue([]);
    jest.spyOn(PoliciesService.prototype, "list").mockResolvedValue([]);

    app = await createApp(testConfig);
    token = jwt.sign(
      {
        organizationId: "test-org-id",
        role: "admin",
        permissions: [],
      },
      testConfig.jwtSecret,
      { subject: "test-user-id", expiresIn: "15m" } as any
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("should return 401 without token", async () => {
    const res = await request(app)
      .post("/v1/graphql")
      .send({ query: "{ me { id } }" });
    expect(res.status).toBe(401);
  });

  it("should execute me query", async () => {
    const res = await request(app)
      .post("/v1/graphql")
      .set("Authorization", `Bearer ${token}`)
      .send({ query: "{ me { id email organizationId role } }" });
    
    expect(res.status).toBe(200);
    expect(res.body.data.me).toEqual({
      id: "test-user-id",
      email: "user@example.com",
      organizationId: "test-org-id",
      role: "admin",
    });
  });

  it("should execute policies query", async () => {
    const res = await request(app)
      .post("/v1/graphql")
      .set("Authorization", `Bearer ${token}`)
      .send({ query: "{ policies { id } }" });
    
    expect(res.status).toBe(200);
    expect(res.body.data.policies).toEqual([]);
  });
});
