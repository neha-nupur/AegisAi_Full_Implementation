/**
 * AJV JSON Schemas shared across services.
 *
 * Phase 3 adds the first real schema (`createAiRequestSchema`).
 * Additional schemas (policy documents, etc.) are added alongside the
 * endpoints that use them, per the "do not create speculative domain
 * models" rule — this file re-exports each one as it lands, it never
 * grows ahead of the phase that needs it.
 */
export { createAiRequestSchema } from "./ai-requests";

