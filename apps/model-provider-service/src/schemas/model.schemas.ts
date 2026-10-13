import { JSONSchemaType } from "ajv";
import type { CreateModelInput, UpdateModelInput } from "../repositories/model.repository";

export const createModelSchema: JSONSchemaType<CreateModelInput> = {
  type: "object",
  properties: {
    providerId: { type: "string" },
    name: { type: "string", minLength: 1 },
    capabilities: { type: "array", items: { type: "string" } },
    sensitivityLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
    costMetadata: {
      type: "object",
      properties: {
        inputCostPer1k: { type: "number" },
        outputCostPer1k: { type: "number" },
        currency: { type: "string" },
      },
      required: ["inputCostPer1k", "outputCostPer1k", "currency"],
    },
    active: { type: "boolean" },
    configuration: { type: "object", additionalProperties: true, required: [] },
  },
  required: ["providerId", "name", "capabilities", "sensitivityLevel", "costMetadata", "active", "configuration"],
  additionalProperties: false,
};

export const updateModelSchema: JSONSchemaType<UpdateModelInput> = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, nullable: true },
    capabilities: { type: "array", items: { type: "string" }, nullable: true },
    sensitivityLevel: { type: "string", enum: ["low", "medium", "high", "critical"], nullable: true },
    costMetadata: {
      type: "object",
      properties: {
        inputCostPer1k: { type: "number" },
        outputCostPer1k: { type: "number" },
        currency: { type: "string" },
      },
      nullable: true,
      required: ["inputCostPer1k", "outputCostPer1k", "currency"],
    },
    active: { type: "boolean", nullable: true },
    configuration: { type: "object", additionalProperties: true, nullable: true, required: [] },
  },
  additionalProperties: false,
};
