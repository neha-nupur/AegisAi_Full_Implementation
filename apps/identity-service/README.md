# Identity & Access Management Service

Package: `@aegisai/identity-service`

Owns: **organizations, users, service_accounts** (PostgreSQL)

## Phase 2 status

Real authentication and authorization, backed by PostgreSQL.

**Two routers:**
- `identityRouter` — this service's own `GET /health`, mounted by
  `apps/api` at `/v1/identity` (unchanged since Phase 1).
- `identityApiRouter` — this service's public business API, mounted
  by `apps/api` directly at `/v1` (resource-shaped URLs, not nested
  under `/identity` — see `docs/api-conventions.md`):

  | Method | Path | Auth | Notes |
  |---|---|---|---|
  | POST | `/v1/auth/login` | none | Returns a JWT + the public user |
  | GET | `/v1/users` | `users:read` | Scoped to caller's organization |
  | POST | `/v1/users` | `users:write` | organizationId is always the caller's own |
  | GET | `/v1/users/:id` | `users:read` | 404 if the user is in another org |
  | PATCH | `/v1/users/:id` | `users:write` | email, role, status, password |
  | DELETE | `/v1/users/:id` | `users:write` | Soft-disable, not a hard delete |
  | GET | `/v1/service-accounts` | `service_accounts:read` | Scoped to caller's org |
  | POST | `/v1/service-accounts` | `service_accounts:write` | Returns the plaintext credential once |
  | PATCH | `/v1/service-accounts/:id` | `service_accounts:write` | name, permissions, status |
  | DELETE | `/v1/service-accounts/:id` | `service_accounts:write` | Soft-disable, not a hard delete |
  | GET | `/v1/organizations/:id` | `organizations:read` | Must be caller's own org |
  | PATCH | `/v1/organizations/:id` | role `ORGANIZATION_ADMIN` | Deliberately role-gated, not permission-gated |

**Data model:** `db/schema.ts` (applied via `db/migrate.ts` /
`npm run migrate` after `npm run build`) — `organizations`, `users`,
`service_accounts`, with primary/foreign keys, unique constraints
(`users.email`, `organizations.slug`, `(service_accounts.organization_id,
name)`), status/role check constraints, timestamps, and an index on
each table's `organization_id`. Passwords and service-account
credentials are stored **only** as bcrypt hashes.

**AuthN/AuthZ:** `POST /v1/auth/login` verifies a bcrypt password hash
and issues a JWT (`sub`, `organizationId`, `role`, `permissions`,
`iat`, `exp` — no PII). `middleware/authenticateJWT.ts`,
`requireRole.ts`, `requirePermission.ts` protect every other business
route; a missing/invalid/expired token is 401, an authenticated
caller without the right role/permission is 403.

**RBAC:** `domain/rbac.ts` is the single source of truth for the
three roles (`ORGANIZATION_ADMIN`, `DEVELOPER`, `SECURITY_AUDITOR`)
and their permission grants — both token issuance and authorization
checks read from it, so they can't drift apart.

**Multi-tenancy:** every business operation is scoped to
`req.principal.organizationId`. A request for a resource that exists
but belongs to a different organization returns 404, not 403 (see
`services/users.service.ts` for the rationale) — this is what the
Phase 2 "cross-organization access" tests check.

`schemas/` (AJV) stays a placeholder — Phase 2 validates request
bodies with small manual checks per service method; AJV arrives
project-wide in Phase 3 (see `docs/checklist-mapping.md`, item 3).

See `/docs/service-boundaries.md` for responsibilities, inputs,
outputs, dependencies, and communication direction, and
`/docs/database-ownership.md` for the schema.

## Phase 10: legacy SOAP connector

`GET /v1/legacy-employees/:employeeId` (protected, `users:read`)
demonstrates a real SOAP integration against `soap-mock/` (see that
directory's README for the mock service and fixture directory).

`integrations/soap/legacy-employee.client.ts`'s `LegacyEmployeeClient`:
loads and caches the WSDL (`soap.createClientAsync`), applies a 5s
timeout + retry with exponential backoff + a circuit breaker
(`cockatiel`, tripping after 5 consecutive failures — a separate,
smaller policy than `model-provider-service`'s Phase 7 one, tuned for
a same-network legacy call rather than an external AI provider),
propagates the request's correlation ID into the legacy call itself
via a SOAP header, and logs every stage through an injected
structured logger. Failures map to specific HTTP statuses: `504
LEGACY_SYSTEM_TIMEOUT`, `503 LEGACY_SYSTEM_UNAVAILABLE` (circuit
open), `502 LEGACY_SYSTEM_ERROR`.

**Never a dependency of normal AI request processing** — this is a
standalone demonstration endpoint; the Gateway's request flow doesn't
call it.

`SOAP_MOCK_URL` (optional, defaults to `http://localhost:5005`)
configures where the connector looks for `soap-mock`. Read directly
from `process.env`, not `@aegisai/config`'s `loadConfig()` — see
`routes/api.routes.ts`'s doc comment for why (calling `loadConfig()`
at this module's import time would require every one of the app's
unrelated required env vars just to `import` this package).

See `apps/identity-service/tests/legacy-employee.client.test.ts` for
the full resilience test suite, run against a real local ephemeral
SOAP server (`tests/support/soap-fixture-server.ts`) rather than a
mock of the `soap` module.
