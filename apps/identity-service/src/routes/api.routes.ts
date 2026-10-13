import { Router } from "express";
import { PgOrganizationsRepository } from "../repositories/organizations.repository";
import { PgServiceAccountsRepository } from "../repositories/service-accounts.repository";
import { PgUsersRepository } from "../repositories/users.repository";
import { AuthService } from "../services/auth.service";
import { OrganizationsService } from "../services/organizations.service";
import { ServiceAccountsService } from "../services/service-accounts.service";
import { UsersService } from "../services/users.service";
import { buildAuthRoutes } from "./auth.routes";
import { buildOrganizationsRoutes } from "./organizations.routes";
import { buildServiceAccountsRoutes } from "./service-accounts.routes";
import { buildUsersRoutes } from "./users.routes";
import { buildLegacyEmployeeRoutes } from "./legacy-employee.routes";
import { buildSettingsRoutes } from "./settings.routes";
import { SettingsService } from "../services/settings.service";
import { LegacyEmployeeClient, type SoapLogger } from "../integrations/soap/legacy-employee.client";

export interface IdentityApiDependencies {
  authService?: AuthService;
  usersService?: UsersService;
  serviceAccountsService?: ServiceAccountsService;
  organizationsService?: OrganizationsService;
  settingsService?: SettingsService;
  legacyEmployeeClient?: LegacyEmployeeClient;
  /** Structured logger for the SOAP connector (Phase 10) — same optional-logger convention as `AiRequestsService`'s audit logging. */
  soapLogger?: SoapLogger;
}

/**
 * Builds the Identity service's business API router: `/auth/login`,
 * `/users`, `/service-accounts`, `/organizations/:id` (mounted by
 * `apps/api` at `/v1` — see `docs/api-conventions.md` on why these
 * are NOT nested under `/v1/identity`, unlike `/health`).
 *
 * Phase 10 adds `/legacy-employees/:employeeId`, the demonstration
 * endpoint for `LegacyEmployeeClient` (the SOAP connector — see
 * `integrations/soap/legacy-employee.client.ts`).
 *
 * Repositories are real (`Pg*Repository`) by default, which is what
 * `identityApiRouter` below uses in production. Services accept an
 * override for each dependency so tests can inject in-memory fakes
 * instead of requiring a real PostgreSQL connection — see
 * `tests/support/`.
 *
 * Reads `SOAP_MOCK_URL` directly from `process.env` (with the same
 * default `@aegisai/config` would use) rather than calling
 * `loadConfig()` — `loadConfig()` eagerly validates every required
 * env var across the whole app (`PORT`, `DATABASE_URL`, `JWT_SECRET`,
 * ...), and this file's `identityApiRouter` singleton below is
 * constructed at module-import time. Calling `loadConfig()` here
 * would mean simply `import`-ing `@aegisai/identity-service` (e.g.
 * for `authenticateJWT`, from a service that has nothing to do with
 * SOAP) throws unless the importing process happens to have every
 * one of those unrelated variables set — breaking the same lazy
 * pattern `PgUsersRepository` and friends deliberately preserve.
 */
export function createIdentityApiRouter(deps: IdentityApiDependencies = {}): Router {
  const organizationsRepository = new PgOrganizationsRepository();
  const usersRepository = new PgUsersRepository();
  const serviceAccountsRepository = new PgServiceAccountsRepository();

  const authService = deps.authService ?? new AuthService(usersRepository, organizationsRepository);
  const usersService = deps.usersService ?? new UsersService(usersRepository, organizationsRepository);
  const serviceAccountsService = deps.serviceAccountsService ?? new ServiceAccountsService(serviceAccountsRepository);
  const organizationsService = deps.organizationsService ?? new OrganizationsService(organizationsRepository);
  const settingsService = deps.settingsService ?? new SettingsService();
  const legacyEmployeeClient =
    deps.legacyEmployeeClient ?? new LegacyEmployeeClient(process.env.SOAP_MOCK_URL ?? "http://localhost:5005", deps.soapLogger);

  const router = Router();
  router.use(buildAuthRoutes(authService));
  router.use(buildUsersRoutes(usersService));
  router.use(buildServiceAccountsRoutes(serviceAccountsService));
  router.use(buildOrganizationsRoutes(organizationsService));
  router.use(buildSettingsRoutes(settingsService));
  router.use(buildLegacyEmployeeRoutes(legacyEmployeeClient));

  return router;
}

/**
 * Production singleton — real `Pg*Repository` instances underneath,
 * but note those only touch the database (and therefore only require
 * `DATABASE_URL`) on an actual request, not at import time (see
 * `db/pool.ts`). Its `LegacyEmployeeClient` similarly only connects
 * to `soap-mock` on the first actual `/legacy-employees` request, not
 * at import time (see `getClient()`'s lazy caching).
 */
export const identityApiRouter = createIdentityApiRouter();
