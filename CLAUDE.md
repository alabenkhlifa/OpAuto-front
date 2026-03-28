# OpAuto — Claude Instructions

Mini-ERP for multi-specialty garages. Angular 15+ frontend + NestJS backend. Dark glassmorphism theme, i18n (en/fr/ar+RTL).

## Current Focus
New feature development. All MVP batches complete (see `docs/MVP_PROGRESS.md`).

## Environment
| Component | URL |
|-----------|-----|
| Frontend | `http://localhost:4200` |
| Backend API | `http://localhost:3000/api` |
| Swagger Docs | `http://localhost:3000/api/docs` |
| Database | `postgresql://postgres:postgres@localhost:5432/opauto` |

## Rules
- Read `docs/UI-SYSTEM.md` before ANY UI changes — use only global CSS classes from `/src/styles/`
- Prefer **Chrome DevTools MCP** for browser testing; fall back to Playwright if unavailable
- Never navigate to auth pages automatically
- Write tests BEFORE sensitive functions; never modify tests to make code pass
- Ask before committing — only commit when explicitly requested
- Prefer editing existing files over creating new ones
- Linear: "In Progress" when starting, "Done" only after user confirmation
- Update `docs/MVP_PROGRESS.md` as implementation progresses

## Git Workflow
- Work on `main` only — no feature branches
- Commit format: `type: description` (feat, fix, chore, docs, test, ui)

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
- Pass specific file paths to sub-agents from `docs/ARCHITECTURE.md`

## Common Pitfalls
- **Cache sync**: AppointmentService caches (customers, cars, mechanics) must be loaded via `forkJoin` before sync lookups — or you get "Unknown Customer"
- **Translation keys**: Arabic (`ar.json`) uses singular keys (`feature`, `photo`, `tier`) while en/fr use plural (`features`, `photos`, `tiers`) — keep in sync when editing
- **Mock fallbacks**: SubscriptionService returns hardcoded values. ModuleService is the real access gate.
- **Calendar CSS**: FullCalendar overrides use `::ng-deep` heavily — library updates may break styling
- **Calendar stubs**: `handleDateSelect` and `handleEventDrop` have TODO stubs — drag-and-drop doesn't persist yet

## Plan Mode Review
Offer **BIG CHANGE** (interactive, max 4 issues/section) or **SMALL CHANGE** (1 question/section).
Sections: Architecture → Code Quality → Tests → Performance.
For each issue: file/line refs, 2-3 options (incl. "do nothing"), opinionated recommendation.
Use `AskUserQuestion` — never assume direction.

## Response Style
- English only, concise — no fluff, no trailing summaries
- Lead with action or answer, not reasoning

## Reference Docs (`docs/`)
| Doc | Read when... |
|-----|-------------|
| `docs/ARCHITECTURE.md` | You need to find a file, understand the project structure, or navigate the codebase. Read FIRST before any code task. |
| `docs/UI-SYSTEM.md` | You're touching templates, styles, or anything visual. Read BEFORE writing any HTML/CSS. |
| `docs/TECHNICAL.md` | You're writing new services, components, or tests. Covers coding conventions and dependency rules. |
| `docs/MVP_PLAN.md` | You need context on a feature's purpose, the module system, or what's in/out of scope. |
| `docs/MVP_PROGRESS.md` | You're starting or finishing a feature. Check what's done, update when completing work. |
