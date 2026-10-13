import cors from "cors";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import type { AegisAIConfig } from "@aegisai/config";
import { identityApiRouter, identityRouter } from "@aegisai/identity-service";
import { AiRequestsService, PgAiRequestsRepository, createGatewayApiRouter, gatewayRouter } from "@aegisai/gateway-service";
import { privacyRouter } from "@aegisai/privacy-service";
import { ApprovalsService, PgApprovalsRepository, PoliciesService, PgPoliciesRepository, createPolicyApiRouter, policyRouter } from "@aegisai/policy-service";
import { modelProviderRouter } from "@aegisai/model-provider-service";
import { securityAuditRouter, AuditService, createSecurityAuditApiRouter } from "@aegisai/security-audit-service";
import { correlationIdMiddleware } from "./middleware/correlationId";
import { contentNegotiationMiddleware } from "./middleware/contentNegotiation";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger } from "./logger";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs } from "./graphql/schema";
import { resolvers, type GraphQLContext } from "./graphql/resolvers";
import { authenticateJWT, type AuthenticatedPrincipal } from "@aegisai/identity-service";
import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import swaggerUi from "swagger-ui-express";

/**
 * Builds the Express application. Kept separate from the process
 * bootstrap (src/index.ts) so tests can import and exercise the app
 * without binding a real port.
 *
 * Phase 0 scope: middleware foundation (JSON parsing, CORS,
 * correlation ID, request logging, central error handling) plus the
 * host-level /health endpoint.
 *
 * Phase 1 scope: each of the six services' routers is mounted under
 * its own /v1/<service> prefix, giving every service a real,
 * independently reachable GET /health — while still running
 * in-process as a modular monolith (CLAUDE.md section 14).
 *
 * Phase 2 scope: Identity's business API (`/v1/auth/login`,
 * `/v1/users`, `/v1/service-accounts`, `/v1/organizations/:id`) is
 * mounted directly at `/v1` — resource-shaped URLs, not nested under
 * `/v1/identity` (see docs/api-conventions.md). `/v1/identity/health`
 * is unaffected.
 *
 * Phase 3 scope: the Gateway's business API (`POST /v1/ai-requests`,
 * `GET /v1/ai-requests`, `GET /v1/ai-requests/:id`) is mounted the
 * same way, at `/v1` directly. It is built here (not as the
 * package's default singleton) so it can be given this process's
 * shared Pino `logger` for the structured per-transition audit events
 * `AiRequestsService` emits (see that service's doc comment for why
 * this is Phase 3's stand-in for real Security & Audit persistence,
 * which is Phase 8 scope).
 *
 * Phase 4 scope: Policy & Approval's business API (`/v1/policies`,
 * `/v1/approvals`) is mounted the same way. Gateway's
 * `AiRequestsService` and Policy's `ApprovalsService` have a genuine
 * two-way runtime dependency (submitting a request that needs human
 * approval creates an `Approval`; deciding that `Approval` resumes
 * the `AIRequest`) without either service's *package* depending on
 * the other's — see `AiRequestsService`'s `ApprovalCreator` and
 * `ApprovalsService`'s `ApprovalResumeHandler` doc comments. This
 * function is the composition root that ties the knot: both services
 * are constructed here, each handed a structural reference to the
 * other, since neither can be fully constructed before the other
  * exists.
 *
 * Phase 10 scope: XML content negotiation is applied globally (see
 * `contentNegotiationMiddleware`'s doc comment) — every JSON response
 * from any mounted router can also be returned as XML via
 * `Accept: application/xml`. The legacy SOAP connector
 * (`LegacyEmployeeClient`, in `@aegisai/identity-service`) is mounted
 * as part of `identityApiRouter` above (`GET
 * /v1/legacy-employees/:employeeId`) — it is not wired in here
 * separately, and it is never called from the AI request flow, per
 * the Phase 10 instructions ("Do not make SOAP a core dependency of
 * normal AI request processing").
 */
export async function createApp(config: AegisAIConfig): Promise<Express> {
  const app = express();

  app.disable("x-powered-by");

  app.use(correlationIdMiddleware);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).correlationId,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    })
  );

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );

  app.use(express.json());
  
  // Parse XML body for Phase 10 (SOAP/XML integration)
  const xmlparser = require("express-xml-bodyparser");
  app.use(xmlparser({
    explicitArray: false,
    normalize: true,
    normalizeTags: true
  }));

  // Phase 10: XML content negotiation. Applied globally, right after
  // JSON body parsing and before any route — see the doc comment in
  // contentNegotiation.ts for why a global wrap of res.json is
  // correct here rather than an opt-in per route.
  app.use(contentNegotiationMiddleware);

  app.get("/", (_req, res) => {
    res.status(200).json({
      status: "success",
      message: "AegisAI backend server is running",
    });
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Phase 11: Swagger UI, serving the hand-written OpenAPI document
  // (openapi/openapi.yaml) at /docs. No auth — same reasoning as
  // /health: API documentation is meant to be publicly reachable so
  // integrators can discover the contract before they have a token.
  // Loaded once at startup (not per-request) since the document is
  // static; a process restart is required to pick up edits to the
  // YAML file, which is the standard, acceptable trade-off for a
  // hand-written spec that changes only alongside code changes.
  const openApiDocument = yaml.load(
    fs.readFileSync(path.join(__dirname, "..", "..", "..", "openapi", "openapi.yaml"), "utf8")
  ) as Record<string, unknown>;
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get("/openapi.json", (_req, res) => res.json(openApiDocument));

  // Each service's router (currently just its own GET /health) is
  // mounted under its logical /v1/<service> prefix.
  app.use("/v1/identity", identityRouter);
  app.use("/v1/gateway", gatewayRouter);
  app.use("/v1/privacy", privacyRouter);
  app.use("/v1/policy", policyRouter);
  app.use("/v1/model-provider", modelProviderRouter);
  app.use("/v1/security-audit", securityAuditRouter);

  // Phase 2: Identity's public resource API, mounted at /v1 directly
  // (not /v1/identity — see the note above).
  app.use("/v1", identityApiRouter);

  // Phase 4: tie the Gateway <-> Policy knot (see the doc comment
  // above). `aiRequestsService` is constructed first with no
  // approval-creation capability yet; `approvalsService` is
  // constructed next, wired with a resume handler that calls back
  // into `aiRequestsService`; then `aiRequestsService` is handed
  // `approvalsService` (which structurally satisfies its
  // `ApprovalCreator` interface) via `setApprovalCreator`.
  
  const auditService = new AuditService();
  const aiRequestsService = new AiRequestsService(new PgAiRequestsRepository(), undefined, undefined, undefined, undefined, logger, undefined, undefined, auditService);
  const approvalsService = new ApprovalsService(new PgApprovalsRepository(), {
    onApprovalDecided: (aiRequestId, decision, reason) => aiRequestsService.resumeAfterApproval(aiRequestId, decision, reason),
  });
  const policiesService = new PoliciesService(new PgPoliciesRepository());
  aiRequestsService.setApprovalCreator(approvalsService);

  app.use("/v1", createGatewayApiRouter({ aiRequestsService }));
  app.use("/v1", createPolicyApiRouter({ approvalsService }));

  // Phase 11: Security & Audit's query API — see
  // createSecurityAuditApiRouter's doc comment for what this fixed
  // (it was previously unreachable and unauthenticated).
  app.use("/v1", createSecurityAuditApiRouter());

  // Phase 9: GraphQL endpoint
  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
  });

  await server.start();
  app.use(
    "/v1/graphql",
    authenticateJWT,
    expressMiddleware(server, {
      context: async ({ req }) => {
        const user = (req as any).principal as AuthenticatedPrincipal;
        return {
          user,
          aiRequestsService,
          approvalsService,
          policiesService,
        };
      },
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
