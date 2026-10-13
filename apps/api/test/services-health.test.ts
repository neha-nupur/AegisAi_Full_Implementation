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

/**
 * Phase 1: every one of the six logical services is mounted under its
 * own /v1/<service> prefix and must answer its own GET /health — this
 * is what proves the service boundaries are real and independently
 * reachable, not just directory names (see docs/service-boundaries.md).
 */
const services: Array<{ prefix: string; serviceName: string }> = [
  { prefix: "identity", serviceName: "identity-service" },
  { prefix: "gateway", serviceName: "gateway-service" },
  { prefix: "privacy", serviceName: "privacy-service" },
  { prefix: "policy", serviceName: "policy-service" },
  { prefix: "model-provider", serviceName: "model-provider-service" },
  { prefix: "security-audit", serviceName: "security-audit-service" },
];

describe("per-service GET /v1/<service>/health", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp(testConfig);
  });

  it.each(services)(
    "$serviceName responds 200 with its own service name",
    async ({ prefix, serviceName }) => {
      const res = await request(app).get(`/v1/${prefix}/health`);

      expect(res.status).toBe(200);
      expect(res.body.service).toBe(serviceName);
      expect(res.body.status).toBe("ok");
      expect(typeof res.body.timestamp).toBe("string");
    }
  );
});
