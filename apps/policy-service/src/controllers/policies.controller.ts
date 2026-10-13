import type { NextFunction, Request, Response } from "express";
import type { PoliciesService } from "../services/policies.service";

export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const policy = await this.policiesService.create(req.body, req.principal!);
      res.status(201).json({ data: policy, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const policy = await this.policiesService.getById(req.params.id, req.principal!);
      res.status(200).json({ data: policy, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const policies = await this.policiesService.list(req.principal!);
      res.status(200).json({ data: policies, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const policy = await this.policiesService.update(req.params.id, req.body, req.principal!);
      res.status(200).json({ data: policy, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.policiesService.delete(req.params.id, req.principal!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
