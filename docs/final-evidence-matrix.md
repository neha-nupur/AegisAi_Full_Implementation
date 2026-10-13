# Final Evidence Matrix (Phase 11)

Every row below is one of the 28 checklist requirements from
`docs/checklist-mapping.md`, in the same order, with the richer
evidence Phase 11 asked for: what implements it, what test proves it,
how to demo it by hand, and what was actually verified in this
session versus what's implemented-but-unverified.

**How to read the last column:** "Verified live" means this session
actually ran it against a real dependency (a real local PostgreSQL,
Redis, or SOAP server, all installed and run in this sandbox — see
`docs/phase-progress.md`'s Phase 10/11 sections) and observed the
real result, not just a passing unit test. "Tests pass" means the
automated suite covers it but this session did not additionally drive
it by hand outside the test runner. A bolded gap note means an
honestly-documented limitation (no Docker or MongoDB available in
this sandbox — see `docs/deployment.md`).

| # | Requirement | Implementation | Endpoint / Component | Test | Demo steps | Evidence |
|---|---|---|---|---|---|---|
| 1 | Correct HTTP method for every operation | Every business route uses GET/POST/PATCH/DELETE per REST convention | All `/v1/*` business routes (see `docs/api-conventions.md`) | Every service's route/controller test suite | `curl -X PATCH /v1/policies/:id`, `curl -X DELETE /v1/policies/:id`, etc. | Tests pass (146/146 project-wide) |
| 2 | Idempotency key on a POST | `Idempotency-Key` header required on `POST /v1/ai-requests`; Redis stores the request hash + result | `apps/gateway-service/src/middleware/idempotency.ts` | `apps/gateway-service/tests/idempotency.test.ts` | Submit the same `Idempotency-Key` + body twice → second call returns the first's cached result; same key + different body → `409` | Verified live: fixed a real Redis connection bug (see row 28) that this exact endpoint surfaced, then confirmed idempotency itself works past that fix |
| 3 | JSON Schema validation using AJV | AJV-compiled schemas for AI requests, policies, providers, models | `@aegisai/schemas`, `apps/*/src/schemas/*.schemas.ts` | "invalid request" cases throughout the suite | `POST /v1/ai-requests` with `{}` → `400 VALIDATION_ERROR` with field-level `details.violations` | Tests pass |
| 4 | Versioning under `/v1` | Every route (health and business) lives under `/v1` | `apps/api/src/app.ts`'s mounting | Every route test's URL prefix | `curl /v1/gateway/health` | Verified live |
| 5 | 8+ distinct HTTP status codes | 200/201/204/304/400/401/403/404/409/422/429/500/502/503/504 across the API | Every controller's error paths | Status-code assertions throughout the suite | See `docs/demo-script.md`'s status-code walkthrough | Verified live (login=200, submit=201, delete=204, SOAP timeout=504, circuit open=503, etc.) |
| 6 | ETag and a working 304 | Weak ETag on single-resource GETs; `If-None-Match` → 304 | Gateway's caching middleware | ETag test in gateway-service suite | `curl -I /v1/ai-requests/:id` then repeat with `If-None-Match` | Tests pass |
| 7 | JSON/XML content negotiation | Global `res.json()` wrapper; `Accept: application/xml` returns the same body as XML | `apps/api/src/middleware/contentNegotiation.ts` | `apps/api/test/content-negotiation.test.ts` (5 tests) | `curl -H "Accept: application/xml" /v1/ai-requests/:id` | Verified live + tests pass |
| 8 | Cursor pagination with a next link | `{ items, nextCursor }` on ai-requests/traces/audit-events/security-events | Each resource's `listByOrganization` repository method | `pagination.test.ts` (gateway-service) | `curl "/v1/ai-requests?cursor=...&limit=10"` | Tests pass |
| 9 | One consistent error body | `{ error: { code, message, details?, traceId } }` everywhere | `packages/shared-types`'s `HttpError`/`ApiErrorBody`, `apps/api/src/middleware/errorHandler.ts` | Every service's error-path tests | Any failing request | Verified live throughout this session's demos |
| 10 | Deliberate `Cache-Control` per GET | List = `no-cache`, single resource = `max-age=30`, mutations = `no-store` | `apps/gateway-service/src/middleware/cache-control.ts` | `pagination.test.ts` | `curl -I /v1/ai-requests` vs `/v1/ai-requests/:id` | Tests pass — a real pre-existing bug here (wrong path comparison, since this middleware is mounted on a sub-router) was found and fixed during Phase 10 |
| 11 | Resource-shaped URLs, no verbs | See row 4's route list | Same | Same | Same | Verified live |
| 12 | Rate-limit headers and a 429 | `X-RateLimit-Limit/Remaining`, `Retry-After`, Redis-backed fixed window | `apps/gateway-service/src/middleware/rate-limit.ts` | `rate-limit.test.ts` | Exceed the configured limit on `POST /v1/ai-requests` | Verified live: this endpoint's Redis connection was the exact site of a real deterministic bug found and fixed this session (see row 28) |
| 13 | Hand-written OpenAPI document | 29 paths, 26 schemas, security scheme, examples, error envelope | `openapi/openapi.yaml` | `apps/api/test/docs.test.ts` | `curl /openapi.json` | Verified live: YAML validated, served, and asserted on |
| 14 | GraphQL endpoint alongside REST | Apollo Server at `POST /v1/graphql`, JWT-protected, real resolvers | `apps/api/src/graphql/{schema,resolvers}.ts` | `apps/api/test/graphql.test.ts` (3 tests) | `curl -X POST /v1/graphql -d '{"query":"{ aiRequests(limit: 5) { items { id } } }"}'` | Tests pass. The React dashboard consumes this endpoint to list AI Requests, proving coexistence with REST. |
| 15 | Circuit breaker | `cockatiel` consecutive-failure breaker, opens then half-open recovers | `resilient-provider.adapter.ts`; a second, independent implementation in `LegacyEmployeeClient` (Phase 10) | `resilience.test.ts`, `legacy-employee.client.test.ts` | See `docs/demo-script.md` | Verified live (SOAP connector's circuit trip + fast-fail, confirmed against a real server) |
| 16 | SQL database, parameterized queries | organizations/users/service_accounts, ai_requests, policies/approvals, providers/models — all via `pg` with `$1,$2,...` placeholders | Each service's `repositories/*.ts` | Every repository's tests (in-memory fakes) plus this session's live run | `npm run db:migrate && npm run db:seed` | Verified live against a real local PostgreSQL instance, installed in this sandbox — actual tables created, actual rows inserted and queried |
| 17 | CORS configured deliberately | `cors()` reads `CORS_ORIGINS` from typed config, no wildcard | `apps/api/src/app.ts` | `config.test.ts` | Cross-origin request from an unlisted origin is blocked | Tests pass |
| 18 | Deployed and reachable over the internet | Not done | — | — | — | Not done. No internet-facing deployment exists — see `docs/deployment.md` for what a real deployment needs and why this session couldn't do it |
| 19 | Swagger UI served from own service | Served at `GET /docs` by `apps/api` itself | `apps/api/src/app.ts`'s `swaggerUi.setup(...)` | `apps/api/test/docs.test.ts` | Open `http://localhost:4000/docs` | Verified live |
| 20 | Timeout on every outbound call | 30s (AI providers), 5s (SOAP) | `resilient-provider.adapter.ts`, `legacy-employee.client.ts` | Both services' resilience test suites | Request `employeeId=TIMEOUT` against `soap-mock` | Verified live against a real 10-second-delayed response — also where a real bug in the `cockatiel` library itself was found and fixed |
| 21 | Express middleware, central error handling | Correlation ID, Pino request logging, one `errorHandler`, `notFoundHandler` | `apps/api/src/middleware/` | Every service's error-path tests | Any request | Verified live |
| 22 | NoSQL document store | MongoDB (scanner_results, request_traces, audit_events, security_events) via the official driver | `apps/privacy-service/src/db/mongo.ts`, `apps/security-audit-service/src/db/mongo.ts` | In-memory-fake-backed unit tests throughout | Submit a request containing PII | Not verified live: MongoDB isn't installable in this sandbox. Confirmed the request pipeline runs correctly right up to the Mongo connection attempt (`ECONNREFUSED 127.0.0.1:27017`), with real Postgres+Redis backing everything before it |
| 23 | Automated tests, Jest + Supertest | 146 tests, 33 suites | Every `apps/*/tests/` and `apps/api/test/` | — | `npm test` | Verified live this session: 146/146 passing, including a new regression suite proving a real pre-existing auth gap is closed |
| 24 | Reading a WSDL, one SOAP call | Real WSDL, real SOAP 1.1 service, real connector | `soap-mock/`, `apps/identity-service/src/integrations/soap/legacy-employee.client.ts` | `legacy-employee.client.test.ts` (8 tests) | `curl /v1/legacy-employees/E1001` | Verified live: real WSDL parse, real SOAP request/response over an actual local SOAP server (not a mock of the `soap` library) |
| 25 | Retry with increasing backoff | Exponential backoff, 3 attempts, `cockatiel` | Same as row 15 | Same as row 15 | Request `employeeId=FAIL_ONCE` | Verified live (retry-then-succeed, confirmed with real timing) |
| 26 | Structured logging, correlation ID | Pino, one correlation ID generated at ingress and threaded through every log line and every service's audit events | `apps/api/src/middleware/correlationId.ts`, every service's Pino usage | Every service's tests assert `traceId` presence | Any request, then grep its correlation ID across the logs | Verified live throughout this session |
| 27 | JWT authentication and authorization | Login, `authenticateJWT`/`requireRole`/`requirePermission`, RBAC with 3 roles x N permissions | `apps/identity-service/src/middleware/`, `src/domain/rbac.ts` | Every protected route's 401/403 tests, plus a new regression suite (`apps/security-audit-service/tests/api.routes.test.ts`) written after finding the Security & Audit query API had no authentication at all | Log in, hit a protected route with/without/wrong-role token | Verified live (real login, real JWT, real 401/403/200 outcomes) |
| 28 | Docker, twelve-factor configuration | 7-service `docker-compose.yml` (postgres/mongo/redis/soap-mock/api/worker/frontend), all config via env vars, `.env.example`, no secrets in git | `docker/docker-compose.yml`, `docker/Dockerfile.{api,worker,frontend,soap-mock}` | YAML-validated, not build-verified | `docker compose -f docker/docker-compose.yml up -d --build` | Not build-verified: Docker itself is unavailable in this sandbox. Config/YAML validated; the equivalent real-process versions of api + postgres + redis + soap-mock were run directly and confirmed working together, including finding and fixing a genuine ioredis connection bug that would have affected the containerized deployment identically |

## Summary

- **Passed outright, verified live or by test:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 23, 24, 25, 26, 27
- **Implemented, not live-verified due to sandbox limits:** 22 (no MongoDB available), 28 (no Docker available)
- **Not done:** 18 (no real deployment)

No requirement is claimed as fully done unless it was either directly
exercised in this session or is covered by a passing automated test —
see `docs/phase-progress.md` for the full narrative of what was found
and fixed while producing this evidence, including two real,
independently-reproduced bugs (a `Cache-Control` path-matching bug and
a `cockatiel` library bug affecting every timeout classification) and
one real security gap (the Security & Audit query API had no
authentication and would have hung on its own error paths).
