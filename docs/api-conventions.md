# AegisAI — API Conventions

## Versioning & URLs

- All public REST APIs are under `/v1/...`.
- Resource-shaped URLs only — no verb-based routes.

  ```
  POST   /v1/ai-requests
  GET    /v1/ai-requests/:id
  GET    /v1/ai-requests
  POST   /v1/policies
  GET    /v1/policies/:id
  PATCH  /v1/policies/:id
  DELETE /v1/policies/:id
  ```

  Never: `/getAIRequest`, `/createPolicy`, `/deleteUser`.

- Use the correct HTTP method for the operation (GET for reads, POST
  for creation/processing, PATCH for partial updates, DELETE for
  deletion).

## Error contract

Every error, from every service, uses exactly one shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "traceId": "..."
  }
}
```

Implemented in Phase 0 as `apps/api/src/middleware/errorHandler.ts`
(`HttpError` + the central `errorHandler`/`notFoundHandler`
middleware). Domain-specific errors (e.g. `PolicyDenied`,
`ProviderUnavailable`) are added later as `HttpError` subclasses or
mapped codes — the envelope shape itself never changes.

## Correlation IDs

Every request carries a correlation ID (header `x-correlation-id`),
assigned by `apps/api/src/middleware/correlationId.ts` — reusing one
supplied by the caller, or generating a new one. It must propagate
through Gateway -> Privacy -> Policy -> Model/Provider -> Security/Audit
as those calls are implemented, and appears in every log line and
error response as `traceId`.

## Success envelope

Endpoints that return a resource (rather than just a status) use
`ServiceResponse<T>` from `@aegisai/shared-types`: `{ "data": T,
"traceId": "..." }`. `GET /health` endpoints are the one deliberate
exception — they return their `HealthStatus` payload unwrapped, since
they predate this convention and are diagnostic, not a resource.

## Authentication & authorization (Phase 2)

- `POST /v1/auth/login` — the only unauthenticated identity endpoint.
  Takes `{ email, password }`, returns `{ token, expiresAt, user }`.
  Every other business endpoint requires `Authorization: Bearer
  <token>`.
- A missing, malformed, invalid, or expired token is **401** (`
  MISSING_TOKEN`, `TOKEN_INVALID`, `TOKEN_EXPIRED`). An authenticated
  caller lacking the required role or permission is **403**
  (`FORBIDDEN`).
- JWT claims are deliberately minimal — `sub`, `organizationId`,
  `role`, `permissions`, `iat`, `exp` — no PII, no password hash. See
  `apps/identity-service/src/domain/rbac.ts` for the role ->
  permission grants and `services/token.service.ts` for issuance.
- Every business operation is scoped to the caller's own
  `organizationId`. A resource that exists but belongs to a different
  organization is **404**, not 403 — see
  `apps/identity-service/README.md` for the rationale. There is no
  cross-organization "platform admin" role in Phase 2.
- This pattern (`authenticateJWT` / `requireRole` / `requirePermission`
  middleware, exported from `@aegisai/identity-service`) is reused by
  any other service's routes once that service needs to protect an
  endpoint — none do yet.

## Identity & Access Management endpoints (Phase 2)

Mounted directly at `/v1` (not `/v1/identity` — only this service's
own `GET /v1/identity/health` lives there; see
`docs/service-boundaries.md`):

```
POST   /v1/auth/login
GET    /v1/users
POST   /v1/users
GET    /v1/users/:id
PATCH  /v1/users/:id
DELETE /v1/users/:id            (soft-disable, not a hard delete)
GET    /v1/service-accounts
POST   /v1/service-accounts
PATCH  /v1/service-accounts/:id
DELETE /v1/service-accounts/:id  (soft-disable, not a hard delete)
GET    /v1/organizations/:id
PATCH  /v1/organizations/:id     (role ORGANIZATION_ADMIN only)
```

`DELETE` performs a soft-disable (`status -> disabled`), not a hard
row delete — consistent with the "disable" lifecycle operation this
phase requires, and with keeping records available for a future audit
trail. Hard deletion is not implemented.

## AI Request Gateway endpoints (Phase 3)

Mounted directly at `/v1` (not `/v1/gateway` — only this service's
own `GET /v1/gateway/health` lives there; see
`docs/service-boundaries.md`). Protected by the same
`authenticateJWT`/`requirePermission` middleware as Identity's own
routes (`ai_requests:read` / `ai_requests:write`):

```
POST   /v1/ai-requests
GET    /v1/ai-requests
GET    /v1/ai-requests/:id
```

- Request body: `{ input, modelPreference?, policyId? }`, validated
  with AJV (`@aegisai/schemas`'s `createAiRequestSchema`) — a failed
  validation is **400** `VALIDATION_ERROR` with every violated field
  listed under `error.details.violations`.
- **Design decision — synchronous, not queued:** `POST
  /v1/ai-requests` does not return until the request has reached a
  terminal state (`COMPLETED` or `FAILED`) — the mock provider is
  instant, so the response body already reflects the final state.
  `201` on success (`COMPLETED`), **502** `PROVIDER_FAILURE` if the
  provider call fails (the persisted record itself is `FAILED` and
  still readable via `GET /v1/ai-requests/:id`). A queued design
  (`202` + poll) is a reasonable alternative for a slower real
  provider and does not require changing the persisted state machine
  — only where the HTTP response is sent from.
- Every operation is scoped to the caller's own `organizationId`,
  same rule as Identity: a request that exists but belongs to another
  organization is **404** `AI_REQUEST_NOT_FOUND`, not 403.
- `GET /v1/ai-requests` returns every request for the caller's
  organization, newest first. Cursor pagination (`items` + `next`
  cursor/link) arrives Phase 6 — see `checklist-mapping.md` item 8.
- **Phase 4 update:** two new terminal/paused statuses can now appear
  in the response — `BLOCKED` (policy `BLOCK`; the request also
  responds **403** `POLICY_BLOCK`) and `APPROVAL_REQUIRED` (policy
  `REQUIRE_APPROVAL`; the request responds **201** as normal — a
  paused request is not itself a failure — with `output: null` until
  a human decides it via `/v1/approvals`).

## Policy & Approval endpoints (Phase 4)

Mounted directly at `/v1`, same convention:

```
POST    /v1/policies
GET     /v1/policies
GET     /v1/policies/:id
PATCH   /v1/policies/:id
DELETE  /v1/policies/:id

GET     /v1/approvals[?status=PENDING|APPROVED|REJECTED]
GET     /v1/approvals/:id
POST    /v1/approvals/:id/approve
POST    /v1/approvals/:id/reject
```

- `policies:write`/`approvals:write` are required for anything that
  changes state; `policies:read`/`approvals:read` cover the GETs.
  Only `ORGANIZATION_ADMIN` holds the write permissions — authoring
  policy and deciding approvals are administrative acts, not
  developer ones (see `apps/identity-service/src/domain/rbac.ts`).
- `POST /v1/approvals/:id/approve|reject` accepts an optional
  `{ reason }` body. Deciding an approval that isn't `PENDING`
  anymore is **409** `APPROVAL_ALREADY_DECIDED`, not a silent no-op —
  a decision is made exactly once.
- There is no public `POST /v1/approvals` — creation is internal,
  triggered by `AiRequestsService` when Policy's decision is
  `REQUIRE_APPROVAL` (see the Gateway section above).
- Same org-scoping/404-not-403 rule as every other resource in this
  project.

## Content negotiation: JSON and XML (Phase 10)

Every route across every mounted service supports both
`Accept: application/json` (default) and `Accept: application/xml`,
via one global middleware (`apps/api/src/middleware/contentNegotiation.ts`)
that wraps `res.json()` — no controller anywhere needs to know XML
exists. The same logical resource is represented in both formats: the
XML body is the identical response object, wrapped in a single
`<response>` root element (XML requires exactly one root; JSON arrays
become a repeated `<item>` element under their key). A client that
sends no `Accept` header, or one that includes `application/json` or
the wildcard "any type" media range, continues to get JSON exactly as
before Phase 10 — XML is returned only when the client has
unambiguously asked for it and nothing else.

## Legacy SOAP integration (Phase 10)

```
GET /v1/legacy-employees/:employeeId
```

Identity's demonstration endpoint for the SOAP connector
(`LegacyEmployeeClient`, calling `soap-mock/`'s `CheckLegacyEmployee`
operation). Protected by `users:read`. Failures from the legacy system
map to `504` (timeout), `503` (circuit open), or `502` (other SOAP
fault) — never silently swallowed, and never able to affect the
Gateway's own request flow, since nothing in that flow calls this
connector. See `apps/identity-service/README.md`'s Phase 10 section
and `soap-mock/README.md`.

## Still to define (later phases)

Hand-written OpenAPI document, Swagger UI. See `checklist-mapping.md`
for which phase introduces each.
