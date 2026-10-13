import { ProviderType } from "../types";
import { ProviderAdapter } from "./provider-adapter.interface";
import { OpenAiProviderAdapter } from "./adapters/openai.provider";
import { MockProviderAdapter } from "./adapters/mock.provider";
import { GeminiProviderAdapter } from "./adapters/gemini.provider";
import { ResilientProviderAdapter } from "./resilient-provider.adapter";

export class ProviderAdapterFactory {
  private adapters = new Map<ProviderType, ProviderAdapter>();

  constructor() {
    this.adapters.set("openai", new ResilientProviderAdapter(new OpenAiProviderAdapter()));
    this.adapters.set("gemini", new ResilientProviderAdapter(new GeminiProviderAdapter()));
    this.adapters.set("mock", new ResilientProviderAdapter(new MockProviderAdapter()));
  }

  getAdapter(type: ProviderType): ProviderAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`No adapter found for provider type: ${type}`);
    }
    return adapter;
  }
}
