# Privacy Scanner Service

Package: `@aegisai/privacy-service`

Owns: **scanner_results, scanner findings**

## Phase 4 status — deterministic detection, masking, MongoDB persistence

No public HTTP surface of its own beyond `GET /v1/privacy/health` —
this service is called in-process by `AiRequestsService`
(`apps/gateway-service`), the same convention every other
in-process service contract in this project follows.

### Detectors

All deterministic (regex/keyword — no ML), in
`src/domain/detectors.ts`:

| Type | Pattern | Default action | Confidence |
|---|---|---|---|
| `EMAIL` | standard email shape | `MASK` | 0.95 |
| `PHONE` | Indian 10-digit mobile, optional `+91` | `MASK` | 0.85 |
| `PAN` | 5 letters + 4 digits + 1 letter | `MASK` | 0.9 |
| `AADHAAR` | 12 digits, optionally grouped in 4s | `MASK` | 0.75 |
| `API_KEY` | AWS `AKIA...`, `sk-`/`pk-`/`rk-` keys, `Bearer <token>` | `BLOCK` | 0.9 |
| `PASSWORD` | `password:`/`pwd=`/`secret:` credential dumps | `BLOCK` | 0.8 |
| `SENSITIVE_KEYWORD` | configurable list (`SENSITIVE_KEYWORDS` env var, comma-separated; sensible default list built in) | `REQUIRE_APPROVAL` | 0.6 |

### `scan()` result shape

Exactly what the phase specified — never the matched substring,
anywhere:

```ts
{
  detected: true,
  findings: [
    { type: "EMAIL", location: { field: "input", start: 12, end: 34 }, confidence: 0.95, action: "MASK" }
  ]
}
```

### Masking

`PrivacyScanner.redact(text, findings)` replaces every finding's span
with a type-tagged placeholder (`[REDACTED_EMAIL]`, `[REDACTED_API_KEY]`,
...), applied back-to-front by offset so earlier spans stay valid.

### Persistence

`scanner_results` (MongoDB — this project's first Mongo usage) stores
only `type`/`location`/`confidence`/`action` per finding, plus
`organizationId`/`aiRequestId`/`detected`/`createdAt`. Never the raw
matched text — enforced at the source (`scan()`'s own return value
never contains it), not only at the persistence layer.

### Tests

`tests/scanner.test.ts` (every detector, masking, overlap resolution,
"never includes the raw matched text anywhere in the result") and
`tests/privacy-scan.service.test.ts` (persistence via an in-memory
fake repository), 14 tests total.

See `/docs/service-boundaries.md` for responsibilities, inputs,
outputs, dependencies, and communication direction.
