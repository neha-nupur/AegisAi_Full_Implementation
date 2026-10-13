import type { NextFunction, Request, Response } from "express";
import type { ValidateFunction } from "ajv";
import { HttpError } from "@aegisai/shared-types";
import { formatAjvErrors } from "../schemas/policy.schemas";

/** Same generic AJV body-validation middleware as gateway-service's `validateBody` — duplicated rather than shared because it is a few lines of glue, not domain logic worth a new shared package for. */
export function validateBody(validate: ValidateFunction) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const body = req.body ?? {};
    const valid = validate(body);
    if (!valid) {
      next(new HttpError(400, "VALIDATION_ERROR", "Request body failed schema validation.", formatAjvErrors(validate.errors)));
      return;
    }
    req.body = body;
    next();
  };
}
