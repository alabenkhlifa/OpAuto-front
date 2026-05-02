# opauto-backend / scripts

One-off scripts for validation, integration testing, and performance measurement. Run from the `opauto-backend/` directory unless noted.

## Validation (LLM bypass)

| Script | What it does |
|---|---|
| `validate-tools.ts` | Direct-call validator for every READ-tier assistant tool. Bypasses the LLM, runs each tool's handler with sensible args, and compares against an independent ground-truth Prisma query. |
| `validate-send-email.ts` | End-to-end check of the `send_email` tool with a stubbed Resend driver — captures and asserts the recipient / subject / body / attachment payload. |
| `send-email-live.ts` | Live send via Resend. Sandbox mode delivers only to `ala.khliifa@gmail.com` (double-i). Useful for manual smoke checks. |
| `test-sms.ts` | Sends a test SMS via the configured provider. |
| `seed-churn-test-customer.ts` | Inserts a deterministic high-risk customer for AI churn-model regressions. |

```bash
npx ts-node scripts/validate-tools.ts
npx ts-node scripts/validate-send-email.ts
npx ts-node scripts/send-email-live.ts
```

## Performance benchmarks (Sweep C-22 — S-PERF-003 / 004 / 005)

The three perf-benchmark scripts measure invoice-pipeline performance against the catalog thresholds. They drive a fresh local backend over HTTP — start a bench-mode BE on a separate port first so the throttler ceilings (default 30/user/min) don't choke the load:

```bash
# In a separate terminal:
cd opauto-backend
PORT=3001 THROTTLE_DISABLED=true NODE_ENV=development node dist/src/main.js
# or, for hot-reload during development:
PORT=3001 THROTTLE_DISABLED=true npm run start:dev
```

`THROTTLE_DISABLED=true` is wired in `src/app.module.ts` and raises both throttler buckets to ~1M/min — never set this in production.

Each script defaults to `API=http://localhost:3000/api` (the regular dev BE). Override via the `API` env var to point at the bench instance.

| Scenario | Script | Threshold | Re-run command |
|---|---|---|---|
| S-PERF-003 — PDF render p95 | `perf-pdf-p95.ts` | p95 < 500ms | `API=http://localhost:3001/api npx ts-node scripts/perf-pdf-p95.ts` |
| S-PERF-004 — Concurrent issue throughput | `perf-issue-throughput.ts` | ≥ 50 issues/sec, gapless | `API=http://localhost:3001/api npx ts-node scripts/perf-issue-throughput.ts` |
| S-PERF-005 — LRU cache hit ratio | `perf-cache-hitratio.ts` | hit ratio > 80% | `API=http://localhost:3001/api npx ts-node scripts/perf-cache-hitratio.ts` |

### perf-pdf-p95.ts

Sequential PDF fetches. Two modes:

- `(default)` hot-cache — first call is a miss, the rest are LRU hits. Mirrors steady-state user behaviour.
- `--bust` — bumps `invoice.notes` between calls so the cache key (`${id}:${updatedAt}`) shifts and every render is a forced miss.

Flags: `--runs=N` (default 100), `--warmup=N` (default 5), `--invoiceId=ID` (skip seeding).

The script seeds a "Perf Bench Customer" + a five-line invoice on the first run. Reused on subsequent runs.

### perf-issue-throughput.ts

Pre-seeds N DRAFT invoices, then issues them in parallel via `Promise.all` with concurrency cap. Captures total wall clock + per-request latency, computes throughput, then verifies the assigned `invoiceNumber` sequence is gapless on the issued slice.

Flags: `--count=N` (default 100), `--concurrency=N` (default 50), `--cleanup` (delete drafts that never issued).

Issued invoices cannot be deleted (state-machine guard) — re-runs simply burn the next slot in the fiscal sequence. The numbering audit groups by `INV-YYYY-` prefix and confirms `[N..N+count-1]` contiguously.

### perf-cache-hitratio.ts

Reads hit/miss counters via the dev-only `GET /invoices/_debug/pdf-cache-stats` route on `PdfRendererService`. Drives a 90/10 hot/cold skewed access pattern over a warm set of 10 issued invoices. The dev-only route returns 404 when `NODE_ENV === 'production'`.

Flags: `--warmSet=N` (default 10), `--requests=N` (default 200), `--hotSkew=K` (default 3).

## Last measured numbers (Sweep C-22, 2026-05-02, M-series Mac, local Postgres)

| Scenario | Threshold | Run 1 | Run 2 | Verdict |
|---|---|---|---|---|
| S-PERF-003 hot-cache | p95 < 500ms | p95 = 15.51ms | p95 = 16.53ms | PASS (~30× headroom) |
| S-PERF-003 cache-bust | p95 < 500ms | p95 = 20.27ms | p95 = 16.21ms | PASS |
| S-PERF-004 throughput | ≥ 50/sec gapless | 339.40/sec, gapless | 346.77/sec, gapless | PASS (~6.8× headroom) |
| S-PERF-005 hit ratio | > 80% | 95.00% | 95.00% | PASS |

Re-run periodically. If a number regresses below threshold, capture in `docs/INVOICING_E2E_SCENARIOS.md` Section 20 and open a BUG. Don't refactor inside the benchmark — diagnose first, then fix in a focused PR.
