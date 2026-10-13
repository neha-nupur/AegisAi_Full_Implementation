# AegisAI — Phase Progress

| Phase | Description | Status |
|---|---|---|
| 0 | Foundation and project structure | **Done** |
| 1 | Six service boundaries | **Done** |
| 2 | Identity, authentication and authorization | **Done** |
| 3 | AI Gateway + first vertical slice | **Done** |
| 4 | Privacy Scanner + Policy + Approval | **Done** |
| 5 | Model & Provider Management + real AI provider | **Done** |
| 6 | Redis + HTTP/Web Service requirements | **Done** |
| 7 | Timeout + Retry + Circuit Breaker + fallback | **Done** |
| 8 | Security + Audit + Observability | **Done** |
| 9 | Frontend + GraphQL | **Done** |
| 10 | SOAP/WSDL + XML interoperability | **Done** |
| 11 | Testing + Docker + deployment + final 28-item verification | Not started |

## Phase 0 — detail

See the end-of-phase report delivered with this phase for the full
breakdown (files created, dependencies, test/build/typecheck results,
verification steps, known limitations, architectural decisions).

## Phase 1 — detail

Each of the six services (`apps/identity-service`,
`apps/gateway-service`, `apps/privacy-service`, `apps/policy-service`,
`apps/model-provider-service`, `apps/security-audit-service`) now has
the full `routes/ -> controllers/ -> services/ -> repositories/`
layering (plus `schemas/`, `middleware/`, `types/`, `tests/`), a
working `GET /health` through that layering, and implements the
health portion of its contract in `packages/shared-types`
(`ServiceContract` and the six per-service aliases). `apps/api` mounts
every service's router under `/v1/<service>`. See
`docs/service-boundaries.md` for the full per-service breakdown
(responsibility, owned entities, inputs, outputs, dependencies,
communication direction) and the end-of-phase report delivered with
this phase for files created, dependencies, and verification results.

## Phase 2 — detail

Identity & Access Management is now a real, PostgreSQL-backed
service — the first to move beyond the Phase 1 health-only shell.

- **Data model:** `organizations`, `users`, `service_accounts` (see
  `docs/database-ownership.md`). No plaintext passwords or
  credentials — bcrypt hashes only.
- **Users:** create / read / update / disable, scoped to the caller's
  organization; roles `ORGANIZATION_ADMIN`, `DEVELOPER`,
  `SECURITY_AUDITOR`.
- **Authentication:** `POST /v1/auth/login` — bcrypt password
  verification, JWT issuance with minimal claims (`sub`,
  `organizationId`, `role`, `permissions`, `iat`, `exp`).
- **Authorization:** `authenticateJWT()`, `requireRole()`,
  `requirePermission()` middleware — 401 on missing/invalid/expired
  token, 403 on insufficient role/permission.
- **Service accounts:** creation and lifecycle management, with a
  generated credential returned exactly once.
- **Multi-tenancy:** every operation is scoped to the caller's
  `organizationId`; cross-organization access returns 404, not 403.
- **Mounting:** two routers — `identityRouter` (health, at
  `/v1/identity`, unchanged since Phase 1) and the new
  `identityApiRouter` (business routes, mounted directly at `/v1` —
  see `docs/api-conventions.md` for why).
- **Tests:** `apps/identity-service/tests/` covers every scenario the
  phase asked for (valid login, invalid password, unknown user,
  disabled user, expired/invalid/missing JWT, wrong/correct role,
  cross-organization access) against in-memory fake repositories, so
  the suite runs without a live database.

See `apps/identity-service/README.md` for the full endpoint table and
RBAC model, `docs/checklist-mapping.md` for the C1–C5 requirement
mapping, and the end-of-phase report delivered with this phase for
files created, dependencies, and verification results.

## Phase 3 — detail

The AI Request Gateway is now real, PostgreSQL-backed, and forms the
project's first true end-to-end vertical slice: a logged-in user
submits an AI request and gets back a controlled response.

- **Data model:** `ai_requests` (see `docs/database-ownership.md`) —
  no foreign keys into Identity's tables, by design.
- **Lifecycle:** `RECEIVED -> VALIDATED -> ROUTING -> PROVIDER_CALL ->
  COMPLETED | FAILED`, driven by `AiRequestsService`
  (`apps/gateway-service/src/services/ai-requests.service.ts`).
- **Auth:** Identity's `authenticateJWT`/`requirePermission`
  middleware, reused unchanged — exactly as `api-conventions.md`
  anticipated. Two new permissions, `ai_requests:read` /
  `ai_requests:write`, added to `apps/identity-service`'s RBAC model
  (the single owner of permission strings) and granted to
  `ORGANIZATION_ADMIN`/`DEVELOPER` (read+write) and
  `SECURITY_AUDITOR` (read-only).
- **Validation:** AJV, via a new shared schema
  (`@aegisai/schemas`'s `createAiRequestSchema`) and a generic
  `validateBody()` middleware in gateway-service.
- **Provider:** a `ProviderAdapter` interface + `MockProviderAdapter`,
  living inside `gateway-service` for now (not
  `apps/model-provider-service` — see `service-boundaries.md` for
  why: that service's real registry/routing is Phase 5 scope).
- **Design decision:** synchronous request handling (see
  `api-conventions.md`'s Gateway section) — documented, not left
  implicit, per the Phase 3 instructions.
- **Audit:** structured Pino log events per state transition,
  standing in for Phase 8's real `security-audit-service` MongoDB
  persistence (also explicitly deferred — see
  `service-boundaries.md`).
- **Tests:** `apps/gateway-service/tests/ai-requests.test.ts` covers
  every scenario the phase asked for (valid request, invalid request,
  missing JWT, wrong organization, unknown request, provider
  failure) plus role enforcement, against an in-memory fake
  repository.

See `apps/gateway-service/README.md` for the full endpoint table and
`docs/checklist-mapping.md` for the updated 28-item status, and the
end-of-phase report delivered with this phase for files
created/modified, dependencies, and verification results.

## Phase 4 — detail

Privacy Scanner and Policy & Approval are now real, and the Gateway's
flow runs both in the middle of every request.

- **Privacy Scanner** (`apps/privacy-service`): deterministic
  regex-based detectors (email, phone, PAN-like, Aadhaar-like,
  API-key/secret, password/credential) plus a configurable
  sensitive-keyword list. `PrivacyScanner.scan()` returns exactly
  `{ detected, findings: [{ type, location, confidence, action }] }`
  — never the matched substring, anywhere, at the source. Results
  persist to MongoDB's `scanner_results` (this project's first
  MongoDB usage), storing only type/location/confidence/action per
  finding.
- **Policy & Approval** (`apps/policy-service`): full policy CRUD
  (`/v1/policies`), a first-match-wins rule engine
  (`evaluatePolicy`) that fails closed to `BLOCK` if nothing matches,
  a built-in default policy (`buildDefaultPolicy`, never persisted)
  covering the four required demo outcomes out of the box, and the
  human approval workflow (`/v1/approvals/:id/approve|reject`).
- **Gateway integration**: the flow between `VALIDATED` and `ROUTING`
  now runs Privacy Scan then Policy Evaluation (both in-process).
  Two new lifecycle states, `BLOCKED` and `APPROVAL_REQUIRED`, branch
  off before the provider is ever called. MASK reaches the provider
  with `PrivacyScanner.redact()`'s output, never the raw text.
- **The approval-resume knot**: `AiRequestsService` (Gateway) and
  `ApprovalsService` (Policy) have a genuine two-way runtime
  dependency without either package importing the other — see
  `service-boundaries.md`'s "approval-resume knot" section for the
  dependency-inversion pattern (`ApprovalCreator` /
  `ApprovalResumeHandler`), wired together in `apps/api/src/app.ts`.
- **RBAC**: `policies:read/write` and `approvals:read/write`
  permissions added to Identity's RBAC model — `ORGANIZATION_ADMIN`
  full access, `DEVELOPER`/`SECURITY_AUDITOR` read-only (deciding
  approvals and authoring policy are administrative acts).
- **Tests**: 14 new privacy-service tests (every detector, masking,
  "never stores raw secrets"), 23 new policy-service tests (rule
  engine, CRUD, approval workflow, org isolation), and gateway-service's
  suite grew to cover PII→MASK, secret→BLOCK,
  keyword→REQUIRE_APPROVAL, approved→continues-to-provider, and
  rejected→BLOCKED — **100 tests passing across every workspace.**

See `apps/privacy-service/README.md` and `apps/policy-service/README.md`
for full endpoint/detector/rule tables, `docs/checklist-mapping.md`
for the updated 28-item status, and the end-of-phase report delivered
with this phase for files created/modified and verification results.

## Phase 6 — detail

Phase 6 introduces Redis and fulfills five HTTP/Web Service requirements on the Gateway:
- **Redis Infrastructure**: Added `ioredis` and a singleton client, backed by the `redis` service in `docker-compose.yml`.
- **Idempotency (Item 2)**: `POST /v1/ai-requests` now requires an `Idempotency-Key` header and caches the successful 201 response in Redis for 24 hours.
- **Rate Limiting (Item 12)**: Sliding window rate limit (100 req/min) enforced per organization using Redis. Includes `X-RateLimit-*` headers and returns 429 `RATE_LIMIT_EXCEEDED` on breach.
- **ETag (Item 6)**: Responses now include a weak `ETag` header. Subsequent requests with `If-None-Match` return `304 Not Modified`.
- **Cache-Control (Item 10)**: Deliberate cache headers set globally. `GET` lists return `no-cache`, `GET` single resources return `max-age=30`, and write operations return `no-store`.
- **Pagination (Item 8)**: `GET /v1/ai-requests` updated to use cursor-based pagination, accepting `?cursor` and `?limit`. Response envelope now includes a `meta` object with `nextCursor`.

All changes were contained within `gateway-service` boundaries. 100% test coverage maintained using `ioredis-mock`.

## Phase 7 — detail

Phase 7 hardens the Gateway's interaction with external AI providers, focusing on network resiliency in `apps/model-provider-service`.
- **Resilience Library**: Adopted `cockatiel`, a zero-dependency resilience library for TypeScript, to safely manage complex retry/breaker lifecycles.
- **Resilient Provider Adapter**: Created a generic wrapper adapter (`ResilientProviderAdapter`) that applies three policy layers to *any* underlying provider adapter (e.g. OpenAI, Mock):
  - **Circuit Breaker (Item 15)**: Monitors outbound requests and trips to `OPEN` after 5 consecutive failures, failing fast (503) to protect the downstream provider. Transitions to `HALF-OPEN` after 30s to test recovery.
  - **Retry with Exponential Backoff (Item 25)**: Transient HTTP errors (e.g., 429, 500, 502) and network timeouts are automatically retried up to 3 times, applying jittered exponential backoff (initial 500ms, max 5000ms). Permanent errors (400, 403) are failed immediately.
  - **Timeout (Item 20)**: Wraps all outbound `generate()` and `healthCheck()` calls with a strict 30-second boundary. If the provider hangs, the connection is aborted and a 504 is returned.
- **Factory Integration**: Updated `ProviderAdapterFactory` to wrap both `MockProviderAdapter` and `OpenAiProviderAdapter` automatically. No downstream consumers (`gateway-service`, `router`) needed code changes.

100% test coverage achieved for the new resilience layers in `resilience.test.ts`.

## Phase 10 — detail

Legacy enterprise integration: a real SOAP service, a resilient
connector to it, and JSON/XML content negotiation across the whole
REST API.

- **`soap-mock/`**: a standalone (not in the npm workspaces graph)
  SOAP 1.1 service implementing `CheckLegacyEmployee`
  (`service.wsdl` + `server/index.js`), with a small fixture
  directory and three deterministic trigger values
  (`FAIL_ONCE`/`FAIL_ALWAYS`/`TIMEOUT`) for testing connector
  resilience. Dockerized (`docker/Dockerfile.soap-mock`, added to
  `docker-compose.yml`) — not build-verified in this environment
  (no Docker available in this sandbox), though the mock server itself
  was run and smoke-tested directly with `node`.
- **`LegacyEmployeeClient`** (`apps/identity-service`): WSDL
  parsing/caching, a 5s timeout + retry with exponential backoff + a
  circuit breaker (`cockatiel`), correlation-ID propagation as a SOAP
  header, structured logging. Exposed at
  `GET /v1/legacy-employees/:employeeId`; never called from the
  Gateway's request flow, per the phase instructions.
- **Content negotiation**: one global middleware
  (`apps/api/src/middleware/contentNegotiation.ts`) wraps every
  route's `res.json()` — `Accept: application/xml` returns the same
  logical response as XML, without any controller change.
- **A real, independently-confirmed library bug found and fixed**:
  the installed `cockatiel@3.2.1`'s own `isTaskCancelledError` helper
  checks the wrong property (`'isBulkheadRejectedError' in e` instead
  of `'isTaskCancelledError' in e`), so it always returns `false` —
  silently misclassifying every real timeout as a generic failure.
  Found while writing `LegacyEmployeeClient`'s timeout test (a real
  10-second-delayed SOAP response against a 5s client timeout);
  worked around with a direct property check in both the new SOAP
  connector and, since it's the identical bug, in
  `apps/model-provider-service/src/services/resilient-provider.adapter.ts`
  (Phase 7) too.
- **Tests**: 8 new tests for `LegacyEmployeeClient` (successful
  calls, retry-then-succeed, real timeout, repeated failure, circuit
  trip + fast-fail, structured logging) against a real local
  ephemeral SOAP server, not a mock of the `soap` module; 5 new tests
  for content negotiation. **140/140 tests passing project-wide.**

### Environment note (not a code defect)

This phase's work started by inspecting an uploaded copy of the
project and finding it had been packaged in a way that lost Unix file
permissions and workspace symlinks (every `node_modules/.bin/*` shim
had lost its executable bit, `node_modules/@aegisai/*` workspace
symlinks were entirely missing, and `bcrypt`'s native binding was a
Windows DLL on what is a Linux environment) — all fixed before any
Phase 10 code was written; see the end-of-phase report for this
session for full detail. A pre-existing `Cache-Control` middleware
bug (comparing against the wrong path since the middleware is mounted
on a sub-router) was also found and fixed at this point, unrelated to
Phase 10 itself but caught by running the full suite before starting.
