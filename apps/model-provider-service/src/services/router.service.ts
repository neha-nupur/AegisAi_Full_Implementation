import { Model, Provider, SensitivityLevel } from "../types";

export interface RoutingRequest {
  organizationId: string;
  capabilitiesRequired: string[];
  sensitivityLevel: SensitivityLevel;
  complexity: "simple" | "complex";
  maxBudget?: number; // per request or total, simplified for now
  currentCost?: number;
  modelPreference?: string;
}

export interface RoutingResult {
  selectedProvider: Provider | null;
  selectedModel: Model | null;
  routingReason: string;
  blocked: boolean;
}

export class ModelRouterService {
  /**
   * Selects the best provider and model based on the routing request.
   * Assumes providers and models are passed in, or it fetches them from repos.
   */
  public route(
    request: RoutingRequest,
    availableProviders: Provider[],
    availableModels: Model[]
  ): RoutingResult {
    // 1. Filter out unhealthy providers
    const healthyProviders = availableProviders.filter(
      (p) => p.status === "active" && p.healthStatus === "healthy"
    );

    if (healthyProviders.length === 0) {
      // Try degraded providers as a fallback
      const degradedProviders = availableProviders.filter(
        (p) => p.status === "active" && p.healthStatus === "degraded"
      );
      if (degradedProviders.length === 0) {
         return {
           selectedProvider: null,
           selectedModel: null,
           routingReason: "All providers are unhealthy or inactive.",
           blocked: true,
         };
      }
      healthyProviders.push(...degradedProviders);
    }

    const providerIds = new Set(healthyProviders.map(p => p.id));

    // 2. Filter active models belonging to available providers
    let validModels = availableModels.filter(
      (m) => m.active && providerIds.has(m.providerId)
    );

    if (validModels.length === 0) {
      return {
        selectedProvider: null,
        selectedModel: null,
        routingReason: "No active models available for healthy providers.",
        blocked: true,
      };
    }

    // 3. Filter by required capabilities
    if (request.capabilitiesRequired.length > 0) {
      validModels = validModels.filter(m => 
        request.capabilitiesRequired.every(cap => m.capabilities.includes(cap))
      );
    }

    // 4. Filter by sensitivity level
    const sensitivityRanks: Record<SensitivityLevel, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };

    const requiredSensitivityRank = sensitivityRanks[request.sensitivityLevel];
    
    validModels = validModels.filter(m => 
      sensitivityRanks[m.sensitivityLevel] >= requiredSensitivityRank
    );

    if (validModels.length === 0) {
      return {
        selectedProvider: null,
        selectedModel: null,
        routingReason: `No models available approved for sensitivity level: ${request.sensitivityLevel}`,
        blocked: true,
      };
    }

    // 5. Sort based on model preference, complexity, and cost
    // Model preference matching is case-insensitive and checks both model.name
    // and model.configuration.apiModelName so operators/users don't need to know
    // the exact casing used in the database.
    const normalizedPreference = request.modelPreference?.toLowerCase().trim();
    const prefersModel = (m: Model): boolean => {
      if (!normalizedPreference || normalizedPreference === "auto") return false;
      if (m.name.toLowerCase() === normalizedPreference) return true;
      const apiModelName = (m.configuration as Record<string, string> | undefined)?.apiModelName;
      if (apiModelName && apiModelName.toLowerCase() === normalizedPreference) return true;
      return false;
    };

    validModels.sort((a, b) => {
      // If a model preference is provided, prioritize it above all else
      if (normalizedPreference && normalizedPreference !== "auto") {
        const aMatches = prefersModel(a);
        const bMatches = prefersModel(b);
        if (aMatches && !bMatches) return -1;
        if (bMatches && !aMatches) return 1;
      }

      // Then sort by complexity
      if (request.complexity === "complex") {
        return b.costMetadata.inputCostPer1k - a.costMetadata.inputCostPer1k;
      } else {
        return a.costMetadata.inputCostPer1k - b.costMetadata.inputCostPer1k;
      }
    });

    // 6. Check budget constraints
    let selectedModel = null;
    let selectedProvider = null;
    let blockReason = "";

    for (const model of validModels) {
      const provider = healthyProviders.find(p => p.id === model.providerId);
      if (!provider) continue;

      if (request.maxBudget !== undefined && request.currentCost !== undefined) {
        if (request.currentCost + model.costMetadata.inputCostPer1k > request.maxBudget) {
          blockReason = "Budget exceeded for this model.";
          continue; 
        }
      }

      selectedModel = model;
      selectedProvider = provider;
      break;
    }

    if (!selectedModel || !selectedProvider) {
       return {
        selectedProvider: null,
        selectedModel: null,
        routingReason: blockReason || "No models satisfied all routing constraints.",
        blocked: true,
      };
    }

    let routingReason = `Routed to ${selectedModel.name} via ${selectedProvider.name} due to complexity='${request.complexity}' and sensitivity='${request.sensitivityLevel}'.`;
    const preferenceWasHonored = normalizedPreference && normalizedPreference !== "auto" && prefersModel(selectedModel);
    if (preferenceWasHonored) {
      routingReason = `Routed to ${selectedModel.name} via ${selectedProvider.name} (User Preference).`;
    }

    return {
      selectedProvider,
      selectedModel,
      routingReason,
      blocked: false,
    };
  }
}
