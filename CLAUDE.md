# Smart Garage (OpAuto) — Claude Instructions

Mini-ERP for multi-specialty garages. Angular 20+ (standalone components, signals, modern control-flow) + NestJS 10 backend with Prisma/PostgreSQL. Light theme (white surfaces, dark text on `--color-text-primary: #111827`), orange accent (#FF8400), i18n (en/fr/ar+RTL).

## Current Focus
New feature development. All MVP batches complete (see `docs/MVP_PROGRESS.md`). Fiscal-grade invoicing shipped Apr 2026 (14 commits across 6 phases — gapless atomic numbering, per-line TVA + fiscal stamp, immutable-after-issue state machine, PDF rendering, Resend/wa.me delivery, quotes + credit notes, full reporting, role unlock, UX restructure).

## Environment
| Component | Local | Production |
|-----------|-------|------------|
| Frontend | `http://localhost:4200` | Vercel |
| Backend API | `http://localhost:3000/api` | Render |
| Swagger Docs | `http://localhost:3000/api/docs` | — |
| Database | `postgresql://postgres:postgres@localhost:5432/opauto` | Supabase |

## Rules
- Read `docs/UI-SYSTEM.md` before ANY UI changes — use only global CSS classes from `/src/styles/`
- Prefer **Chrome DevTools MCP** for browser testing; fall back to Playwright if unavailable
- Never navigate to auth pages automatically
- Write tests BEFORE sensitive functions; never modify tests to make code pass
- **Every feature/fix must include unit + integration tests** before being marked complete — launch test-writer agent after implementation, never skip
- **E2E: use `take_snapshot` (not screenshot) as primary tool** — read the FULL snapshot text after every action, check for unexpected elements/errors. Only screenshot for visual layout checks
- Ask before committing — only commit when explicitly requested
- Prefer editing existing files over creating new ones
- Linear: "In Progress" when starting, "Done" only after user confirmation
- **Always** update `docs/MVP_PROGRESS.md` — check off items when done, add new items when starting new work. This is the single source of truth for what's built vs not.

## Git Workflow
- Work on `main` only — no feature branches
- Commit format: `type: description` (feat, fix, chore, docs, test, ui)
- Pre-commit hook (husky): lint-staged + backend typecheck + i18n JSON validation

## Commands
```bash
# Frontend
ng serve | npm run build | npm run test | npm run lint

# Backend
cd opauto-backend
npm run start:dev | npm run build | npm run test | npm run test:e2e

# Prisma (from opauto-backend/)
npm run prisma:generate    # Generate Prisma client after schema changes
npm run prisma:migrate     # Create & apply migrations (prompts for name)
npm run prisma:studio      # Open Prisma Studio GUI (port 5555)
npx prisma db seed         # Seed database with sample data
npx prisma migrate reset   # Drop DB, re-run migrations, re-seed
npx prisma db push         # Push schema changes without migration (dev only)
```

## Engineering Preferences
- **i18n** — ALL user-facing strings MUST use translation keys (`{{ 'key' | translate }}`). Never hardcode English strings in templates, toasts, confirms, or error messages
- **DRY** — flag repetition aggressively
- **Testing** — non-negotiable, too many > too few
- **Right-sized** — not hacky, not over-abstracted
- **Edge cases** — handle more, not fewer
- **Explicit > clever** — readability wins

## Token Efficiency
- Use the Project Map in `docs/ARCHITECTURE.md` — NEVER re-scan the project
- Go directly to files with Glob/Grep — no broad exploration agents
- Read only what you need — don't read whole files for one method
- Translations → `assets/i18n/en.json` directly
- Sub-agents: follow `.claude/agents.md` — always pass specific file paths, never let them re-discover

## Common Pitfalls
- **Cache sync**: AppointmentService caches (customers, cars, mechanics) must be loaded via `forkJoin` before sync lookups — or you get "Unknown Customer"
- **Translation keys**: Arabic (`ar.json`) uses singular keys (`feature`, `photo`, `tier`) while en/fr use plural (`features`, `photos`, `tiers`) — keep in sync when editing
- **Mock fallbacks**: SubscriptionService returns hardcoded values. ModuleService is the real access gate.
- **Calendar CSS**: FullCalendar overrides use `::ng-deep` heavily — library updates may break styling
- **Calendar drag-drop**: `handleEventDrop` persists via `appointmentService.updateAppointment` with AI-assisted conflict detection + closed-day handling. `handleDateSelect` opens the Add Appointment modal pre-filled with the selected slot via `AppointmentModalComponent.setInitialDate`.
- **Invoice numbering**: MUST go through `NumberingService.next(garageId, kind)` — `prisma.$transaction` upsert on `InvoiceCounter`. **Never use `Math.random()`** for fiscal numbers; gaps and collisions break Tunisian fiscal compliance.
- **Fiscal record locking**: Invoices / quotes / credit notes are 423-locked after issue. Only `status` and `notes` are mutable post-issue; line / total mutations throw `InvoiceLockedException` (HTTP 423).
- **Per-line TVA**: TVA lives on `InvoiceLineItem.tvaRate` / `tvaAmount` — totals are derived, not the source of truth. On any line edit, recompute via `TaxCalculatorService` rather than mutating totals directly.
- **UserRole enum**: `OWNER | STAFF` only (no MECHANIC). Invoicing routes use STAFF as the second tier — `@Roles(OWNER, STAFF)` on most endpoints, `@Roles(OWNER)` only on `DELETE /invoices/:id` and discount-approval paths.

## Plan Mode Review
Offer **BIG CHANGE** (interactive, max 4 issues/section) or **SMALL CHANGE** (1 question/section).
Sections: Architecture → Code Quality → Tests → Performance.
For each issue: file/line refs, 2-3 options (incl. "do nothing"), opinionated recommendation.
Use `AskUserQuestion` — never assume direction.

## Task Routing
When the user asks to do something, pick the right command:
- **Bug / broken / not working / wrong** → run `/fix {description}` → then run test-writer + e2e test
- **New feature / add / implement / build** → run `/impl {description}` → then run test-writer + e2e test
- **Verify / test UI** → run `/e2e {description}`
- **Translation / i18n / add key / sync languages** → run `/translate {description}`
- **Finished / ship it** → run `/done`
- **SSH / prod / VPS / deploy logs / prod DB / "is prod running my code?"** → dispatch the **prod-ops** agent (`.claude/agents/prod-ops.md`). Do NOT run raw `ssh almalinux@152.228.229.150` from the main thread — the agent encodes the gotchas (DB user is `opauto` not `postgres`, deploy log lies, verify by grep on `/app/dist/...`).
Do NOT ask the user which command to use. Decide based on the request.

## Prod ops (OVH VPS)
The OpAuto production VPS is at `152.228.229.150` (`almalinux` user, `/opt/opauto`, `docker compose` for `opauto-db` / `opauto-backend` / `opauto-nginx`). Auto-deploy fires on push to `main` via webhook on `:9000/hooks/deploy`. **Use the `prod-ops` agent for any operation against this box** — it owns the SSH patterns, DB credentials, log paths, smoke tests, and the verify-by-grep protocol.

Critical traps the agent already knows (do NOT re-discover the hard way):
- DB role is `opauto`, NOT `postgres` — `psql -U postgres` fails with `role "postgres" does not exist`.
- `=== Deploy completed ===` in `/var/log/opauto-deploy.log` is necessary but NOT sufficient. `set -e` is defeated by `tee` in `deploy.sh`, and parallel webhook fires can race so `git HEAD` advances while the running image stays stale. Always verify by grepping the compiled JS inside the container: `docker exec opauto-backend grep -c '<new-marker>' /app/dist/src/<path>.js`.
- Recovery for a stale image: `cd /opt/opauto && sudo docker compose build backend && sudo docker compose up -d --force-recreate backend`. `up -d --force-recreate` ALONE reuses the old image — you must `build` first.
- The seeded `owner@autotech.tn / password123` smoke-test login currently returns 401. Known divergence from `docs/DEPLOYMENT.md`, NOT a deploy regression — don't chase it unless asked.

The agent is **read + manual deploy trigger** scope: it freely tails logs, queries the DB (SELECT only), greps containers, runs smoke tests, and on explicit user request runs `./deploy/deploy.sh` or the rebuild + force-recreate sequence. It refuses DB writes, prisma migrate/reset, container destroy, and `.env` edits — those need explicit user confirmation through the main thread.

## Response Style
- English only, concise — no fluff, no trailing summaries
- Lead with action or answer, not reasoning
- Questions to the user must use the **AskUserQuestion tool** with clickable options — never list choices as plain text

## Reference Docs (`docs/`)
| Doc | Read when... |
|-----|-------------|
| `docs/ARCHITECTURE.md` | You need to find a file, understand the project structure, or navigate the codebase. Read FIRST before any code task. |
| `docs/UI-SYSTEM.md` | You're touching templates, styles, or anything visual. Read BEFORE writing any HTML/CSS. |
| `docs/TECHNICAL.md` | You're writing new services, components, or tests. Covers coding conventions and dependency rules. |
| `docs/MVP_PLAN.md` | You need context on a feature's purpose, the module system, or what's in/out of scope. |
| `docs/MVP_PROGRESS.md` | You're starting or finishing a feature. Check what's done, update when completing work. |
| `docs/DEPLOYMENT.md` | You need to SSH into the prod VPS, debug a deploy, apply/roll-back a migration, rotate a secret, or recover from an outage. Command-first runbook. |
