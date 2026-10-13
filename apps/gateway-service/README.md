# AI Request Gateway Service

Package: `@aegisai/gateway-service`

Owns: **ai_requests, request lifecycle metadata**

## Phase 3 status — first end-to-end vertical slice

A logged-in user or service account can submit an AI request and get
back a controlled response, entirely through this service's own
layering (`routes -> controllers -> services -> repositories`),
PostgreSQL-backed.

### Endpoints

Mounted directly at `/v1` (not `/v1/gateway` — see
`docs/api-conventions.md`):

```
POST   /v1/ai-requests
GET    /v1/ai-requests
GET    /v1/ai-requests/:id
```

`GET /v1/gateway/health` (unchanged since Phase 1) still lives at its
own prefix.

### Request / response

```
POST /v1/ai-requests
Authorization: Bearer <token>

{
  "modelPreference": "auto",
  "policyId": "policy_default",
  "input": "Summarize this customer support message."
}
```

```
201 Created
{
  "data": {
    "id": "...",
    "organizationId": "...",
    "requesterId": "...",
    "input": "Summarize this customer support message.",
    "modelPreference": "auto",
    "policyId": "policy_default",
    "status": "COMPLETED",
    "modelId": "mock-model-1",
    "providerId": "mock-provider",
    "traceId": "...",
    "output": "[mock-provider response] Summarize this customer support message.",
    "errorMessage": null,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "traceId": "..."
}
```

### Lifecycle

```
RECEIVED -> VALIDATED -> [Privacy Scan] -> [Policy Evaluation] -> {
    BLOCK            -> BLOCKED (terminal)
    REQUIRE_APPROVAL -> APPROVAL_REQUIRED (paused)
    ALLOW/MASK/ROUTE -> ROUTING -> PROVIDER_CALL -> COMPLETED
                                                \-> FAILED
}
```

`APPROVAL_REQUIRED` resumes into `ROUTING -> PROVIDER_CALL -> ...`
once approved, or terminates at `BLOCKED` if rejected — see "Phase 4:
Privacy Scan + Policy Evaluation" below.

Every transition is persisted to `ai_requests` and logged as a
structured Pino event tagged with `traceId`/`aiRequestId` — this
phase's stand-in for real Security & Audit persistence (MongoDB
`request_traces`/`audit_events` arrive Phase 8; see
`docs/service-boundaries.md`).

### Design decision: synchronous, not queued

`POST /v1/ai-requests` does not return until the request reaches a
terminal state. The mock provider is instant, so this keeps the demo
(login → submit → response) a single request/response pair. A queued
design (`202` + poll `GET /v1/ai-requests/:id`) is a reasonable
alternative for a slower real provider — the persisted state machine
above does not change, only where the HTTP response is sent from.

### Auth & multi-tenancy

Protected by Identity's `authenticateJWT` / `requirePermission`
middleware, reused unchanged (`ai_requests:read` for the GETs,
`ai_requests:write` for the POST — new permissions added to
`apps/identity-service`'s RBAC model, granted to
`ORGANIZATION_ADMIN`/`DEVELOPER` read+write, `SECURITY_AUDITOR`
read-only). Every operation is scoped to the caller's own
`organizationId` — a request that exists but belongs to another
organization is `404 AI_REQUEST_NOT_FOUND`, not 403, same rule as
Identity.

### Validation

`POST /v1/ai-requests`'s body is validated with AJV
(`@aegisai/schemas`'s `createAiRequestSchema`, compiled in
`src/schemas/create-ai-request.schema.ts`) before it reaches the
service layer. A failing request is `400 VALIDATION_ERROR` with every
violated field under `error.details.violations`.

### Provider

`src/providers/provider-adapter.ts` defines `ProviderAdapter`
(`generate()`); `src/providers/mock-provider.adapter.ts` is the one
implementation used in Phase 3 — deterministic, offline, with a
documented failure trigger (`input` containing
`FORCE_PROVIDER_FAILURE`) for testing the provider-failure scenario.
This lives inside gateway-service, not `apps/model-provider-service`,
because that service's real provider registry, model routing, and
provider health are explicitly Phase 5 scope (`CLAUDE.md` section
21) — see `docs/service-boundaries.md` for the full reasoning. The
interface is written so a Phase 5 `ModelRouter` can sit behind it
without changing `AiRequestsService`.

### Tests

`tests/ai-requests.test.ts`, against an in-memory fake repository
(`tests/support/in-memory-ai-requests.repository.ts`) and real JWTs
minted via Identity's `TokenService` (`tests/support/fixtures.ts`):
valid request, invalid request (missing/empty `input`), missing JWT
(both POST and GET), wrong organization (both direct access and list
scoping), unknown request, provider failure, and role enforcement
(`SECURITY_AUDITOR` can read but not submit).

See `/docs/service-boundaries.md` for responsibilities, inputs,
outputs, dependencies, and communication direction, and
`/docs/api-conventions.md` for the full API contract.

## Phase 4: Privacy Scan + Policy Evaluation

Between `VALIDATED` and `ROUTING`, every request now runs (both
in-process, both called on `PrivacyScanService`/`PolicyEvaluationService`
directly — see `apps/privacy-service`, `apps/policy-service`):

1. **Privacy Scan** — `PrivacyScanService.scanAndRecord()` scans
   `input`, persists the (raw-value-free) result to `scanner_results`
   (MongoDB), and returns detected finding types.
2. **Policy Evaluation** — `PolicyEvaluationService.evaluate()`
   resolves `policyId` to an actual policy (or the built-in default —
   see `apps/policy-service/README.md`) and evaluates its rules
   against the finding types, requester role, and requested model.

The decision branches the flow:

- **`BLOCK`** — the provider is never called. `403 POLICY_BLOCK`,
  status `BLOCKED`, `errorMessage` set to the policy's reason.
- **`REQUIRE_APPROVAL`** — status becomes `APPROVAL_REQUIRED`, an
  `Approval` is created (via `ApprovalCreator`, satisfied by
  `ApprovalsService`), and `submit()` returns immediately — `201`
  with the paused record. A human decides via
  `POST /v1/approvals/:id/approve|reject`, which calls back into
  `resumeAfterApproval()` (see "The approval-resume knot" in
  `docs/service-boundaries.md`): approved continues into
  `ROUTING -> PROVIDER_CALL -> COMPLETED|FAILED` with the original
  input (`REQUIRE_APPROVAL` never masks); rejected becomes `BLOCKED`.
- **`MASK`** — the provider receives `PrivacyScanner.redact()`'s
  output, never the raw text; `ai_requests.input` still stores what
  the caller originally submitted.
- **`ALLOW`** / **`ROUTE`** — proceeds unchanged. `ROUTE` has no real
  routing behavior yet (Phase 5).

### Demo matrix (all in `tests/ai-requests.test.ts`)

| Input | Policy decision | Result |
|---|---|---|
| "Summarize this message." | `ALLOW` | `COMPLETED` |
| "email me at jane@x.com" | `MASK` | `COMPLETED`, provider never sees the email |
| "here's the key: AKIA..." | `BLOCK` | `403`, `BLOCKED`, provider never called |
| "this is confidential, re the merger" | `REQUIRE_APPROVAL` | `APPROVAL_REQUIRED`, `Approval` created |
| (above, then approved) | — | resumes, `COMPLETED` |
