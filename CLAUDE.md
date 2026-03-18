# Claude Developer Profile & Quick Reference

## 🚨 **CRITICAL ENFORCEMENT RULES**

### 1. Design System Compliance
**BEFORE making ANY UI changes:**
- Read `DESIGN_SYSTEM_CHECKLIST.md` completely
- Follow UI-SYSTEM.md patterns exactly
- Use ONLY global classes from `/src/styles/`
- NO custom CSS, NO conditional `dark:` classes

**Color Palette**:
- **Orange** (primary/accent): `#FF8400`
- **Vista Bleu** (secondary): `#8FA0D8`
- **Amande** (light/background): `#F9DFC6`
- **Bleu Oxford** (dark/background): `#0B0829`

**Quick Reference**:
- Cards: `glass-card` ONLY
- Buttons: `btn-primary|secondary|tertiary|danger|success`
- Badges: `badge badge-{status}`
- Text: `text-white|gray-300|gray-400` (permanent dark theme)

### 2. UI Verification Process (MANDATORY)
When making UI changes:
- Take Playwright screenshots in dark mode
- Check text contrast ratios programmatically
- Never claim "fixed" without completing verification
- **If user reports same issue twice = FAILURE**

### 3. Linear Integration
- Put issues "In Progress" when starting work
- Update to "Done" only after user confirmation
- Include acceptance criteria in issue creation

### 4. Browser Testing Rule
- Prefer **Chrome DevTools MCP** (`chrome-devtools`) for browser testing, screenshots, DOM inspection, network analysis, and performance profiling
- Use Chrome DevTools MCP when verifying UI changes, debugging runtime issues, or taking screenshots
- Fall back to Playwright only when Chrome DevTools MCP is unavailable
- Focus on code changes and compilation feedback
- NEVER navigate to auth pages automatically

### 5. Plan Mode Review Process
**BEFORE making any code changes in plan mode**, work through a structured review:

**Ask first**: Offer two modes:
- **BIG CHANGE**: Interactive review, one section at a time, max 4 issues per section
- **SMALL CHANGE**: Interactive review, 1 question per section

**Review sections (in order)**:
1. **Architecture** — system design, coupling, data flow, scaling, security boundaries
2. **Code Quality** — organization, DRY violations (flag aggressively), error handling gaps, tech debt, over/under-engineering
3. **Tests** — coverage gaps, assertion strength, missing edge cases, untested failure modes
4. **Performance** — N+1 queries, memory, caching opportunities, slow code paths

**For every issue found**:
- Describe concretely with file/line references
- Present 2-3 options (including "do nothing" when reasonable)
- For each option: effort, risk, impact on other code, maintenance burden
- Give opinionated recommendation mapped to engineering preferences (below)
- NUMBER issues, LETTER options (recommended = first option)
- Use `AskUserQuestion` — never assume direction, wait for input before proceeding

**Pause after each section** for feedback before moving to the next.

## 🚧 Product Vision & Roadmap

**OpAuto is a mini-ERP for ALL garage types** — not just mechanics. Academic project, ~2 month deadline. Frontend (Angular) + Backend (NestJS) in the same repository.

### Supported Garage Specializations
Garages can select **multiple** specializations → UI adapts job types, services, and terminology:
- **Mechanical** — engine, transmission, brakes, suspension
- **Bodywork (Carrosserie)** — dent repair, painting, panel replacement, accident damage
- **Electrical / Electronics** — wiring, ECU diagnostics, sensors, battery systems
- **Tire & Alignment** — tire changes, balancing, wheel alignment, rotation

### Module System
- Modules are individually purchasable per-module monthly pricing (replaces tier-based subscriptions)
- **Free modules**: Customers, Cars, Basic Dashboard, Basic Appointments
- **Paid modules**: Calendar, Maintenance, Invoicing, Inventory, Employees, Reports, Approvals, User Management, Advanced Settings, AI Features, Notifications
- Specialization setup: onboarding wizard (first time) + garage settings (change anytime)
- Existing `feature-lock` and `subscription` components will evolve to support module-based access

### Implementation Priorities (ordered)
1. **Calendar View** ← TOP PRIORITY for presentation
   - Month, week, and day views
   - Drag-and-drop rescheduling
   - Mechanic assignments visible in timeline
2. **Analytics Dashboard**
   - KPI cards (revenue, appointment count, utilization %) at top
   - Charts below (ng2-charts): revenue trends, mechanic performance, job type distribution
   - Mock data should look realistic
3. **Notification Center**
   - Bell icon in header with unread count + dropdown
   - Dedicated notifications page with filters, categories, mark-as-read
   - Triggers: appointments, approvals, low stock, job status changes
4. **SMS/Email Reminders** (simulated)
   - Mock notification sending for upcoming appointments
   - UI to configure reminder templates and timing
5. **VIN Auto-Decode** (car registration enhancement)
   - Enter VIN on car registration form → auto-fill make, model, year, engine type
   - Use NHTSA vPIC free API (`https://vpic.nhtsa.dot.gov/api/`) for decoding
   - Future paid module: VIN → OEM parts catalog lookup (vendor APIs like 17vin, Levam)

### UX Polish (ongoing, alongside features)
- Mobile responsiveness on all pages
- Workflow improvements: quick-add car/customer from appointment modal, inline editing
- Visual consistency: all pages follow glassmorphism design system uniformly

### Presentation Goal
**ERP showcase** — demonstrate the multi-specialty module system as the main concept. Calendar view is the hero feature for the demo.

## 🗺️ Project Map (DO NOT re-scan — use this index)

**OpAuto**: Angular 15+ frontend + NestJS backend mini-ERP for garages. Dark glassmorphism theme, i18n (en/fr/ar+RTL), mobile-first (375px).

### Frontend Architecture
```
src/app/
├── app-routing-module.ts          ← All routes, lazy-loaded standalone components
├── core/
│   ├── models/                    ← All interfaces/types (*.model.ts)
│   │   ├── appointment, approval, auth, customer, employee
│   │   ├── garage-settings, invoice, maintenance, onboarding
│   │   ├── part, report, subscription, user
│   ├── services/                  ← Global services (auth, customer, employee, invoice, etc.)
│   └── guards/                    ← auth.guard.ts (authGuard, guestGuard), role.guard.ts (ownerGuard)
├── features/                      ← One folder per route, standalone components
│   ├── appointments/              ← + services/appointment.service.ts, components/appointment-modal
│   ├── cars/                      ← + services/car.service.ts, components/car-card, car-registration-form
│   ├── customers/                 ← + components/customer-details, customer-analytics
│   ├── maintenance/               ← + components/maintenance-form, maintenance-details, job-card, filters, stats
│   ├── invoicing/                 ← + services/invoice.service.ts, components/invoice-form, invoice-details
│   ├── inventory/                 ← + services/, components/part-modal, stock-adjustment-modal
│   ├── employees/                 ← + components/employee-form, employee-details, employee-card, filters, stats
│   ├── approvals/                 ← + components/approval-modal
│   ├── reports/                   ← + components/financial-reports, operational-reports, inventory-reports
│   ├── users/                     ← + components/user-card, user-invite-modal, user-stats
│   ├── garage-settings/           ← + components/garage-info-form, business/operational/system/integration-settings
│   ├── dashboard/, profile/, auth/, subscription/, staff-management/
│   └── reports/
├── shared/
│   ├── components/                ← sidebar, language-toggle, onboarding-tour, photo-gallery/upload, upgrade-prompt, feature-lock, theme-toggle
│   ├── services/                  ← accessibility.service.ts, export.service.ts
│   ├── directives/, pipes/, utils/
└── assets/i18n/                   ← en.json, fr.json, ar.json
```

### Roles & Access
- **Owner** (email login): full access
- **Staff** (username login): dashboard, appointments, cars, customers, maintenance, profile
- **Owner-only** (ownerGuard): inventory, invoicing, reports, employees, users, settings, approvals, subscription

### Backend Architecture
```
opauto-backend/
├── src/
│   ├── main.ts                        ← Bootstrap + CORS config
│   ├── app.module.ts                  ← Root module
│   ├── auth/                          ← JWT auth, guards, strategies
│   ├── users/                         ← User CRUD + roles (owner/staff)
│   ├── customers/                     ← Customer CRUD
│   ├── cars/                          ← Car CRUD + history
│   ├── appointments/                  ← Appointment CRUD + scheduling
│   ├── maintenance/                   ← Job workflow + assignments
│   ├── invoicing/                     ← Invoice CRUD + PDF generation
│   ├── inventory/                     ← Parts + stock management
│   ├── employees/                     ← Employee CRUD + schedules
│   ├── approvals/                     ← Approval workflows
│   ├── reports/                       ← Analytics + report generation
│   ├── notifications/                 ← In-app + WhatsApp (simulated)
│   ├── modules/                       ← Module marketplace + subscriptions
│   ├── ai/                            ← AI proxy (Claude/OpenAI) — keys server-side
│   ├── garage-settings/               ← Garage configuration
│   └── common/                        ← Decorators, filters, interceptors, pipes, DTOs
├── prisma/                            ← Database schema + migrations
├── test/                              ← e2e tests
└── package.json
```

### Key Patterns
- Frontend services currently use **mock data** (BehaviorSubject/Observable) — migrating to HttpClient calls to NestJS backend
- Per-module freemium pricing replaces subscription tiers
- Translations: `TranslationService` + `assets/i18n/{en,fr,ar}.json`
- Styles: `/src/styles/` — global classes only, no component-level custom CSS

### Commands
```bash
# Frontend
ng serve | npm run build | npm run test | npm run lint

# Backend
cd opauto-backend
npm run start:dev | npm run build | npm run test | npm run test:e2e
```

### Docs
`TECHNICAL.md` · `UI-SYSTEM.md` · `FEATURES.md` · `WORKFLOWS.md` · `DESIGN_SYSTEM_CHECKLIST.md` · `MVP_PLAN.md` · `MVP_PROGRESS.md`

## ⚡ Development Reminders

### Engineering Preferences
- **DRY**: Flag repetition aggressively
- **Testing**: Non-negotiable — too many tests > too few
- **Right-sized engineering**: Not hacky, not over-abstracted — engineered enough
- **Edge cases**: Handle more, not fewer — thoughtfulness > speed
- **Explicit > clever**: Readability wins over cleverness

### Critical Rules
1. **Test-Driven Development**: Write unit tests BEFORE implementing sensitive functions
2. **Never modify tests**: Don't change tests after implementation to make them pass
3. **Commit workflow**: Ask before committing - only commit when user explicitly requests
4. **File preference**: ALWAYS prefer editing existing files over creating new ones
5. **Progress tracking**: Update `MVP_PROGRESS.md` as implementation progresses (check off completed items)

### Token Efficiency (MANDATORY)
- **NEVER explore/scan the project to understand structure** — the Project Map above is the source of truth
- **Go directly to the file** — use Glob/Grep for the specific file, not broad exploration agents
- **Read only what you need** — don't read a whole service to find one method signature, use Grep
- **No redundant discovery**: frontend models are in `core/models/`, services in `core/services/` or `features/*/services/`, routes in `app-routing-module.ts`. Backend modules are in `opauto-backend/src/{module-name}/` — go there directly
- **Sub-agents**: pass them the specific file paths from the Project Map, don't let them re-discover the project
- **Translation keys**: go directly to `assets/i18n/en.json` — don't scan for translation files
- Be direct, implement immediately, avoid over-planning
