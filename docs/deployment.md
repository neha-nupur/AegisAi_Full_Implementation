# Deployment

## Honest status

**Nothing in this project is deployed to the internet.** This section
documents how to deploy it and exactly what was and wasn't verified
in the sandbox this project was built and hardened in.

## Local deployment (Docker Compose) — written, not build-verified

```bash
cp .env.example .env   # fill in real secrets — see below
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
```

This brings up all 7 services: `postgres`, `mongo`, `redis`,
`soap-mock`, `api`, `worker`, `frontend`. The three application
Dockerfiles (`docker/Dockerfile.{api,worker,frontend}`) and the
compose file itself were written and YAML-validated during Phase 11,
but **Docker was not available in the sandbox this project was
hardened in**, so the images were never actually built or run. What
*was* verified in that sandbox: the equivalent processes run directly
(a real local PostgreSQL, Redis, and the SOAP mock, plus the API
server itself run with `node`) — see `docs/phase-progress.md`'s Phase
11 section — which is why a real, reproducible bug in the Redis
connection setup was caught before it could reach a containerized
deployment.

After `up`, run migrations and seed the model catalog (one-time,
against the containerized Postgres):

```bash
# Uses DATABASE_URL from your local .env (copy from .env.example).
npm run db:migrate
npm run db:seed
node seed_user.js
```

Then: API at `http://localhost:4000`, Swagger UI at
`http://localhost:4000/docs`, frontend at `http://localhost:80`.

## Local deployment (no Docker) — verified live

This is what was actually run and confirmed working in this
project's own hardening session:

```bash
# Datastores
apt-get install -y postgresql redis-server   # + MongoDB (see note below)
service postgresql start && service redis-server start

# Build everything
npm install --legacy-peer-deps
npm run build

# Schema + seed data
npm run db:migrate
npm run db:seed

# Run the API (from the repo root, so dotenv finds .env)
node apps/api/dist/index.js
```

**MongoDB note:** this sandbox could not install MongoDB — it isn't
in Ubuntu's default apt repositories, and MongoDB's own download
servers weren't reachable from this sandbox's network. A real
deployment target (a normal cloud VM, or Docker Compose's `mongo`
image) will not have this restriction. Everything up to the
MongoDB-backed privacy-scan step was confirmed working against real
Postgres and Redis — see `docs/final-evidence-matrix.md`, row 22.

## Configuration (twelve-factor)

Every config value is read from an environment variable — see
`.env.example` for the full list and `packages/config/src/index.ts`
for the typed contract every service loads at startup.
**Nothing is hardcoded, and no real secret is committed to git.**
`JWT_SECRET`, database passwords, and `configurationReference`
(the *name* of an env var holding a provider API key — never the key
itself) must all be replaced with real values before any deployment
that isn't purely local development.

## What a real internet-facing deployment still needs

1. **HTTPS.** Terminate TLS at a reverse proxy or load balancer (the
   app itself speaks plain HTTP — this is the standard pattern, not
   a gap specific to this project) — e.g. an nginx/Caddy sidecar, or
   a managed load balancer if deploying to a cloud provider.
2. **Real secrets**, injected via the target platform's secret
   manager, not `.env` files.
3. **Real provider API keys** (`OPENAI_API_KEY` or equivalent) for
   anything beyond the mock provider.
4. **CORS_ORIGINS** set to the real frontend origin(s), not
   `localhost`.
5. **A completed frontend** (see `docs/phase-progress.md`'s Phase 9
   note) — what exists today is the default Vite scaffold, not the
   11-screen control-plane dashboard the project specifies.
6. **MongoDB reachability** confirmed in the target environment
   (unlike this sandbox).

None of this was performed in this session — this list is what
remains, stated plainly rather than glossed over.
