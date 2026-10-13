import request from "supertest";
import express from "express";
import { modelProviderRouter } from "../src/routes";

const app = express();
app.use(express.json());
app.use("/v1/model-provider", modelProviderRouter);

// Mock error handler since we aren't using the global one from apps/api
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.status || 500).json({
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message,
      details: err.details,
      traceId: "test-trace-id"
    }
  });
});


// We'll mock the identity service middleware so we can test without a real token
jest.mock("@aegisai/identity-service", () => ({
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = { userId: "test-user-id", role: "organization_admin", orgId: "test-org-id" };
    next();
  },
  requireRole: (_role: string) => (_req: any, _res: any, next: any) => next(),
  requirePermission: (_perm: string) => (_req: any, _res: any, next: any) => next(),
}));

// We'll also mock the repository so we don't need a real DB
jest.mock("../src/repositories/provider.repository", () => ({
  PgProviderRepository: jest.fn().mockImplementation(() => ({
    listAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: "prov-123", name: "Test Provider" })
  }))
}));

jest.mock("../src/repositories/model.repository", () => ({
  PgModelRepository: jest.fn().mockImplementation(() => ({
    listAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: "mod-123", name: "Test Model" })
  }))
}));

describe("Model Provider API", () => {
  afterAll(async () => {
    // Clean up connections if any
  });

  describe("POST /v1/model-provider/providers", () => {
    it("should return 400 if validation fails", async () => {
      const response = await request(app)
        .post("/v1/model-provider/providers")
        .send({
          name: "Incomplete Provider",
          // missing type, baseUrl, etc.
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 201 if valid payload", async () => {
      const response = await request(app)
        .post("/v1/model-provider/providers")
        .send({
          name: "Test Provider",
          type: "mock",
          baseUrl: "http://localhost:3000",
          status: "active",
          healthStatus: "healthy",
          priority: 1,
          configurationReference: "secret/mock-config"
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe("prov-123");
    });
  });

  describe("POST /v1/model-provider/models", () => {
    it("should return 400 if validation fails", async () => {
      const response = await request(app)
        .post("/v1/model-provider/models")
        .send({
          name: "Incomplete Model",
          // missing costMetadata, sensitivityLevel, etc.
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 201 if valid payload", async () => {
      const response = await request(app)
        .post("/v1/model-provider/models")
        .send({
          providerId: "prov-123",
          name: "Test Model",
          capabilities: ["chat"],
          sensitivityLevel: "low",
          costMetadata: {
            inputCostPer1k: 0.01,
            outputCostPer1k: 0.02,
            currency: "USD"
          },
          active: true,
          configuration: {}
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe("mod-123");
    });
  });
});
