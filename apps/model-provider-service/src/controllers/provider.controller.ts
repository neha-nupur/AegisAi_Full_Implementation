import { Request, Response, NextFunction } from "express";
import { HttpError } from "@aegisai/shared-types";
import { ProviderRepository, PgProviderRepository } from "../repositories/provider.repository";

// In a real app we'd inject this via a DI container, but for this phase we instantiate it directly.
const repository: ProviderRepository = new PgProviderRepository();

export class ProviderController {
  static async listProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const providers = await repository.listAll();
      res.json({
        data: providers,
        traceId: req.headers["x-trace-id"] || "missing-trace-id"
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = await repository.findById(req.params.id);
      if (!provider) {
        throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found");
      }
      res.json({
        data: provider,
        traceId: req.headers["x-trace-id"] || "missing-trace-id"
      });
    } catch (error) {
      next(error);
    }
  }

  static async createProvider(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate req.body in a real app with AJV (Phase 6)
      const provider = await repository.create(req.body);
      res.status(201).json({
        data: provider,
        traceId: req.headers["x-trace-id"] || "missing-trace-id"
      });
    } catch (error) {
      next(error);
    }
  }
}
