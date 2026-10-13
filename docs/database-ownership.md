# AegisAI — Database Ownership

**Rule:** a service owns its own data. No other service may directly
query another service's tables/collections. Cross-service data needs
go through that service's contract.

```
WRONG:   Gateway -> SELECT * FROM policies
CORRECT: Gateway -> Policy Service contract -> Policy Service -> Policy repository
```

## PostgreSQL (structured/relational business data)

| Table | Owning service |
|---|---|
| `organizations` | Identity & Access Management |
| `users` | Identity & Access Management |
| `service_accounts` | Identity & Access Management |
| `ai_requests` | AI Request Gateway |
| `policies` | Policy & Approval |
| `approvals` | Policy & Approval |
| `providers` | Model & Provider Management |
| `models` | Model & Provider Management |

## MongoDB (document/event-oriented data)

| Collection | Owning service |
|---|---|
| `scanner_results` | Privacy Scanner |
| `request_traces` | Security, Audit & Observability |
| `security_events` | Security, Audit & Observability |
| `audit_events` | Security, Audit & Observability |
| provider interaction metadata | Security, Audit & Observability |

## Redis

Rate limiting, idempotency, caching, and temporary/distributed
coordination state only. **Redis is never the primary source of
business truth** — anything that must survive a Redis flush belongs
in Postgres or MongoDB instead.

## Phase 2 status

**Identity's schema is now live**: `organizations`, `users`,
`service_accounts` exist in PostgreSQL exactly per the ownership table
above, with primary keys (`gen_random_uuid()`), foreign keys
(`users.organization_id`, `service_accounts.organization_id` ->
`organizations.id`), unique constraints (`organizations.slug`,
`users.email`, `(service_accounts.organization_id, name)`), status/role
check constraints, `created_at`/`updated_at` timestamps, and an index
on each child table's `organization_id`. Applied via
`apps/identity-service/src/db/schema.ts` +
`npm run db:migrate:identity` (see the root `package.json`). All
queries are parameterized (`$1`, `$2`, ...) through `pg` — see
`apps/identity-service/src/repositories/`.

Every other table in the map above (`providers`, `models`) is still
unimplemented, arriving with its owning phase (Phase 5).
`repositories/` remains the enforcement point:
`apps/identity-service/src/repositories/` is the only code in the
whole project allowed to query `organizations`/`users`/
`service_accounts` — no other service imports from it, and
`apps/api` never queries a database directly on a service's behalf.

## Phase 3 status

**Gateway's schema is now live**: `ai_requests` exists in PostgreSQL
exactly per the ownership table above — primary key
(`gen_random_uuid()`), a status check constraint
(`RECEIVED`/`VALIDATED`/`ROUTING`/`PROVIDER_CALL`/`COMPLETED`/`FAILED`),
`created_at`/`updated_at` timestamps, and an index on
`organization_id` (plus a composite `(organization_id, created_at)`
index for the future cursor-paginated list — Phase 6). Applied via
`apps/gateway-service/src/db/schema.ts` + `npm run build -w
apps/gateway-service && npm run migrate -w apps/gateway-service`. All
queries are parameterized through `pg` — see
`apps/gateway-service/src/repositories/ai-requests.repository.ts`,
the only code in the whole project allowed to query `ai_requests`.

`organization_id` and `requester_id` are stored as plain `UUID`
columns with **no foreign key** to Identity's `organizations`/`users`
tables, even though both live in the same physical PostgreSQL
instance today. A cross-service foreign key would make the two
services' schemas load-bearing on each other at the database level —
exactly what CLAUDE.md section 3 prohibits — and would break the
moment either service is split into its own database. Referential
validity (does this organization/user actually exist) is Identity's
job via its contract, not Postgres's.

## Phase 4 status

**Policy & Approval's schema is now live**: `policies` (id,
`organization_id`, `name`, `version`, `rules` as `JSONB`, `status`
check-constrained to `ACTIVE`/`INACTIVE`, timestamps) and `approvals`
(id, `organization_id`, `ai_request_id`, `policy_id`,
`matched_rule_id`, `requester_id`, `reason`, `status`
check-constrained to `PENDING`/`APPROVED`/`REJECTED`, `decided_by`,
`decision_reason`, `decided_at`, timestamps), both in PostgreSQL, per
the ownership table above. Applied via
`apps/policy-service/src/db/schema.ts` + `npm run build -w
apps/policy-service && npm run migrate -w apps/policy-service`. All
queries parameterized through `pg` — see
`apps/policy-service/src/repositories/{policies,approvals}.repository.ts`,
the only code in the whole project allowed to query these two tables.
Same no-cross-service-foreign-key rule as `ai_requests`: `ai_request_id`
is a plain `UUID` column, not a foreign key into Gateway's table.

**Privacy Scanner's `scanner_results` collection is now live**, in
MongoDB — the project's first NoSQL usage (checklist item 22 target
phase "4+"). Each document stores `organizationId`, `aiRequestId`,
`detected`, `findingTypes`, and `findings` (`type`/`location`/
`confidence`/`action` — never the matched substring). See
`apps/privacy-service/src/repositories/scanner-results.repository.ts`,
the only code allowed to query this collection, and
`apps/privacy-service/src/db/mongo.ts` for the lazy-connect pattern
(same shape as the Postgres pools, adapted for the Mongo driver).

**Gateway's `ai_requests` status check constraint was widened** for
two new states (`BLOCKED`, `APPROVAL_REQUIRED`) introduced by Policy
evaluation. `apps/gateway-service/src/db/schema.ts`'s migration
remains idempotent: it drops and recreates the constraint (a `DO $$
... $$` block, since Postgres has no `ADD CONSTRAINT IF NOT EXISTS`
for `CHECK`), so re-running it against a Phase-3-migrated database is
safe and picks up the wider set of valid statuses.

## Phase 10 note: `soap-mock` owns no table

`soap-mock/` is a standalone legacy-system simulation, not one of the
six logical AegisAI services — it has no database at all (its
fixture "directory" is a small in-memory object literal in
`soap-mock/server/index.js`, deliberately, since it stands in for a
system AegisAI doesn't own or persist data for). Nothing in this
project's PostgreSQL or MongoDB schema changed for Phase 10.
