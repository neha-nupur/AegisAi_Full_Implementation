import request from "supertest";
import { createApp } from "../src/app";
import type { Express } from "express";
import type { AegisAIConfig } from "@aegisai/config";

const testConfig: AegisAIConfig = {
  nodeEnv: "test",
  port: 0,
  databaseUrl: "postgresql://test:test@localhost:5432/test",
  mongodbUrl: "mongodb://localhost:27017/test",
  redisUrl: "redis://localhost:6379",
  jwtSecret: "test-secret",
  jwtExpiresIn: "15m",
  corsOrigins: ["http://localhost:5173"],
  soapMockUrl: "http://localhost:5005",
};

/** Phase 11: /docs (Swagger UI) and /openapi.json must be reachable without authentication — checklist items 13 and 19. */
describe("API documentation", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp(testConfig);
  });

  it("serves Swagger UI at /docs with no auth required", async () => {
    const res = await request(app).get("/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });

  it("serves the raw OpenAPI document at /openapi.json", async () => {
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.info.title).toBe("AegisAI API");
    expect(res.body.paths["/ai-requests"]).toBeDefined();
    expect(res.body.paths["/legacy-employees/{employeeId}"]).toBeDefined();
  });
});
