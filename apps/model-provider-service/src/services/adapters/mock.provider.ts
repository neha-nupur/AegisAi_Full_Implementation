import { Provider, Model, ProviderHealthStatus } from "../../types";
import { GenerateRequest, GenerateResponse, ProviderAdapter } from "../provider-adapter.interface";

export class MockProviderAdapter implements ProviderAdapter {
  async generate(request: GenerateRequest, provider: Provider, model: Model): Promise<GenerateResponse> {
    // In a test scenario we might want to throw an error if the model name contains 'error'
    if (model.name.includes('error') || request.messages.some(m => typeof m.content === 'string' && m.content.includes('FORCE_PROVIDER_FAILURE'))) {
      throw new Error('Mock provider simulated failure');
    }
    
    // Similarly timeout simulation
    if (model.name.includes('timeout')) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    return {
      content: `Mock response from ${model.name} via ${provider.name}`,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      },
      providerResponseMetadata: {
        mocked: true,
        correlationId: request.correlationId
      }
    };
  }

  async healthCheck(provider: Provider): Promise<ProviderHealthStatus> {
    if (provider.baseUrl.includes('offline')) {
      return 'unhealthy';
    }
    if (provider.baseUrl.includes('degraded')) {
      return 'degraded';
    }
    return 'healthy';
  }

  getCapabilities(): string[] {
    return ["chat", "mock"];
  }
}
