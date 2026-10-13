import type { NextFunction, Request, Response } from "express";
import type { AiRequestsService } from "../services/ai-requests.service";

export class AiRequestsController {
  constructor(private readonly aiRequestsService: AiRequestsService) {}

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = await this.aiRequestsService.submit(req.body ?? {}, req.principal!, req.correlationId!);
      res.status(201).json({ data: request, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = await this.aiRequestsService.getById(req.params.id, req.principal!);
      res.status(200).json({ data: request, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cursor = req.query.cursor as string | undefined;
      const limitStr = req.query.limit as string | undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : 20;

      // Restrict max limit to 100
      const validLimit = Math.min(Math.max(1, isNaN(limit) ? 20 : limit), 100);

      const result = await this.aiRequestsService.list(req.principal!, validLimit, cursor);
      res.status(200).json({ 
        data: result.items, 
        meta: { 
          nextCursor: result.nextCursor,
          limit: validLimit
        },
        traceId: req.correlationId 
      });
    } catch (err) {
      next(err);
    }
  };
}
