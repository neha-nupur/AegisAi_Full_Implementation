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

describe("GET /health", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp(testConfig);
  });

  it("should return 200 OK and status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("echoes a correlation ID header on the response", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-correlation-id"]).toBeTruthy();
  });

  it("reuses an incoming correlation ID instead of replacing it", async () => {
    const res = await request(app)
      .get("/health")
      .set("x-correlation-id", "test-correlation-id-123");
    expect(res.headers["x-correlation-id"]).toBe("test-correlation-id-123");
  });
});

describe("unmatched routes", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp(testConfig);
  });

  it("returns the standard error envelope with a 404", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.traceId).toBeTruthy();
  });
});
