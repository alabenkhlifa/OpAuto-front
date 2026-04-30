# OpAuto — Technical Conventions

## Component Standards
- Standalone components (Angular 15+)
- OnPush change detection
- `trackBy` for all `*ngFor`
- Reactive forms over template-driven
- Keep components under 400 lines
- Strict TypeScript — avoid `any`, use proper interfaces

## Service Standards
- `providedIn: 'root'` for singletons
- `catchError` for HTTP error handling
- `takeUntil` pattern for subscriptions (or async pipe)
- `shareReplay()` for shared HTTP calls

## Testing Rules
1. Write tests BEFORE implementing sensitive functions (TDD)
2. NEVER modify existing tests to make failing code pass
3. Each test independent and isolated
4. Mock all external dependencies (HTTP, localStorage)
5. Test both success and failure paths
6. AAA pattern: Arrange, Act, Assert
7. Target 80%+ code coverage

## Dependency Policy
**Core stack**: Angular, RxJS, TailwindCSS, TypeScript (already included)
**Pre-approved**: Chart.js, FullCalendar (free plugins), Lucide Icons, ngx-translate, date-fns
**Avoid unless justified**: state management (NgRx), UI component libraries, animation libraries

Adding a new library requires: justification, alternatives comparison, bundle size check.

## Translation Conventions
- Files: `src/assets/i18n/{en,fr,ar}.json`
- Key format: `feature.component.element` (e.g. `auth.login.emailLabel`)
- Languages: English (primary), French, Arabic (RTL)
- Store preference in localStorage
- All user-facing text must be translated
- **i18n parity check**: `scripts/check-i18n-parity.js` walks all 3 trees, normalises the AR singular/plural pairs (`feature`/`features`, `photo`/`photos`, `tier`/`tiers`), and exits non-zero on drift. Run via `node scripts/check-i18n-parity.js` or `npm run i18n:check` whenever you add or rename keys; clean drift before wiring it into the pre-commit hook.

## Responsive Breakpoints
- Mobile: 375px–767px (iPhone SE 2020 minimum)
- Tablet: 768px–1023px
- Desktop: 1024px+
- Touch targets: minimum 44px

## Fiscal-Record Patterns (2026-04-30 invoicing overhaul)

### State machine
`opauto-backend/src/invoicing/invoice-state.ts` is the canonical template for any future fiscal record. Pattern:
- A typed transition table maps each `from` status to its allowed `to` set.
- `canTransition(from, to)` returns boolean; `assertCanTransition(from, to)` throws `BadRequestException` with a clear message.
- The transition table is the single source of truth — controllers / services don't sprinkle `if (status === 'X')` checks.
- Mutating endpoints call `assertCanTransition` before any DB write.
- Reuse this shape for Quote / CreditNote / and any future Tunisian fiscal record (e.g. delivery notes, proforma invoices).

### Gapless atomic numbering
`opauto-backend/src/invoicing/numbering.service.ts` is the canonical template for any fiscal counter (invoice / quote / credit note / future receipts). Pattern:
- `next(garageId, kind)` runs inside `prisma.$transaction`.
- Upserts a row in `InvoiceCounter` keyed by `(garageId, kind, period)` where `period` is derived from `Garage.numberingResetPolicy` (yearly / monthly / continuous).
- Increments `value` and returns the formatted number using `Garage.numberingPrefix` + zero-padded value (`numberingDigitCount`).
- **Never use `Math.random()` or wall-clock timestamps for fiscal numbers** — gaps and collisions break Tunisian compliance audits.
- The `$transaction` boundary guarantees atomicity even under concurrent issue requests; do not factor it out.
