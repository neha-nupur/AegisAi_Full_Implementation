/**
 * Background worker process.
 *
 * Phase 0 placeholder. Will host BullMQ-based async jobs (audit
 * persistence, provider retries, etc.) starting whichever phase
 * first needs asynchronous processing (Phase 6+), per CLAUDE.md's
 * "do not introduce dependencies without justification" rule —
 * BullMQ is not installed until a concrete job needs it.
 *
 * Keep-alive: the process stays running (heartbeat every 60 s) so
 * Docker's `restart: unless-stopped` policy does not restart it in a
 * loop. Replace this block with real BullMQ worker initialization
 * when the first async job is implemented.
 */
console.log("[worker] AegisAI background worker started (idle placeholder).");

// Stay alive until the container is stopped.
const HEARTBEAT_MS = 60_000;
setInterval(() => {
  console.log("[worker] heartbeat — idle, no jobs configured yet.");
}, HEARTBEAT_MS);

// Allow the process to be cleanly stopped by Docker / orchestrators.
process.on("SIGTERM", () => {
  console.log("[worker] SIGTERM received — shutting down.");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("[worker] SIGINT received — shutting down.");
  process.exit(0);
});
