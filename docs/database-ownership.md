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
| `organization_settings` | Identity & Access Management |
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

## Identity & Access Management Schema (PostgreSQL)

**Identity's schema**: `organizations`, `users`, `service_accounts`, and `organization_settings` exist in PostgreSQL per the ownership table above, with primary keys (`gen_random_uuid()`), foreign keys (`users.organization_id`, `service_accounts.organization_id`, `organization_settings.organization_id` -> `organizations.id`), unique constraints (`organizations.slug`, `users.email`, `(service_accounts.organization_id, name)`), status/role check constraints, `created_at`/`updated_at` timestamps, and an index on each child table's `organization_id`. Applied via `apps/identity-service/src/db/schema.ts` + `npm run db:migrate`. All queries are parameterized (`$1`, `$2`, ...) through `pg` — see `apps/identity-service/src/repositories/`.

`apps/identity-service/src/repositories/` is the only code in the whole project allowed to query `organizations`, `users`, `service_accounts`, and `organization_settings` — no other service imports from it, and `apps/api` never queries a database directly on a service's behalf.

## AI Request Gateway Schema (PostgreSQL)

**Gateway's schema**: `ai_requests` exists in PostgreSQL per the ownership table above — primary key (`gen_random_uuid()`), a status check constraint (`RECEIVED`, `VALIDATED`, `ROUTING`, `PROVIDER_CALL`, `COMPLETED`, `FAILED`, `BLOCKED`, `APPROVAL_REQUIRED`), `created_at`/`updated_at` timestamps, and an index on `organization_id` (plus a composite `(organization_id, created_at)` index for cursor pagination). Applied via `apps/gateway-service/src/db/schema.ts` + `npm run db:migrate`. All queries are parameterized through `pg` — see `apps/gateway-service/src/repositories/ai-requests.repository.ts`, the only code in the whole project allowed to query `ai_requests`.

`organization_id` and `requester_id` are stored as plain `UUID`
columns with **no foreign key** to Identity's `organizations`/`users`
tables, even though both live in the same physical PostgreSQL
instance today. A cross-service foreign key would make the two
services' schemas load-bearing on each other at the database level —
exactly what strict service boundaries prohibit — and would break the
moment either service is split into its own database. Referential
validity (does this organization/user actually exist) is Identity's
job via its contract, not Postgres's.

## Policy & Approval Schema (PostgreSQL)

**Policy & Approval's schema**: `policies` (id, `organization_id`, `name`, `version`, `rules` as `JSONB`, `status` check-constrained to `ACTIVE`/`INACTIVE`, timestamps) and `approvals` (id, `organization_id`, `ai_request_id`, `policy_id`, `matched_rule_id`, `requester_id`, `reason`, `status` check-constrained to `PENDING`/`APPROVED`/`REJECTED`, `decided_by`, `decision_reason`, `decided_at`, timestamps), both in PostgreSQL, per the ownership table above. Applied via `apps/policy-service/src/db/schema.ts` + `npm run db:migrate`. All queries parameterized through `pg` — see `apps/policy-service/src/repositories/{policies,approvals}.repository.ts`, the only code in the whole project allowed to query these two tables. Same no-cross-service-foreign-key rule as `ai_requests`: `ai_request_id` is a plain `UUID` column, not a foreign key into Gateway's table.

## Model & Provider Management Schema (PostgreSQL)

**Model & Provider schema**: `providers` (id, `organization_id`, `name`, `type`, `base_url`, `status`, `health_status`, `priority`, `configuration_reference`, timestamps) and `models` (id, `provider_id`, `name`, `capabilities`, `sensitivity_level`, `cost_metadata`, `active`, `configuration`, timestamps) exist in PostgreSQL per the ownership table above. Applied via `apps/model-provider-service/src/db/schema.ts` + `npm run db:migrate`. All queries are parameterized through `pg` — see `apps/model-provider-service/src/repositories/`.

## Privacy Scanner Schema (MongoDB)

**Privacy Scanner's `scanner_results` collection** lives in MongoDB. Each document stores `organizationId`, `aiRequestId`, `detected`, `findingTypes`, and `findings` (`type`/`location`/`confidence`/`action` — never the matched substring). See `apps/privacy-service/src/repositories/scanner-results.repository.ts`, the only code allowed to query this collection, and `apps/privacy-service/src/db/mongo.ts` for connection management.

## Security, Audit & Observability Collections (MongoDB)

**Security, Audit & Observability collections**: `request_traces`, `security_events`, and `audit_events` exist in MongoDB per the ownership table above. Each document records `traceId`, `organizationId`, timestamps, actor metadata, and stage metrics. See `apps/security-audit-service/src/repositories/` for repository operations.

## Legacy Integration Notes (`soap-mock`)

`soap-mock/` is a standalone legacy-system simulation, not one of the six logical AegisAI services — it has no database at all (its fixture directory is an in-memory object literal in `soap-mock/server/index.js`, deliberately, since it stands in for an external HR system AegisAI doesn't own or persist data for).
