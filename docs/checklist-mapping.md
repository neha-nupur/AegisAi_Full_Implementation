# AegisAI — 28-Item Checklist Mapping

Tracks the professor's 28 requirements against the phase that
introduces them and current status. A requirement is only "Done" once
it has an implementation, a test where appropriate, documentation, and
can be demonstrated — not merely because code exists.

| # | Requirement | Target Phase | Status |
|---|---|---|---|
| 1 | Correct HTTP method for every operation | 3+ | **Done** — every service's business routes use GET/POST/PATCH/DELETE correctly: Identity (2), Gateway (3), Policy (4), Model & Provider (5), Security & Audit (11, wired up during Phase 11 hardening — see item 23's note) |
| 2 | Idempotency key on a POST | 6 | **Done** — `POST /v1/ai-requests` requires `Idempotency-Key` and uses Redis to prevent duplicate processing |
| 3 | JSON Schema validation using AJV | 3 | **Done** — `POST /v1/ai-requests` (Phase 3, `@aegisai/schemas`'s `createAiRequestSchema`); `POST`/`PATCH /v1/policies` and the approve/reject bodies (Phase 4, `apps/policy-service/src/schemas/policy.schemas.ts`) |
| 4 | Versioning under `/v1` | 3 | **Done** — every service's `GET /v1/<service>/health`, plus every business route, live under `/v1` |
| 5 | At least 8 distinct HTTP status codes | 3+ | **Done** — 200, 201, 204, 304, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504 (the last two added by the Phase 10 SOAP connector) are all produced across the API |
| 6 | ETag and a working 304 | 6 | **Done** — `GET /v1/ai-requests/:id` and other routes respond with weak ETags based on response hash |
| 7 | Content negotiation (JSON/XML) | 10 | **Done** — global `contentNegotiationMiddleware` in `apps/api` wraps every route's `res.json()`; `Accept: application/xml` (and not also `application/json`) returns the same logical response body serialized as XML under a `<response>` root — see `apps/api/src/middleware/contentNegotiation.ts` and `apps/api/test/content-negotiation.test.ts` |
| 8 | Cursor pagination with a next link | 6 | **Done** — `GET /v1/ai-requests` accepts `?cursor` and `?limit` and returns `{ data, meta: { nextCursor, limit } }` |
| 9 | One consistent error body | 0 | **Done** — `errorHandler` + `ApiErrorBody` |
| 10 | Deliberate `Cache-Control` on every GET | 6 | **Done** — `GET` lists return `no-cache`, `GET` single resources return `max-age=30` |
| 11 | Resource-shaped URLs, no verbs | 3+ | **Done** — `/v1/users`, `/v1/service-accounts`, `/v1/organizations/:id`, `/v1/legacy-employees/:employeeId`, `/v1/ai-requests`, `/v1/policies`, `/v1/providers`, `/v1/models`, `/v1/traces`, `/v1/audit-events`, `/v1/security-events`; `/v1/auth/login` and `/v1/approvals/:id/approve\|reject` are the accepted exceptions (session creation and a state-transition action on a sub-resource, not raw CRUD verbs on the primary resource — both widely used REST conventions) |
| 12 | Rate-limit headers and a 429 | 6 | **Done** — Gateway routes return `X-RateLimit-*` and 429 with `Retry-After` using Redis sliding/fixed window |
| 13 | Hand-written OpenAPI document | 11 | **Done** — `openapi/openapi.yaml` (29 paths, 26 schemas), served raw at `GET /openapi.json` and via Swagger UI at `/docs` |
| 14 | GraphQL endpoint alongside REST | 9 | **Done** — `POST /v1/graphql` (Apollo Server, JWT-protected) is live with real resolvers in `apps/api/src/graphql/` (user, aiRequests, policies, approvals). The React frontend dashboard consumes this for AI Requests, proving coexistence with REST API calls used elsewhere across the 11-screen control-plane UI. |
| 15 | Circuit breaker | 7 | **Done** — `ResilientProviderAdapter` uses `cockatiel` to trip circuit after 5 failures, protecting providers from cascade failures |
| 16 | SQL database with parameterized queries | 2+ | **Done** — `organizations`/`users`/`service_accounts` (Phase 2), `ai_requests` (Phase 3), `policies`/`approvals` (Phase 4) in PostgreSQL, all queries parameterized via `pg` |
| 17 | CORS configured deliberately | 0 | **Done** — `cors()` reads `CORS_ORIGINS` from config |
| 18 | Deployed and reachable over the internet | 11 | Not started — no internet-facing deployment exists; verified locally only (see `docs/deployment.md`'s honest status) |
| 19 | Swagger UI served from own service | 11 | **Done** — served at `GET /docs` from `apps/api` itself, no separate service needed |
| 20 | Timeout on every outbound call | 7 | **Done** — `ResilientProviderAdapter` enforces a strict 30s timeout on all outbound `generate()` calls |
| 21 | Express middleware and central error handling | 0 | **Done** — correlation ID, error handler, 404 handler |
| 22 | NoSQL document store | 0 (infra) / 4+ (usage) | **Done** — MongoDB `scanner_results` (Phase 4), via the official `mongodb` driver in `apps/privacy-service/src/db/mongo.ts` |
| 23 | Automated tests with Jest and Supertest | 0+ | **Done** — 146 tests across 33 suites (unit, integration, resilience) covering every service; includes a Phase 11 regression suite (`apps/security-audit-service/tests/api.routes.test.ts`) proving a real pre-existing auth gap in the Security & Audit query API is closed — see `docs/phase-progress.md`'s Phase 11 section |
| 24 | Reading a WSDL, and one SOAP call | 10 | **Done** — `soap-mock/service.wsdl` + `soap-mock/server/index.js` (a real SOAP 1.1 `CheckLegacyEmployee` service); `LegacyEmployeeClient` (`apps/identity-service/src/integrations/soap/`) parses the WSDL, makes real SOAP calls with timeout/retry/circuit breaker (`cockatiel`), and propagates the correlation ID as a SOAP header — exposed at `GET /v1/legacy-employees/:employeeId`, tested against a real ephemeral local SOAP server in `tests/legacy-employee.client.test.ts` |
| 25 | Retry with increasing backoff | 7 | **Done** — `ResilientProviderAdapter` retries up to 3 times with exponential backoff on retryable HTTP errors (429, 500+) |
| 26 | Structured logging with a correlation ID | 0 | **Done** — Pino + `correlationIdMiddleware`; fully integrated with persistent audit trails and request tracing in the security-audit-service (Phase 8) |
| 27 | JWT authentication and authorization | 2 | **Done** — `POST /v1/auth/login`, `authenticateJWT`/`requireRole`/`requirePermission` (see the C1–C5 mapping and `apps/identity-service/README.md`); reused as-is to protect `/v1/ai-requests` (Phase 3) and `/v1/policies`/`/v1/approvals` (Phase 4) |
| 28 | Docker, and twelve-factor configuration | 0 (infra) / 11 (full) | **Done, not build-verified** — `docker-compose.yml` covers all 7 services (postgres, mongo, redis, soap-mock, api, worker, frontend) with healthcheck-gated startup order; `.env.example` + typed config throughout. Docker itself is unavailable in the sandbox this was built in, so the images were never actually built or run — see `docs/deployment.md` |

## Identity & Access Management — C1–C5 mapping (Phase 2)

The Phase 2 instructions asked for "C1–C5" and "professor requirement
#27" to be mapped to the implementation. **C1–C5 don't appear
anywhere else in this repository or in `CLAUDE.md`**, so this mapping
is an inference — each `C` is matched to one of the five labeled
sections of the Phase 2 instructions themselves, in order. If your
rubric defines C1–C5 differently, tell me and this table gets
corrected; nothing else in the implementation depends on this
labeling.

| # | Phase 2 section | What it covers | Implementation |
|---|---|---|---|
| C1 | Data model | `organizations`, `users`, `service_accounts` with PKs, FKs, unique constraints, timestamps, indexes; no plaintext passwords | `apps/identity-service/src/db/schema.ts`, `db/migrate.ts` |
| C2 | Users | create / read / update / disable; roles `ORGANIZATION_ADMIN`, `DEVELOPER`, `SECURITY_AUDITOR`; service accounts are a separate identity kind | `services/users.service.ts`, `repositories/users.repository.ts`, `domain/rbac.ts` |
| C3 | Authentication | `POST /v1/auth/login`, bcrypt password hashing, JWT with `sub`/`organizationId`/`role`/`permissions`/`iat`/`exp` | `services/auth.service.ts`, `services/password.service.ts`, `services/token.service.ts` |
| C4 | Authorization | `authenticateJWT()`, `requireRole()`, `requirePermission()`; 401 on missing/invalid token, 403 on insufficient role/permission | `middleware/authenticateJWT.ts`, `requireRole.ts`, `requirePermission.ts` |
| C5 | Service accounts | creation and lifecycle management; organization, name, status, permissions, credential representation; secrets returned exactly once | `services/service-accounts.service.ts`, `repositories/service-accounts.repository.ts` |

**Professor requirement #27** ("JWT authentication and authorization")
is item 27 in the 28-item table above — now **Done**, implemented by
C3 + C4 together.
