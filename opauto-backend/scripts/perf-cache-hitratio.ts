/**
 * S-PERF-005 — PDF LRU cache hit ratio under steady-state access.
 *
 * Threshold: hit ratio > 80%. Drives a realistic skewed access pattern
 * (90% of requests hit the 3 most recent invoices, 10% spread across
 * the rest of the warm set) and reads the hit/miss counters from the
 * dev-only `/invoices/_debug/pdf-cache-stats` route on PdfRendererService.
 *
 *   npx ts-node opauto-backend/scripts/perf-cache-hitratio.ts
 *
 * Optional flags:
 *   --warmSet=N   number of distinct invoices in the access pool (default 10)
 *   --requests=N  total PDF requests (default 200)
 *   --hotSkew=K   number of "hot" invoices receiving 90% of traffic (default 3)
 */

import 'dotenv/config';

const API = process.env.API ?? 'http://localhost:3000/api';
const OWNER_EMAIL = 'owner@autotech.tn';
const OWNER_PASSWORD = 'password123';
const THRESHOLD_RATIO = 0.8;

interface Args {
  warmSet: number;
  requests: number;
  hotSkew: number;
}

function parseArgs(): Args {
  const out: Args = { warmSet: 10, requests: 200, hotSkew: 3 };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--warmSet=')) out.warmSet = Number(a.slice(10));
    else if (a.startsWith('--requests=')) out.requests = Number(a.slice(11));
    else if (a.startsWith('--hotSkew=')) out.hotSkew = Number(a.slice(10));
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

async function listIssuedInvoiceIds(token: string, limit: number): Promise<string[]> {
  // Pull the most recent ISSUED-or-later invoices (anything with a real
  // fiscal number). The PDF route works for any non-DRAFT, but we sort by
  // createdAt desc so the warm set reflects the kind of "recent activity"
  // the app actually shows.
  const res = await fetch(`${API}/invoices?page=1&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { items: Array<{ id: string; status: string }> };
  return json.items
    .filter((i) => i.status !== 'DRAFT' && i.status !== 'CANCELLED')
    .map((i) => i.id);
}

async function fetchPdf(token: string, invoiceId: string): Promise<void> {
  const res = await fetch(`${API}/invoices/${invoiceId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`pdf fetch failed: ${res.status} ${await res.text()}`);
  await res.arrayBuffer();
}

async function readStats(token: string, reset = false): Promise<{
  hits: number;
  misses: number;
  hitRatio: number;
  size: number;
  max: number;
}> {
  const url = `${API}/invoices/_debug/pdf-cache-stats${reset ? '?reset=true' : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`stats fetch failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as any;
}

(async () => {
  const args = parseArgs();
  console.log(`S-PERF-005 — PDF cache hit ratio`);
  console.log(`  api=${API}  warmSet=${args.warmSet}  requests=${args.requests}  hotSkew=${args.hotSkew}`);

  const token = await login();
  const ids = await listIssuedInvoiceIds(token, Math.max(args.warmSet, 25));
  if (ids.length < args.warmSet) {
    throw new Error(`only ${ids.length} non-DRAFT invoices available, need ${args.warmSet}`);
  }
  const warm = ids.slice(0, args.warmSet);
  const hot = warm.slice(0, args.hotSkew);
  const cold = warm.slice(args.hotSkew);
  console.log(`  warm=${warm.length}  hot=${hot.length}  cold=${cold.length}`);

  // Reset counters BEFORE the measured run so the warmup-prep phase below
  // doesn't contaminate the ratio.
  await readStats(token, true);

  // Warmup — visit each warm invoice once so it's in the LRU. These are
  // misses on the first call for each id; subsequent skewed reads should
  // hit. The warm phase itself is part of the measurement (we want the
  // ratio over the full session, including the inevitable cold-start
  // misses) — that mirrors how a real user lands on the app and starts
  // re-fetching the same few documents.
  for (const id of warm) {
    await fetchPdf(token, id);
  }

  // Measured access pattern: 90% hot, 10% cold uniform. The catalog text
  // says "skewed toward recent invoices" — this is the simplest realistic
  // distribution that produces meaningful churn at the LRU edge.
  const remaining = Math.max(0, args.requests - warm.length);
  for (let i = 0; i < remaining; i++) {
    const useHot = Math.random() < 0.9;
    const pool = useHot ? hot : cold.length > 0 ? cold : hot;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    await fetchPdf(token, pick);
  }

  const stats = await readStats(token);
  const totalCalls = stats.hits + stats.misses;
  console.log(`\nbench: total=${totalCalls}  hits=${stats.hits}  misses=${stats.misses}`);
  console.log(`bench: hitRatio=${(stats.hitRatio * 100).toFixed(2)}%`);
  console.log(`bench: cacheSize=${stats.size}/${stats.max}`);

  const verdict = stats.hitRatio > THRESHOLD_RATIO ? 'PASS' : 'FAIL';
  console.log(`bench: threshold=>${(THRESHOLD_RATIO * 100).toFixed(0)}%  verdict=${verdict}`);

  process.exit(verdict === 'PASS' ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
