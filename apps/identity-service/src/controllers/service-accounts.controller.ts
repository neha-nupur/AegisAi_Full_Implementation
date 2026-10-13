import type { NextFunction, Request, Response } from "express";
import type { ServiceAccountsService } from "../services/service-accounts.service";

export class ServiceAccountsController {
  constructor(private readonly serviceAccountsService: ServiceAccountsService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.serviceAccountsService.create(req.body ?? {}, req.principal!);
      // The plaintext credential is returned exactly once, here, at creation.
      res.status(201).json({ data: result, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accounts = await this.serviceAccountsService.list(req.principal!);
      res.status(200).json({ data: accounts, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = await this.serviceAccountsService.update(req.params.id, req.body ?? {}, req.principal!);
      res.status(200).json({ data: account, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  disable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = await this.serviceAccountsService.disable(req.params.id, req.principal!);
      res.status(200).json({ data: account, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };
}
