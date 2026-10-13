import { Request, Response, NextFunction } from "express";
import { ValidateFunction } from "ajv";
import { HttpError } from "@aegisai/shared-types";

/** Same generic AJV body-validation middleware as gateway-service's `validateBody` */
export function validateBody(validate: ValidateFunction) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req.body || {};
    const valid = validate(data);
    if (!valid) {
      next(new HttpError(400, "VALIDATION_ERROR", "Invalid request body", { errors: validate.errors }));
      return;
    }
    req.body = data;
    next();
  };
}
