# Policy & Approval Service

Package: `@aegisai/policy-service`

Owns: **policies, approvals**

## Phase 4 status — policy CRUD, rule engine, human approval workflow

### Endpoints

Mounted directly at `/v1` (not `/v1/policy` — only this service's
own `GET /v1/policy/health` lives there):

```
POST   /v1/policies
GET    /v1/policies
GET    /v1/policies/:id
PATCH  /v1/policies/:id
DELETE /v1/policies/:id

GET    /v1/approvals              (?status=PENDING|APPROVED|REJECTED)
GET    /v1/approvals/:id
POST   /v1/approvals/:id/approve  { reason? }
POST   /v1/approvals/:id/reject   { reason? }
```

There is no public `POST /v1/approvals` — an `Approval` is only ever
created internally, by `AiRequestsService` (Gateway) when a policy
decision is `REQUIRE_APPROVAL`.

### Policy shape

```ts
{
  id, organizationId, name, version, status: "ACTIVE" | "INACTIVE",
  rules: [
    { id: "block-secrets", action: "BLOCK", when: { findingTypes: ["API_KEY", "PASSWORD"] } },
    { id: "allow-default", action: "ALLOW" }  // no `when` = always matches
  ],
  createdAt, updatedAt
}
```

`rules` are evaluated in array order, **first match wins**. A rule's
`when` conditions (`findingTypes`, `roles`, `modelPreference`) are
ANDed together; an omitted `when` (or an empty one) always matches —
the conventional way to write a policy's fallback rule. Every PATCH
bumps `version` by 1. If a custom policy's rules don't cover a
request, evaluation **fails closed to `BLOCK`** — a governance
gateway should never silently let an ungoverned request through.

### Built-in default policy

Used whenever an `AIRequest`'s `policyId` doesn't resolve to a real,
`ACTIVE` policy in the caller's organization — including
`"policy_default"` (the id used in the Phase 3 example payload)
before any admin has created a real policy. Never persisted;
synthesized on demand (`buildDefaultPolicy`). Encodes exactly the
four required demo outcomes:

| Detected | Action |
|---|---|
| `API_KEY` / `PASSWORD` | `BLOCK` |
| `SENSITIVE_KEYWORD` | `REQUIRE_APPROVAL` |
| `EMAIL` / `PHONE` / `PAN` / `AADHAAR` | `MASK` |
| nothing | `ALLOW` |

### The approval-resume knot

`AiRequestsService` (Gateway) creates an `Approval` when Policy
decides `REQUIRE_APPROVAL`; `ApprovalsService` (here) resumes the
paused `AIRequest` once a human decides it. Both directions are real
runtime calls, but neither package imports the other's concrete
class — each defines the interface it needs (`ApprovalCreator` here
in `services/approval-resume-handler.ts`'s sibling on the gateway
side; `ApprovalResumeHandler` in this package) and `apps/api` (the
composition root) wires the concrete instances together. See
`/docs/service-boundaries.md`'s "approval-resume knot" section and
`apps/api/src/app.ts`.

### RBAC

`policies:read/write` and `approvals:read/write`, defined in
Identity's RBAC model (the single owner of permission strings) and
reused here via `requirePermission`. `ORGANIZATION_ADMIN` has full
access; `DEVELOPER`/`SECURITY_AUDITOR` are read-only — deciding
approvals and authoring policy are administrative acts.

### Tests

`tests/policy-engine.test.ts` (rule matching, first-match-wins, fail-
closed, the built-in default policy's four outcomes), `tests/policies.test.ts`
(full CRUD, org scoping, validation), `tests/approvals.test.ts`
(create-on-REQUIRE_APPROVAL, approve/reject, org scoping,
already-decided conflict, RBAC) — 23 tests total, all against
in-memory fake repositories.

See `/docs/service-boundaries.md` for responsibilities, inputs,
outputs, dependencies, and communication direction.
