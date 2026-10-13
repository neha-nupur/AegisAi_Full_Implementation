import { JSONSchemaType } from "ajv";
import type { CreateProviderInput, UpdateProviderInput } from "../repositories/provider.repository";

export const createProviderSchema: JSONSchemaType<CreateProviderInput> = {
  type: "object",
  properties: {
    organizationId: { type: "string", nullable: true },
    name: { type: "string", minLength: 1 },
    type: { type: "string", enum: ["openai", "anthropic", "mock", "bedrock"] },
    baseUrl: { type: "string" },
    status: { type: "string", enum: ["active", "inactive", "deprecated"] },
    healthStatus: { type: "string", enum: ["healthy", "degraded", "unhealthy", "unknown"] },
    priority: { type: "integer", minimum: 1 },
    configurationReference: { type: "string", minLength: 1 },
  },
  required: ["name", "type", "baseUrl", "status", "healthStatus", "priority", "configurationReference"],
  additionalProperties: false,
};

export const updateProviderSchema: JSONSchemaType<UpdateProviderInput> = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, nullable: true },
    baseUrl: { type: "string", nullable: true },
    status: { type: "string", enum: ["active", "inactive", "deprecated"], nullable: true },
    healthStatus: { type: "string", enum: ["healthy", "degraded", "unhealthy", "unknown"], nullable: true },
    priority: { type: "integer", minimum: 1, nullable: true },
    configurationReference: { type: "string", minLength: 1, nullable: true },
  },
  additionalProperties: false,
};
