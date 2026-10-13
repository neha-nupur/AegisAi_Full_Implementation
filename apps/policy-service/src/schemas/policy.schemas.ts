import Ajv, { type ValidateFunction } from "ajv";
import { POLICY_ACTIONS, POLICY_STATUSES } from "../domain/policy-types";
import { FINDING_TYPES } from "@aegisai/privacy-service";
import { ROLES } from "@aegisai/identity-service";

const ajv = new Ajv({ allErrors: true, useDefaults: true });

const ruleConditionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    findingTypes: { type: "array", items: { enum: [...FINDING_TYPES] }, minItems: 1 },
    roles: { type: "array", items: { enum: [...ROLES] }, minItems: 1 },
    modelPreference: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
    provider: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
  },
} as const;

const ruleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "action"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 100 },
    action: { enum: [...POLICY_ACTIONS] },
    when: ruleConditionSchema,
  },
} as const;

export const createPolicySchema = {
  $id: "aegisai://schemas/create-policy.json",
  type: "object",
  additionalProperties: false,
  required: ["name", "rules"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    rules: { type: "array", items: ruleSchema, minItems: 1 },
    status: { enum: [...POLICY_STATUSES], default: "ACTIVE" },
  },
} as const;

export const updatePolicySchema = {
  $id: "aegisai://schemas/update-policy.json",
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    rules: { type: "array", items: ruleSchema, minItems: 1 },
    status: { enum: [...POLICY_STATUSES] },
  },
} as const;

export const decideApprovalSchema = {
  $id: "aegisai://schemas/decide-approval.json",
  type: "object",
  additionalProperties: false,
  properties: {
    reason: { type: "string", maxLength: 2000 },
  },
} as const;

export const validateCreatePolicy: ValidateFunction = ajv.compile(createPolicySchema);
export const validateUpdatePolicy: ValidateFunction = ajv.compile(updatePolicySchema);
export const validateDecideApproval: ValidateFunction = ajv.compile(decideApprovalSchema);

export function formatAjvErrors(errors: ValidateFunction["errors"]): Record<string, unknown> {
  return { violations: (errors ?? []).map((err) => ({ path: err.instancePath || "/", message: err.message })) };
}
