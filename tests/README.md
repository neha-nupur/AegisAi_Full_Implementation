# Tests

Most tests live alongside the code they test, inside each package's
own `test/` (or `__tests__/`) directory — e.g. `apps/api/test/`. This
top-level folder is reserved for any cross-service integration tests
that don't belong to a single package, which are expected to appear
starting Phase 3+ once there are multiple real services to integrate.
