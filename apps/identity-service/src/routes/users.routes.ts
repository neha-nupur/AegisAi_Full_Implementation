import { Router } from "express";
import { UsersController } from "../controllers/users.controller";
import { authenticateJWT } from "../middleware/authenticateJWT";
import { requirePermission } from "../middleware/requirePermission";
import type { UsersService } from "../services/users.service";

export function buildUsersRoutes(usersService: UsersService): Router {
  const router = Router();
  const controller = new UsersController(usersService);

  router.use(authenticateJWT);

  router.get("/users", requirePermission("users:read"), controller.list);
  router.patch("/users/me/password", controller.updatePassword);
  router.post("/users", requirePermission("users:write"), controller.create);
  router.get("/users/:id", requirePermission("users:read"), controller.getById);
  router.patch("/users/:id", requirePermission("users:write"), controller.update);
  router.delete("/users/:id", requirePermission("users:write"), controller.disable);

  return router;
}
