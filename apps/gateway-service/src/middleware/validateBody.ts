import type { NextFunction, Request, Response } from "express";
import type { ValidateFunction } from "ajv";
import { HttpError } from "@aegisai/shared-types";
import { formatAjvErrors } from "../schemas/create-ai-request.schema";

/**
 * Generic AJV request-body validation middleware. On success, `req.body`
 * is replaced with the validated (and AJV-`useDefaults`-populated)
 * value; on failure, a single `400 VALIDATION_ERROR` is raised in the
 * project's standard error envelope (see docs/api-conventions.md),
 * with every violated field listed in `details.violations`.
 */
export function validateBody(validate: ValidateFunction) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const body = req.body ?? {};
    const valid = validate(body);
    if (!valid) {
      next(new HttpError(400, "VALIDATION_ERROR", "Request body failed schema validation.", formatAjvErrors(validate.errors)));
      return;
    }
    // AJV mutates `body` in place when `useDefaults` fills in a missing
    // optional field (e.g. `modelPreference`), so this also carries
    // those defaults forward to the controller/service.
    req.body = body;
    next();
  };
}
