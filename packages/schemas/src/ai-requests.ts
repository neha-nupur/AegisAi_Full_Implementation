/**
 * AJV JSON Schema for `POST /v1/ai-requests` (Phase 3).
 *
 * Shared under `@aegisai/schemas` (not private to gateway-service)
 * because request/response schemas are meant to be reusable by any
 * caller that needs to validate the same shape — e.g. the frontend,
 * or another service composing an AI request — per this package's
 * stated purpose. `gateway-service` compiles and uses this schema in
 * `src/schemas/create-ai-request.schema.ts`; it does not duplicate
 * the field list.
 */
export const createAiRequestSchema = {
  $id: "aegisai://schemas/create-ai-request.json",
  type: "object",
  additionalProperties: false,
  required: ["input"],
  properties: {
    input: {
      type: "string",
      minLength: 1,
      maxLength: 20000,
    },
    modelPreference: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      default: "auto",
    },
    policyId: {
      type: "string",
      minLength: 1,
      maxLength: 200,
    },
  },
} as const;
