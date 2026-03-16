# OpAuto — MVP Implementation Plan

## Context

OpAuto is an Angular mini-ERP for multi-specialty garages. All core CRUD features are built (dashboard, appointments, cars, customers, maintenance, invoicing, inventory, employees, approvals, reports, users, garage settings, subscription, profile). The next step is evolving into a **freemium product** with premium features: calendar, notifications, enhanced analytics, and AI-powered tools.

**Goal**: Presentable academic demo + usable product for real garages
**Timeline**: ~2 months
**Stack**:
- **Frontend**: Angular 15+, standalone components, dark glassmorphism theme, i18n (en/fr/ar+RTL)
- **Backend**: NestJS (in `opauto-backend/` folder within the same repository)

---

## Business Model: Freemium Per-Module

Replace the current tier-based subscription (Solo/Starter/Professional) with a **per-module monthly pricing** model.

### Free Modules (always available)
| Module | Description |
|--------|-------------|
| Customer Management | Full customer CRUD, search, analytics |
| Car Management | Car registration, history, details |
| Basic Dashboard | KPIs, quick actions, today's overview |
| Basic Appointments | List view, create/edit/cancel appointments |

### Paid Modules (monthly fee each)
| Module | Description | Category |
|--------|-------------|----------|
| Calendar View | Month/week/day calendar, drag-and-drop | Operations |
| Maintenance & Jobs | Job workflow, assignments, status tracking | Operations |
| Invoicing | Invoice creation, PDF export, payment tracking | Finance |
| Inventory | Parts management, stock tracking, alerts | Finance |
| Employees | Staff management, schedules, performance | Team |
| Reports & Analytics | Financial, operational, customer reports | Finance |
| Approvals | Approval workflows for jobs and expenses | Operations |
| User Management | Staff accounts, roles, permissions | Team |
| Advanced Settings | Business config, integrations, branding | Core |
| AI Features | Smart scheduling, analytics narrator, predictive maintenance | Intelligence |
| Notification Center | In-app + simulated WhatsApp notifications | Core |

---

## Feature 1: Calendar View (Hero Feature)

**Library**: FullCalendar (free plugins only)
**Packages**: `@fullcalendar/core`, `@fullcalendar/angular`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, `@fullcalendar/list`

### Capabilities
- **Views**: Month (dayGridMonth), Week (timeGridWeek), Day (timeGridDay), List (listWeek)
- **Drag-and-drop**: Reschedule appointments by dragging events
- **Click interactions**: Empty slot → create appointment (date pre-filled), Event → edit in modal
- **Mechanic color-coding**: Each mechanic assigned a distinct color from a palette
- **Mechanic filtering**: Dropdown to filter appointments by mechanic (replaces premium resource-timeline)
- **Dark theme**: CSS variable overrides for glassmorphism styling

### Decision: No Premium Plugins
Mechanic assignments shown via color-coding and a filter dropdown instead of `@fullcalendar/resource-timeline` (premium). This avoids licensing costs while still demonstrating the feature.

---

## Feature 2: Notification System

### Components
1. **Top Bar** — New component in `app.html` above `<router-outlet>`, contains bell icon with unread badge
2. **Notification Dropdown** — Shows 5 most recent notifications, mark as read, "View All" link
3. **Notifications Page** (`/notifications`) — Full list with category filters, bulk actions
4. **Dashboard Widget** — 3 most recent unread notifications

### Notification Triggers
- Appointment created/updated/cancelled
- Approval requested/approved/rejected
- Low stock alert
- Job status changes (started, completed, delayed)
- System notifications

### Simulated WhatsApp
- WhatsApp shown as a channel option in notification preferences
- Preview messages with phone mockup UI
- Messages are **not actually sent** — real integration deferred to post-MVP

### Models
- `Notification`: id, title, message, category, priority, channel, isRead, createdAt, actionUrl
- `NotificationPreferences`: per-channel and per-category toggles, quiet hours
- `WhatsAppPreview`: recipientName, phone, message, status (draft/scheduled/sent)

---

## Feature 3: Enhanced Analytics Dashboard

### KPI Cards (top of dashboard)
- Revenue today (with trend arrow + %)
- Appointments today vs. last week
- Mechanic utilization %
- Customer satisfaction score
- Each card: glass-card with icon, value, trend indicator, sparkline (tiny chart.js line)

### Charts (below KPIs)
- **Revenue trend** — line chart, last 30 days (ng2-charts)
- **Job type distribution** — doughnut chart
- **Mechanic performance** — horizontal bar chart
- Dark theme: transparent backgrounds, white/gray text, neon accent colors

### Architecture
- Extract hardcoded mock data from dashboard component into a `DashboardService`
- Chart styling: `Chart.defaults.color = '#9ca3af'`, `Chart.defaults.borderColor = 'rgba(255,255,255,0.1)'`

---

## Feature 4: AI Features (Real API Integration)

### Abstraction Layer (Provider-Agnostic)

```
src/app/core/services/ai/
├── ai-provider.interface.ts    ← AIProvider interface, AIMessage, AIOptions types
├── claude-provider.service.ts  ← Claude API implementation
├── openai-provider.service.ts  ← OpenAI API implementation
└── ai.service.ts               ← Main service, factory selects active provider
```

- **Configuration**: API key + provider + model stored in localStorage, configured in Garage Settings
- **Security note**: Direct browser→API calls expose keys. Acceptable for academic project; add disclaimer. Production would use a backend proxy.
- **Mock fallback**: When no API key configured, show hardcoded sample responses so demo always works

### AI Feature: Smart Scheduling
- **Location**: Appointment creation/edit form
- **UX**: "AI Suggest" button next to date/time picker
- **Input**: Current week's appointments, mechanic schedules/specialties, job type, estimated duration
- **Output**: Top 3 suggested time slots with reasoning
- **Display**: Selectable suggestion cards below the form

### AI Feature: Analytics Narrator
- **Location**: Dashboard
- **UX**: "Generate Insights" button (or auto-generate on load if configured)
- **Input**: KPI data, chart data, trend data
- **Output**: 3-5 natural language insight bullet points
- **Display**: Glass-card with sparkle/AI icon

### AI Feature: Predictive Maintenance
- **Location**: Car detail view
- **UX**: "AI Prediction" section
- **Input**: Car make/model/year, mileage, maintenance history, manufacturer intervals
- **Output**: Predicted services needed with dates and reasoning
- **Display**: Timeline/list of upcoming predicted services

---

## What's NOT in the MVP

| Feature | Reason |
|---------|--------|
| VIN Auto-Decode | Lower priority, can add later |
| Real WhatsApp/SMS/Email sending | Requires third-party API integration (Twilio), costs |
| AI Diagnostic Chatbot | Deferred — high effort, lower demo impact |
| AI RAG Knowledge Base | Deferred — needs document ingestion pipeline |
| AI Damage Assessment | Deferred — requires image processing |
| AI Churn Prediction | Deferred — needs historical data patterns |
| AI Inventory Forecasting | Deferred — complex modeling |
| AI Intelligent Invoicing | Deferred — lower priority |
| AI Work Order Copilot | Deferred — complex UX |
| Real payment processing | Deferred to post-MVP |
| Mobile native app | Web responsive only |
| Premium FullCalendar plugins | Licensing cost, free plugins sufficient |

---

## Backend: NestJS (`opauto-backend/`)

The backend lives in `opauto-backend/` within the same repository. It replaces the current frontend mock data (BehaviorSubject/in-memory) with a real API.

### Architecture

```
opauto-backend/
├── src/
│   ├── main.ts                        ← Bootstrap + CORS config
│   ├── app.module.ts                  ← Root module
│   ├── auth/                          ← JWT auth, guards, strategies
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts         ← login, register, refresh
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── guards/                    ← JwtAuthGuard, RolesGuard
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
│   ├── ai/                            ← AI proxy (Claude/OpenAI) — keeps API keys server-side
│   ├── garage-settings/               ← Garage configuration
│   └── common/
│       ├── decorators/                ← @Roles(), @CurrentUser()
│       ├── filters/                   ← Exception filters
│       ├── interceptors/              ← Transform, logging
│       ├── pipes/                     ← Validation
│       └── dto/                       ← Shared DTOs
├── prisma/ (or typeorm config)        ← Database schema + migrations
├── test/                              ← e2e tests
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### Key Decisions
- **Database**: PostgreSQL with Prisma ORM (or TypeORM — TBD)
- **Auth**: JWT (access + refresh tokens), bcrypt password hashing
- **Roles**: Owner and Staff roles enforced via NestJS guards (mirrors frontend ownerGuard)
- **AI Proxy**: Backend proxies AI API calls → API keys stay server-side (solves the localStorage security concern)
- **Validation**: class-validator + class-transformer for DTOs
- **API Docs**: Swagger/OpenAPI via `@nestjs/swagger`

### Backend Commands
```bash
cd opauto-backend
npm run start:dev    # Dev server with hot reload
npm run build        # Production build
npm run test         # Unit tests
npm run test:e2e     # End-to-end tests
npm run migration:run # Run database migrations
```

---

## Implementation Phases

### Phase 1: Module System Foundation (Weeks 1–2)

| Action | File |
|--------|------|
| **Create** | `src/app/core/models/module.model.ts` |
| **Create** | `src/app/core/services/module.service.ts` |
| **Create** | `src/app/core/guards/module.guard.ts` |
| **Create** | `src/app/features/modules/modules.component.ts` + `.html` |
| **Modify** | `src/app/app-routing-module.ts` — add moduleGuard to paid routes, add `/modules` route |
| **Modify** | `src/app/shared/components/sidebar/sidebar.component.ts` — use ModuleService |
| **Modify** | `src/app/shared/components/feature-lock/feature-lock.component.ts` — use ModuleService |
| **Modify** | `src/app/core/services/subscription.service.ts` — deprecate, delegate to ModuleService |
| **Modify** | `src/assets/i18n/{en,fr,ar}.json` — module keys |

### Phase 2: Calendar View (Weeks 3–4)

| Action | File |
|--------|------|
| **Install** | `@fullcalendar/core`, `@fullcalendar/angular`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, `@fullcalendar/list` |
| **Create** | `src/app/features/calendar/calendar.component.ts` + `.html` + `.css` |
| **Modify** | `src/app/app-routing-module.ts` — add `/calendar` route |
| **Modify** | `src/app/shared/components/sidebar/` — add calendar nav item |
| **Modify** | `src/app/features/appointments/components/appointment-modal/` — accept preselectedDate |
| **Modify** | `src/assets/i18n/{en,fr,ar}.json` — calendar keys |

### Phase 3: Notifications + Enhanced Dashboard (Weeks 5–6)
*Can run in parallel with Phase 2 after Phase 1 is complete*

| Action | File |
|--------|------|
| **Create** | `src/app/core/models/notification.model.ts` |
| **Create** | `src/app/core/services/notification.service.ts` |
| **Create** | `src/app/shared/components/top-bar/top-bar.component.ts` |
| **Create** | `src/app/shared/components/notification-dropdown/notification-dropdown.component.ts` |
| **Create** | `src/app/features/notifications/notifications.component.ts` + `.html` |
| **Modify** | `src/app/app.component.html` + `.ts` — add top-bar |
| **Modify** | `src/app/features/dashboard/dashboard.component.ts` + `.html` — KPIs, charts, widget |
| **Modify** | `src/app/app-routing-module.ts` — add `/notifications` route |
| **Modify** | `src/assets/i18n/{en,fr,ar}.json` — notification + dashboard keys |

### Phase 4: Backend Setup + Core APIs (Weeks 7–8)

| Action | File/Folder |
|--------|-------------|
| **Scaffold** | `opauto-backend/` — NestJS project (`nest new opauto-backend`) |
| **Create** | Auth module: JWT strategy, login/register, guards |
| **Create** | Users module: CRUD, roles (owner/staff) |
| **Create** | Customers module: CRUD, search, analytics endpoints |
| **Create** | Cars module: CRUD, history endpoints |
| **Create** | Appointments module: CRUD, scheduling endpoints |
| **Create** | Modules module: marketplace, activation/deactivation endpoints |
| **Create** | Notifications module: CRUD, triggers, preferences |
| **Create** | Database schema (Prisma/TypeORM) + seed data |
| **Create** | AI proxy module: forward requests to Claude/OpenAI (keys server-side) |
| **Modify** | Frontend services — replace mock BehaviorSubjects with HttpClient calls to backend |
| **Modify** | Frontend auth — use JWT tokens from backend instead of mock auth |
| **Modify** | `src/app/core/services/ai/` — route through backend proxy instead of direct browser calls |

### Phase 5: AI Features (Weeks 9–10)

| Action | File |
|--------|------|
| **Create** | `src/app/core/services/ai/ai-provider.interface.ts` |
| **Create** | `src/app/core/services/ai/claude-provider.service.ts` |
| **Create** | `src/app/core/services/ai/openai-provider.service.ts` |
| **Create** | `src/app/core/services/ai/ai.service.ts` |
| **Create** | `src/app/features/ai/ai-features.component.ts` + `.html` |
| **Modify** | `src/app/features/garage-settings/` — add AI config section |
| **Modify** | `src/app/features/calendar/` — add Smart Scheduling |
| **Modify** | `src/app/features/dashboard/` — add AI Insights section |
| **Modify** | `src/app/features/cars/` — add Predictive Maintenance |
| **Modify** | `src/app/app-routing-module.ts` — add `/ai` route |
| **Modify** | `src/assets/i18n/{en,fr,ar}.json` — AI keys |

### Dependency Graph

```
Phase 1 (Modules) ─┬─> Phase 2 (Calendar) ─────────────┐
                    └─> Phase 3 (Notifications+Dash) ───┤
                                                        v
                        Phase 4 (Backend) ──────> Phase 5 (AI Features)
```

Phase 4 (Backend) can start in parallel with Phases 2–3 for the scaffolding and core modules. Frontend integration happens once both sides are ready.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| FullCalendar CSS conflicts with glassmorphism | Calendar looks out of place | CSS variable overrides, scoped via `::ng-deep` |
| Module system migration breaks existing features | Regressions | Keep SubscriptionService as backward-compat wrapper; migrate incrementally |
| Frontend↔Backend integration friction | Delays | Define API contracts (DTOs) early; keep mock services as fallback during migration |
| Database schema changes mid-development | Migration headaches | Use Prisma migrations; design schema upfront before coding |
| AI API keys security | Exposure | Backend proxy handles all AI API calls — keys never reach the browser |
| Translation files growing large | Merge conflicts | Add all keys in one batch per phase |
| Monorepo complexity (Angular + NestJS) | Build/dependency confusion | Separate `package.json` files; clear `opauto-backend/` boundary |

---

## Verification Checklist

- [ ] **Modules**: Toggle modules on/off → sidebar updates, locked routes redirect to `/modules`
- [ ] **Calendar**: Create/edit/drag appointments → data syncs with appointment list view
- [ ] **Notifications**: Trigger events → bell count updates, dropdown shows notification
- [ ] **Dashboard**: Charts render with realistic mock data, KPI trends display correctly
- [ ] **AI (with key)**: Smart Scheduling suggests slots, Narrator generates insights, Predictive shows predictions
- [ ] **AI (no key)**: Mock fallback responses shown gracefully
- [ ] **Backend**: All CRUD endpoints return correct data, JWT auth works, role guards enforce access
- [ ] **Frontend↔Backend**: Services call real API, fallback to mock when backend is down
- [ ] **AI via proxy**: AI requests routed through backend, keys never exposed client-side
- [ ] **i18n**: Switch en/fr/ar → all new UI translates correctly, RTL works for Arabic
- [ ] **Mobile**: All new features responsive at 375px
