import type { NextFunction, Request, Response } from "express";
import type { SettingsService } from "../services/settings.service";
import type { UpdateSettingsInput } from "../types/settings.types";
import { HttpError } from "@aegisai/shared-types";

const ALLOWED_FIELDS: Set<string> = new Set([
  "defaultModelPreference",
  "defaultPolicyName",
  "sessionTimeoutMinutes",
  "requireApprovalForSensitive",
  "privacyScanningEnabled",
  "autoMaskingEnabled",
  "requestTimeoutMs",
  "maxInputLength",
  "requestsPerMinute",
  "auditLoggingEnabled",
]);

export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.principal!;
      const settings = await this.service.get(organizationId);
      res.json({ data: settings });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId, userId } = req.principal!;
      const body = req.body ?? {};

      // Validate: only known fields, no extra keys
      const unknownFields = Object.keys(body).filter((k) => !ALLOWED_FIELDS.has(k));
      if (unknownFields.length > 0) {
        throw new HttpError(400, "VALIDATION_ERROR", `Unknown settings fields: ${unknownFields.join(", ")}`);
      }

      // Type-check numeric / boolean fields that were provided
      if ("sessionTimeoutMinutes" in body && (!Number.isInteger(body.sessionTimeoutMinutes) || body.sessionTimeoutMinutes < 1 || body.sessionTimeoutMinutes > 1440)) {
        throw new HttpError(400, "VALIDATION_ERROR", "sessionTimeoutMinutes must be an integer between 1 and 1440.");
      }
      if ("requestTimeoutMs" in body && (!Number.isInteger(body.requestTimeoutMs) || body.requestTimeoutMs < 1000 || body.requestTimeoutMs > 120000)) {
        throw new HttpError(400, "VALIDATION_ERROR", "requestTimeoutMs must be an integer between 1000 and 120000.");
      }
      if ("maxInputLength" in body && (!Number.isInteger(body.maxInputLength) || body.maxInputLength < 100 || body.maxInputLength > 100000)) {
        throw new HttpError(400, "VALIDATION_ERROR", "maxInputLength must be an integer between 100 and 100000.");
      }
      if ("requestsPerMinute" in body && (!Number.isInteger(body.requestsPerMinute) || body.requestsPerMinute < 1 || body.requestsPerMinute > 10000)) {
        throw new HttpError(400, "VALIDATION_ERROR", "requestsPerMinute must be an integer between 1 and 10000.");
      }

      const patch = body as UpdateSettingsInput;
      const updated = await this.service.update(
        organizationId,
        userId,
        req.correlationId ?? "unknown",
        patch
      );

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  };
}
