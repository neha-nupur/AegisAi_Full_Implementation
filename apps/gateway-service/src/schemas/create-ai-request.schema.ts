import Ajv, { type ValidateFunction } from "ajv";
import { createAiRequestSchema } from "@aegisai/schemas";

/**
 * Compiled once at module load and reused for every request — AJV
 * compilation is relatively expensive, validation itself is not.
 * `allErrors: true` so a single invalid request reports every
 * violated field at once, not just the first.
 */
const ajv = new Ajv({ allErrors: true, removeAdditional: false, useDefaults: true });

export const validateCreateAIRequest: ValidateFunction = ajv.compile(createAiRequestSchema);

/** Renders AJV's error array into the `details` object of the standard error envelope (see docs/api-conventions.md). */
export function formatAjvErrors(errors: ValidateFunction["errors"]): Record<string, unknown> {
  return {
    violations: (errors ?? []).map((err) => ({
      path: err.instancePath || "/",
      message: err.message,
    })),
  };
}
