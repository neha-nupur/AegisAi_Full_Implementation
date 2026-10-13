import type { NextFunction, Request, Response } from "express";
import { ModelProviderHealthService } from "../services/health.service";

/**
 * Thin HTTP adapter: translates the request into a service call and
 * the service's result into a response. No business logic lives here
 * (see CLAUDE.md section 17) — that belongs in ModelProviderHealthService.
 */
export class ModelProviderHealthController {
  constructor(private readonly healthService: ModelProviderHealthService = new ModelProviderHealthService()) {}

  getHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.healthService.getHealth();
      res.status(200).json(status);
    } catch (err) {
      next(err);
    }
  };
}
