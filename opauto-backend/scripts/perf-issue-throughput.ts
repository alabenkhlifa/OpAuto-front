/**
 * S-PERF-004 — Concurrent invoice-issue throughput.
 *
 * Threshold: ≥ 50 issues/sec sustained AND no gaps in the fiscal sequence.
 * Pre-seeds N DRAFT invoices (default 100) and then fires concurrent
 * `POST /invoices/:id/issue` requests with a configurable concurrency cap.
 * The cap exercises the `prisma.$transaction` upsert on `InvoiceCounter`
 * inside `NumberingService.next()` — that's the load-bearing serialization
 * point for gapless atomic numbering.
 *
 *   npx ts-node opauto-backend/scripts/perf-issue-throughput.ts
 *
 * Optional flags:
 *   --count=N          number of invoices to seed + issue (default 100)
 *   --concurrency=N    parallel in-flight issue calls (default 50)
 *   --cleanup          delete the perf customer + cars + drafted/issued
 *                      invoices after the run (off by default — keep them
 *                      around so re-runs can audit the sequence).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const API = process.env.API ?? 'http://localhost:3000/api';
const OWNER_EMAIL = 'owner@autotech.tn';
const OWNER_PASSWORD = 'password123';
const PERF_CUSTOMER_NAME = 'Perf Bench Customer';
const THRESHOLD_RPS = 50;

interface Args {
  count: number;
  concurrency: number;
  cleanup: boolean;
}

function parseArgs(): Args {
  const out: Args = { count: 100, concurrency: 50, cleanup: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--cleanup') out.cleanup = true;
    else if (a.startsWith('--count=')) out.count = Number(a.slice(8));
    else if (a.startsWith('--concurrency=')) out.concurrency = Number(a.slice(14));
  }
  return out;
}

async function login(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function ensurePerfPair(prisma: PrismaClient, garageId: string): Promise<{ customerId: string; carId: string }> {
  let customer = await prisma.customer.findFirst({
    where: { garageId, firstName: PERF_CUSTOMER_NAME, lastName: 'Bench' },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        garageId,
        firstName: PERF_CUSTOMER_NAME,
        lastName: 'Bench',
        phone: '+216 99 000 000',
        email: 'perf@bench.local',
        status: 'ACTIVE',
      },
    });
  }
  let car = await prisma.car.findFirst({
    where: { garageId, customerId: customer.id, licensePlate: 'PERF-BENCH' },
  });
  if (!car) {
    car = await prisma.car.create({
      data: {
        garageId,
        customerId: customer.id,
        make: 'Bench',
        model: 'Perf',
        year: 2024,
        licensePlate: 'PERF-BENCH',
      },
    });
  }
  return { customerId: customer.id, carId: car.id };
}

async function createDraft(token: string, customerId: string, carId: string, idx: number): Promise<string> {
  const res = await fetch(`${API}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      customerId,
      carId,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      notes: `perf-bench-${idx}`,
      lineItems: [
        { description: `bench-line-${idx}`, quantity: 1, unitPrice: 100, tvaRate: 19 },
      ],
    }),
  });
  if (!res.ok) throw new Error(`createDraft[${idx}] failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id: string };
  return json.id;
}

async function issueInvoice(
  token: string,
  invoiceId: string,
): Promise<{ ms: number; status: number; invoiceNumber?: string; error?: string }> {
  const t0 = performance.now();
  const res = await fetch(`${API}/invoices/${invoiceId}/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  const ms = performance.now() - t0;
  if (!res.ok) {
    const body = await res.text();
    return { ms, status: res.status, error: body.slice(0, 200) };
  }
  const json = (await res.json()) as { invoiceNumber: string };
  return { ms, status: res.status, invoiceNumber: json.invoiceNumber };
}

/**
 * Runs `tasks` with at most `concurrency` in-flight at any time.
 * Returns the resolved values in order. Throws on the first rejection.
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIdx = 0;
  const workers = new Array(Math.min(concurrency, tasks.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = nextIdx++;
        if (i >= tasks.length) return;
        results[i] = await tasks[i]();
      }
    });
  await Promise.all(workers);
  return results;
}

(async () => {
  const args = parseArgs();
  console.log(`S-PERF-004 — Concurrent issue throughput`);
  console.log(`  api=${API}  count=${args.count}  concurrency=${args.concurrency}`);

  const token = await login();
  const prisma = new PrismaClient();
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
  const garageId: string = payload.garageId;
  console.log(`  garageId=${garageId.slice(0, 8)}…`);

  const { customerId, carId } = await ensurePerfPair(prisma, garageId);

  // ── seed phase ──────────────────────────────────────────────────────────
  console.log(`\n  seeding ${args.count} DRAFT invoices…`);
  const seedStart = performance.now();
  const draftIds = await runWithConcurrency(
    Array.from({ length: args.count }, (_, i) => () => createDraft(token, customerId, carId, i)),
    args.concurrency,
  );
  const seedMs = performance.now() - seedStart;
  console.log(`  seeded ${draftIds.length} drafts in ${seedMs.toFixed(0)}ms (${(draftIds.length / (seedMs / 1000)).toFixed(2)}/sec)`);

  // ── issue phase ────────────────────────────────────────────────────────
  console.log(`\n  issuing ${args.count} invoices @ concurrency=${args.concurrency}…`);
  const t0 = performance.now();
  const results = await runWithConcurrency(
    draftIds.map((id) => () => issueInvoice(token, id)),
    args.concurrency,
  );
  const wallMs = performance.now() - t0;
  const wallSec = wallMs / 1000;
  const rps = args.count / wallSec;

  const ok = results.filter((r) => r.status === 201);
  const fail = results.filter((r) => r.status !== 201);
  const latencies = ok.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const max = latencies[latencies.length - 1];
  const min = latencies[0];

  console.log(`\nbench: ok=${ok.length}/${args.count}  fail=${fail.length}`);
  console.log(`bench: wall=${wallMs.toFixed(0)}ms  throughput=${rps.toFixed(2)}/sec`);
  console.log(`bench: latency min=${min?.toFixed(2)}ms  p50=${p50?.toFixed(2)}ms  p95=${p95?.toFixed(2)}ms  max=${max?.toFixed(2)}ms`);

  if (fail.length > 0) {
    console.log(`bench: first-failure status=${fail[0].status} body=${fail[0].error}`);
  }

  // ── numbering audit ────────────────────────────────────────────────────
  // Pull the issued invoices we just minted and confirm strict monotonicity
  // with no gaps. Filter by id IN (...) so we ignore unrelated traffic.
  // `lockedAt` is the post-issue timestamp on the schema (the state machine
  // sets it inside `issue()` when DRAFT → SENT).
  const issued = await prisma.invoice.findMany({
    where: { id: { in: draftIds }, status: { not: 'DRAFT' } },
    select: { invoiceNumber: true, lockedAt: true },
    orderBy: [{ lockedAt: 'asc' }, { invoiceNumber: 'asc' }],
  });

  // The fiscal sequence is `INV-YYYY-NNNN`. Group by prefix and check the
  // suffixes form a contiguous run (allowing for the unlikely year rollover
  // case during the run — split into per-prefix groups and check each).
  const byPrefix = new Map<string, number[]>();
  for (const inv of issued) {
    const m = /^([A-Z]+-\d{4,6})-(\d+)$/.exec(inv.invoiceNumber);
    if (!m) continue;
    const arr = byPrefix.get(m[1]) ?? [];
    arr.push(Number(m[2]));
    byPrefix.set(m[1], arr);
  }
  let gaplessOk = true;
  let gapDetail = '';
  for (const [prefix, nums] of byPrefix.entries()) {
    nums.sort((a, b) => a - b);
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] !== nums[i - 1] + 1) {
        gaplessOk = false;
        gapDetail = `${prefix}: gap between ${nums[i - 1]} and ${nums[i]}`;
        break;
      }
    }
    if (!gaplessOk) break;
  }
  console.log(`bench: numbering prefixes=${[...byPrefix.keys()].join(', ')}`);
  console.log(`bench: gapless=${gaplessOk ? 'YES' : 'NO ' + gapDetail}`);

  const rpsOk = rps >= THRESHOLD_RPS;
  const verdict = rpsOk && gaplessOk ? 'PASS' : !gaplessOk ? 'FAIL-GAPS' : 'PARTIAL';
  console.log(`bench: threshold=${THRESHOLD_RPS}/sec gapless  verdict=${verdict}`);

  if (args.cleanup) {
    console.log(`\n  cleanup — deleting issued bench invoices is forbidden by the locking guard.`);
    console.log(`  Drafts that failed to issue:`);
    const draftsRemaining = await prisma.invoice.findMany({
      where: { id: { in: draftIds }, status: 'DRAFT' },
      select: { id: true },
    });
    for (const d of draftsRemaining) {
      await fetch(`${API}/invoices/${d.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    console.log(`  removed ${draftsRemaining.length} unissued drafts.`);
  }

  await prisma.$disconnect();
  process.exit(verdict === 'PASS' ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
