import Ajv from "ajv";
import { createProviderSchema, updateProviderSchema } from "./provider.schemas";
import { createModelSchema, updateModelSchema } from "./model.schemas";

const ajv = new Ajv({ allErrors: true });

export const validateCreateProvider = ajv.compile(createProviderSchema);
export const validateUpdateProvider = ajv.compile(updateProviderSchema);

export const validateCreateModel = ajv.compile(createModelSchema);
export const validateUpdateModel = ajv.compile(updateModelSchema);
