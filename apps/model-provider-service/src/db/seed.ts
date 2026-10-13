import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../../../../.env") });

import { PgProviderRepository } from "../repositories/provider.repository";
import { PgModelRepository } from "../repositories/model.repository";

/**
 * Seeds a minimal default catalog (Phase 11 hardening) — without at
 * least one active, healthy provider and one active model whose
 * capabilities include "chat", every AI request fails routing (see
 * `ModelRouterService.route` / `AiRequestsService.runProviderPipeline`,
 * which currently always requests `capabilitiesRequired: ["chat"]`,
 * `sensitivityLevel: "low"`, `complexity: "simple"`). This is what
 * makes the end-to-end demo (`docs/demo-script.md`) work without an
 * operator first having to call `POST /v1/providers` and
 * `POST /v1/models` by hand.
 *
 * Idempotent: skips entirely if any provider already exists, so it's
 * safe to run after real providers/models have been created via the
 * API. Run via `npm run seed -w apps/model-provider-service`, after
 * `npm run migrate -w apps/model-provider-service`.
 */
export async function seedDefaultCatalog(): Promise<void> {
  const providerRepository = new PgProviderRepository();
  const modelRepository = new PgModelRepository();

  const existing = await providerRepository.listAll();
  const hasOpenai = existing.some(p => p.type === 'openai');
  if (!hasOpenai) {
    const openaiProvider = await providerRepository.create({
      name: "openai-provider",
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      status: "active",
      healthStatus: "healthy",
      priority: 2,
      configurationReference: "OPENAI_API_KEY",
    });

    await modelRepository.create({
      providerId: openaiProvider.id,
      name: "gpt-3.5-turbo",
      capabilities: ["chat"],
      sensitivityLevel: "low",
      costMetadata: { inputCostPer1k: 0.0015, outputCostPer1k: 0.002, currency: "USD" },
      active: true,
      configuration: { apiModelName: "gpt-3.5-turbo" },
    });
  }


  const hasMock = existing.some(p => p.type === 'mock');
  
  if (!hasMock) {
    const provider = await providerRepository.create({
      name: "mock-provider",
      type: "mock",
      baseUrl: "http://localhost",
      status: "active",
      healthStatus: "healthy",
      priority: 1,
      configurationReference: "MOCK_PROVIDER_NO_KEY_NEEDED",
    });

    await modelRepository.create({
      providerId: provider.id,
      name: "mock-chat-standard",
      capabilities: ["chat"],
      sensitivityLevel: "low",
      costMetadata: { inputCostPer1k: 0.001, outputCostPer1k: 0.002, currency: "USD" },
      active: true,
      configuration: {},
    });
  }



  const hasGemini = existing.some(p => p.type === 'gemini');

  if (!hasGemini) {
    const geminiProvider = await providerRepository.create({
      name: "gemini-provider",
      type: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      status: "active",
      healthStatus: "healthy",
      priority: 3,
      configurationReference: "GEMINI_API_KEY",
    });

    await modelRepository.create({
      providerId: geminiProvider.id,
      name: "gemini-3.5-flash",
      capabilities: ["chat"],
      sensitivityLevel: "critical",
      costMetadata: { inputCostPer1k: 0.0001, outputCostPer1k: 0.0004, currency: "USD" },
      active: true,
      configuration: { apiModelName: "gemini-3.5-flash" },
    });

    await modelRepository.create({
      providerId: geminiProvider.id,
      name: "gemini-3.8-flash",
      capabilities: ["chat"],
      sensitivityLevel: "critical",
      costMetadata: { inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, currency: "USD" },
      active: true,
      configuration: { apiModelName: "gemini-3.8-flash" },
    });
  }

  console.log("model-provider-service: seeded providers (mock, openai, gemini) and models");
}

if (require.main === module) {
  seedDefaultCatalog()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(
        "model-provider-service: seed failed",
        err instanceof Error ? err.message : "unknown error"
      );
      process.exit(1);
    });
}
