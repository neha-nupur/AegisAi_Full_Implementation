import { ModelRouterService } from "../src/services/router.service";
import { Provider, Model } from "../src/types";

describe("ModelRouterService", () => {
  let router: ModelRouterService;

  beforeEach(() => {
    router = new ModelRouterService();
  });

  const mockProvider: Provider = {
    id: "p1",
    name: "Mock Provider",
    type: "mock",
    baseUrl: "http://mock",
    status: "active",
    healthStatus: "healthy",
    priority: 1,
    configurationReference: "MOCK_KEY",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const cheapModel: Model = {
    id: "m1",
    providerId: "p1",
    name: "cheap-model",
    capabilities: ["chat"],
    sensitivityLevel: "low",
    costMetadata: { inputCostPer1k: 0.01, outputCostPer1k: 0.02, currency: "USD" },
    active: true,
    configuration: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const expensiveModel: Model = {
    id: "m2",
    providerId: "p1",
    name: "expensive-model",
    capabilities: ["chat", "reasoning"],
    sensitivityLevel: "high",
    costMetadata: { inputCostPer1k: 1.0, outputCostPer1k: 2.0, currency: "USD" },
    active: true,
    configuration: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("should select the cheapest model for simple complexity", () => {
    const result = router.route(
      {
        organizationId: "org1",
        capabilitiesRequired: ["chat"],
        sensitivityLevel: "low",
        complexity: "simple",
      },
      [mockProvider],
      [cheapModel, expensiveModel]
    );

    expect(result.blocked).toBe(false);
    expect(result.selectedModel?.id).toBe("m1");
  });

  it("should select the more capable/expensive model for complex tasks", () => {
    const result = router.route(
      {
        organizationId: "org1",
        capabilitiesRequired: ["chat"],
        sensitivityLevel: "low",
        complexity: "complex",
      },
      [mockProvider],
      [cheapModel, expensiveModel]
    );

    expect(result.blocked).toBe(false);
    expect(result.selectedModel?.id).toBe("m2");
  });

  it("should block if sensitivity level cannot be satisfied", () => {
    const result = router.route(
      {
        organizationId: "org1",
        capabilitiesRequired: ["chat"],
        sensitivityLevel: "critical", // We don't have a model that can handle critical
        complexity: "simple",
      },
      [mockProvider],
      [cheapModel, expensiveModel]
    );

    expect(result.blocked).toBe(true);
    expect(result.routingReason).toContain("sensitivity level");
  });
});
