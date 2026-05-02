/**
 * S-PERF-003 — PDF render p95 latency for a typical 5-line invoice.
 *
 * Threshold: p95 < 500ms (catalog target). Hits
 *   GET /api/invoices/:id/pdf
 * sequentially against the local backend, captures latency for each call,
 * computes p50 / p95 / p99, and prints a verdict.
 *
 *   npx ts-node opauto-backend/scripts/perf-pdf-p95.ts
 *
 * Optional flags:
 *   --runs=N           sample size (default 100)
 *   --warmup=N         ignored leading samples (default 5)
 *   --bust             bypass the LRU by writing to invoice.notes between
 *                      calls (forces a re-render every iteration). Default
 *                      mode is "hot cache" — first call is a miss, the rest
 *                      are LRU hits, which mirrors steady-state user load.
 *   --invoiceId=ID     skip seeding and benchmark a specific invoice id.
 *
 * Output:
 *   - `bench:` lines for grepping into the catalog (rate, p50, p95, p99).
 *   - PASS / FAIL verdict with the threshold.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const API = process.env.API ?? 'http://localhost:3000/api';
const OWNER_EMAIL = 'owner@autotech.tn';
const OWNER_PASSWORD = 'password123';
const PERF_CUSTOMER_NAME = 'Perf Bench Customer';
const THRESHOLD_MS = 500;

interface Args {
  runs: number;
  warmup: number;
  bust: boolean;
  invoiceId?: string;
}

function parseArgs(): Args {
  const out: Args = { runs: 100, warmup: 5, bust: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--bust') out.bust = true;
    else if (a.startsWith('--runs=')) out.runs = Number(a.slice(7));
    else if (a.startsWith('--warmup=')) out.warmup = Number(a.slice(9));
    else if (a.startsWith('--invoiceId=')) out.invoiceId = a.slice(12);
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

async function ensurePerfCustomer(prisma: PrismaClient, garageId: string): Promise<string> {
  const existing = await prisma.customer.findFirst({
    where: { garageId, firstName: PERF_CUSTOMER_NAME, lastName: 'Bench' },
  });
  if (existing) return existing.id;
  const created = await prisma.customer.create({
    data: {
      garageId,
      firstName: PERF_CUSTOMER_NAME,
      lastName: 'Bench',
      phone: '+216 99 000 000',
      email: 'perf@bench.local',
      status: 'ACTIVE',
    },
  });
  return created.id;
}

async function ensurePerfCar(prisma: PrismaClient, garageId: string, customerId: string): Promise<string> {
  const existing = await prisma.car.findFirst({
    where: { garageId, customerId, licensePlate: 'PERF-BENCH' },
  });
  if (existing) return existing.id;
  const created = await prisma.car.create({
    data: {
      garageId,
      customerId,
      make: 'Bench',
      model: 'Perf',
      year: 2024,
      licensePlate: 'PERF-BENCH',
    },
  });
  return created.id;
}

async function createAndIssueFiveLineInvoice(
  token: string,
  customerId: string,
  carId: string,
): Promise<{ id: string; invoiceNumber: string }> {
  const create = await fetch(`${API}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      customerId,
      carId,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      lineItems: [
        { description: 'Vidange moteur', quantity: 1, unitPrice: 80, tvaRate: 19, type: 'service' },
        { description: 'Filtre à huile', quantity: 1, unitPrice: 25, tvaRate: 19, type: 'part' },
        { description: 'Plaquettes de frein', quantity: 1, unitPrice: 120, tvaRate: 19, type: 'part' },
        { description: 'Diagnostic électrique', quantity: 0.5, unitPrice: 60, tvaRate: 19, type: 'labor' },
        { description: 'Lavage extérieur', quantity: 1, unitPrice: 15, tvaRate: 7, type: 'service' },
      ],
    }),
  });
  if (!create.ok) throw new Error(`create failed: ${create.status} ${await create.text()}`);
  const draft = (await create.json()) as { id: string };

  const issue = await fetch(`${API}/invoices/${draft.id}/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  if (!issue.ok) throw new Error(`issue failed: ${issue.status} ${await issue.text()}`);
  return (await issue.json()) as { id: string; invoiceNumber: string };
}

async function fetchPdfMs(token: string, invoiceId: string): Promise<number> {
  const t0 = performance.now();
  const res = await fetch(`${API}/invoices/${invoiceId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`pdf fetch failed: ${res.status} ${await res.text()}`);
  }
  // Drain the buffer so the timer covers the full transfer (otherwise
  // node may resolve the promise before the body has been read).
  await res.arrayBuffer();
  return performance.now() - t0;
}

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return NaN;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const frac = pos - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

async function bumpInvoiceNotes(prisma: PrismaClient, invoiceId: string, n: number): Promise<void> {
  // Bump `updatedAt` so the LRU key (`${id}:${updatedAt}`) shifts and the
  // next render is a forced miss. `notes` is the only field mutable
  // post-issue (state machine — line-item / total mutations throw 423).
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { notes: `bench-bust-${n}-${Date.now()}` },
  });
}

(async () => {
  const args = parseArgs();
  console.log(`S-PERF-003 — PDF render p95 latency`);
  console.log(`  api=${API}  runs=${args.runs}  warmup=${args.warmup}  cache=${args.bust ? 'BUST' : 'HOT'}`);

  const token = await login();
  const prisma = new PrismaClient();

  // Resolve garage from the owner JWT — we just decode the payload.
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
  const garageId: string = payload.garageId;
  console.log(`  garageId=${garageId.slice(0, 8)}…  user=${payload.email}`);

  let invoiceId = args.invoiceId;
  let invoiceNumber = '(provided)';
  if (!invoiceId) {
    const customerId = await ensurePerfCustomer(prisma, garageId);
    const carId = await ensurePerfCar(prisma, garageId, customerId);
    const issued = await createAndIssueFiveLineInvoice(token, customerId, carId);
    invoiceId = issued.id;
    invoiceNumber = issued.invoiceNumber;
    console.log(`  seeded invoice=${invoiceNumber} id=${invoiceId.slice(0, 8)}…`);
  } else {
    console.log(`  reusing invoiceId=${invoiceId.slice(0, 8)}…`);
  }

  // Warm-up — eat the cold prisma + pdfkit + qrcode startup costs.
  for (let i = 0; i < args.warmup; i++) {
    await fetchPdfMs(token, invoiceId);
    if (args.bust) await bumpInvoiceNotes(prisma, invoiceId, -1 - i);
  }

  // Measured run.
  const samples: number[] = [];
  for (let i = 0; i < args.runs; i++) {
    if (args.bust) await bumpInvoiceNotes(prisma, invoiceId, i);
    const ms = await fetchPdfMs(token, invoiceId);
    samples.push(ms);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = quantile(sorted, 0.5);
  const p95 = quantile(sorted, 0.95);
  const p99 = quantile(sorted, 0.99);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = samples.reduce((s, x) => s + x, 0) / samples.length;

  console.log(`\nbench: mode=${args.bust ? 'cache-bust' : 'hot-cache'}`);
  console.log(`bench: samples=${samples.length}`);
  console.log(`bench: min=${min.toFixed(2)}ms  avg=${avg.toFixed(2)}ms  max=${max.toFixed(2)}ms`);
  console.log(`bench: p50=${p50.toFixed(2)}ms  p95=${p95.toFixed(2)}ms  p99=${p99.toFixed(2)}ms`);

  const verdict = p95 < THRESHOLD_MS ? 'PASS' : 'FAIL';
  console.log(`bench: threshold=p95<${THRESHOLD_MS}ms  verdict=${verdict}`);

  await prisma.$disconnect();
  process.exit(verdict === 'PASS' ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
