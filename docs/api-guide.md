# API Guide

Practical guide for calling the AegisAI API. For the full formal
contract (every field, every status code), see `openapi/openapi.yaml`
or the live Swagger UI at `GET /docs`. For architectural conventions
(why URLs are shaped this way, the error envelope, content
negotiation), see `docs/api-conventions.md`.

## Base URL and versioning

Everything lives under `/v1`. `GET /health` and `GET /docs` are the
only unversioned, unauthenticated exceptions.

## Authentication

```bash
curl -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SEED_ADMIN_EMAIL\",\"password\":\"$SEED_ADMIN_PASSWORD\"}"
```

Use the values you set in `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). Never commit those values.

Response: `{ "data": { "token": "<JWT>", "expiresAt": "..." }, "traceId": "..." }`.
Use the token as `Authorization: Bearer <token>` on every subsequent
request. Tokens carry `organizationId`, `role`, and a `permissions`
array (see `apps/identity-service/src/domain/rbac.ts`) — every
protected route checks a specific permission, not just "is logged in".

## The core flow: submit an AI request

```bash
curl -X POST http://localhost:4000/v1/ai-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"input":"Summarize this quarterly report.","modelPreference":"auto"}'
```

`Idempotency-Key` is required. The response is synchronous — it
reflects the request's final state (`COMPLETED`, `FAILED`, `BLOCKED`,
or `APPROVAL_REQUIRED`) by the time you get a response. See
`docs/demo-script.md` for what each of those looks like for different
inputs (PII, secrets, sensitive keywords).

If the response is `APPROVAL_REQUIRED`, find the pending approval
(`GET /v1/approvals?status=PENDING`) and decide it:

```bash
curl -X POST http://localhost:4000/v1/approvals/$APPROVAL_ID/approve \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```

## Managing the policy that governs requests

```bash
curl -X POST http://localhost:4000/v1/policies \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "Default governance policy",
    "rules": [
      { "id": "block-secrets", "action": "BLOCK", "when": { "findingTypes": ["API_KEY", "PASSWORD"] } },
      { "id": "require-approval-sensitive", "action": "REQUIRE_APPROVAL", "when": { "findingTypes": ["SENSITIVE_KEYWORD"] } },
      { "id": "mask-pii", "action": "MASK", "when": { "findingTypes": ["EMAIL", "PHONE", "PAN", "AADHAAR"] } },
      { "id": "allow-default", "action": "ALLOW" }
    ]
  }'
```

Rules evaluate in array order, first match wins. If you never create
a policy, every organization still gets a built-in default policy
with exactly these four rules (see
`apps/policy-service/src/domain/default-policy.ts`) — so the demo
works out of the box.

## Managing the model/provider catalog

Before any AI request can succeed, at least one active provider and
one active model (with `"chat"` in its `capabilities`) must exist —
`npm run db:seed` creates a working default (see
`apps/model-provider-service/src/db/seed.ts`). To add your own:

```bash
curl -X POST http://localhost:4000/v1/providers \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"openai-prod","type":"openai","baseUrl":"https://api.openai.com/v1","status":"active","healthStatus":"healthy","priority":1,"configurationReference":"OPENAI_API_KEY"}'

curl -X POST http://localhost:4000/v1/models \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"providerId":"'$PROVIDER_ID'","name":"gpt-4o-mini","capabilities":["chat"],"sensitivityLevel":"low","costMetadata":{"inputCostPer1k":0.00015,"outputCostPer1k":0.0006,"currency":"USD"},"active":true,"configuration":{}}'
```

`configurationReference` names an environment variable holding the
real API key — never the key itself (see CLAUDE.md section 9).

## Auditing what happened

```bash
curl "http://localhost:4000/v1/traces/$TRACE_ID" -H "Authorization: Bearer $TOKEN"
curl "http://localhost:4000/v1/security-events?severity=HIGH" -H "Authorization: Bearer $TOKEN"
```

Requires the `audit:read` permission (`ORGANIZATION_ADMIN` and
`SECURITY_AUDITOR` roles have it by default).

## The legacy SOAP integration

```bash
curl "http://localhost:4000/v1/legacy-employees/E1001" -H "Authorization: Bearer $TOKEN"
```

Requires `soap-mock` to be running (`cd soap-mock && npm start`, or
`docker compose up soap-mock`). Never part of the AI request flow
itself — this is a standalone demonstration endpoint.

## XML instead of JSON

Add `Accept: application/xml` to any GET above to get the identical
response body serialized as XML instead — see
`docs/api-conventions.md`'s content-negotiation section.

## GraphQL

```bash
curl -X POST http://localhost:4000/v1/graphql \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"{ organizationOverview { requestCount blockedCount estimatedCost securityScore } }"}'
```

GraphQL serves dashboard-aggregation queries; it deliberately does
not duplicate the full REST API (see CLAUDE.md's Phase 9 instructions).
