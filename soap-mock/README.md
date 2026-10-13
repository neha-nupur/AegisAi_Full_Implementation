# Legacy SOAP Mock (Phase 10)

A small, standalone SOAP 1.1 service simulating a legacy enterprise
HR/directory system — the kind of system a real AegisAI deployment
might need to integrate with (e.g. verifying a requester is still a
legitimate employee before honoring a sensitive request).

Deliberately **not** part of the npm workspaces graph (`apps/*` /
`packages/*`) — it represents a system outside AegisAI's own
codebase, so it has its own small `package.json`, plain CommonJS (no
TypeScript build step), and its own Dockerfile
(`docker/Dockerfile.soap-mock`).

## Running it

```bash
cd soap-mock
npm install
npm start
# WSDL: http://localhost:5005/legacy-employee?wsdl
# SOAP:  http://localhost:5005/legacy-employee
```

Or via Docker Compose (see `docker/docker-compose.yml`):

```bash
docker compose -f docker/docker-compose.yml up soap-mock
```

## Operation: `CheckLegacyEmployee`

Defined in `service.wsdl`. Request: `{ employeeId }`. Response:
`{ employeeId, exists, fullName?, department?, status }`.

Fixture directory (`server/index.js`):

| employeeId | Result |
|---|---|
| `E1001` | exists, ACTIVE, Priya Sharma, Finance |
| `E1002` | exists, ACTIVE, Rahul Verma, Engineering |
| `E1003` | exists, INACTIVE, Anjali Mehta, Sales |
| anything else | `exists: false`, `status: NOT_FOUND` |

Deterministic trigger values, for testing the connector's resilience
behavior (never used outside tests/demos):

| employeeId | Behavior |
|---|---|
| `FAIL_ONCE` | Throws a SOAP fault on the first call after server start, then succeeds every call after |
| `FAIL_ALWAYS` | Always throws a SOAP fault |
| `TIMEOUT` | Delays the response by 10 seconds |

## The connector

The client side lives in `apps/identity-service/src/integrations/soap/legacy-employee.client.ts`
(`LegacyEmployeeClient`) — WSDL loading/caching, a 5s timeout, retry
with exponential backoff, a circuit breaker (`cockatiel`, tripping
after 5 consecutive failures), correlation-ID propagation as a SOAP
header, and structured logging. Exposed as
`GET /v1/legacy-employees/:employeeId`. See
`apps/identity-service/README.md` for the full endpoint contract and
`apps/identity-service/tests/legacy-employee.client.test.ts` for the
resilience test suite (run against a real local ephemeral SOAP
server, not a mock of the `soap` module).

**SOAP is never a dependency of normal AI request processing** — if
`soap-mock` is down, only `/v1/legacy-employees/:employeeId` fails;
the Gateway's request flow is unaffected.
