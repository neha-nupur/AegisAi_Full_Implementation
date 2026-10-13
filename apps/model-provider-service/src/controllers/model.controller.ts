import { Request, Response, NextFunction } from "express";
import { HttpError } from "@aegisai/shared-types";
import { ModelRepository, PgModelRepository } from "../repositories/model.repository";

const repository: ModelRepository = new PgModelRepository();

export class ModelController {
  static async listModels(req: Request, res: Response, next: NextFunction) {
    try {
      const models = await repository.listAll();
      res.json({
        data: models,
        traceId: req.headers["x-trace-id"] || "missing-trace-id"
      });
    } catch (error) {
      next(error);
    }
  }

  static async getModel(req: Request, res: Response, next: NextFunction) {
    try {
      const model = await repository.findById(req.params.id);
      if (!model) {
        throw new HttpError(404, "MODEL_NOT_FOUND", "Model not found");
      }
      res.json({
        data: model,
        traceId: req.headers["x-trace-id"] || "missing-trace-id"
      });
    } catch (error) {
      next(error);
    }
  }

  static async createModel(req: Request, res: Response, next: NextFunction) {
    try {
      const model = await repository.create(req.body);
      res.status(201).json({
        data: model,
        traceId: req.headers["x-trace-id"] || "missing-trace-id"
      });
    } catch (error) {
      next(error);
    }
  }
}
