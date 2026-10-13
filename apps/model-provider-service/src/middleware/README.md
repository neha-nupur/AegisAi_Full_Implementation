# Model & Provider Management Service — middleware

Phase 1 placeholder. Service-specific middleware (e.g. authentication
and RBAC checks for the Identity Service, AJV validation middleware
for services with write endpoints) is added starting Phase 5.
Cross-cutting middleware used by every service (correlation ID,
central error handling) already lives in `apps/api/src/middleware`.
