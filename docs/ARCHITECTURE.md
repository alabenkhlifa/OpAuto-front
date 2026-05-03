# Smart Garage — Architecture & Project Map

DO NOT re-scan the project — use this index.

## Overview
Angular 15+ frontend + NestJS backend mini-ERP for garages.
Dark glassmorphism theme, i18n (en/fr/ar+RTL), mobile-first (375px).

## Deployment
| Layer | Service | URL |
|-------|---------|-----|
| Frontend | Vercel | — |
| Backend | Render | — |
| Database | Supabase (hosted PostgreSQL) | — |

## Frontend
```
src/app/
├── app-routing-module.ts          ← All routes (34+), lazy-loaded standalone components
├── core/
│   ├── models/                    ← All interfaces/types (*.model.ts)
│   │   ├── appointment, approval, auth, customer, employee
│   │   ├── garage-settings, invoice, maintenance, onboarding
│   │   ├── part, report, subscription, user
│   │   ├── quote, credit-note, service-catalog          ← (2026-04-30 invoicing overhaul)
│   ├── services/                  ← Global services (auth, customer, employee, etc.)
│   │   ├── invoice.service.ts, quote.service.ts        ← (2026-04-30) extracted from inline component code
│   │   ├── credit-note.service.ts, payment.service.ts
│   │   ├── service-catalog.service.ts
│   └── guards/                    ← auth.guard.ts (authGuard, guestGuard), role.guard.ts (ownerGuard, moduleGuard)
├── features/                      ← One folder per route, standalone components
│   ├── appointments/              ← + services/appointment.service.ts, components/appointment-modal
│   ├── calendar/                  ← FullCalendar (month/week/day), drag-and-drop, mechanic color-coding
│   ├── cars/                      ← + services/car.service.ts, components/car-card, car-registration-form
│   ├── customers/                 ← + components/customer-details, customer-analytics
│   ├── maintenance/               ← + components/maintenance-form, maintenance-details, job-card, filters, stats
│   ├── invoicing/                 ← Shell with sticky sub-nav + "+ New" dropdown (2026-04-30 overhaul)
│   │   ├── pages/                 ←   dashboard/, invoice-list/, quote-list/, quote-form/, quote-detail/,
│   │   │                              credit-note-list/, credit-note-form/, reports/, templates/
│   │   ├── components/            ←   part-picker/, service-picker/, payment-modal/, send-invoice-modal/,
│   │   │                              ar-aging.component, z-report.component, invoice-form, invoice-details
│   ├── inventory/                 ← + services/, components/part-modal, stock-adjustment-modal
│   ├── employees/                 ← + components/employee-form, employee-details, employee-card, filters, stats
│   ├── approvals/                 ← + components/approval-modal
│   ├── reports/                   ← + components/financial-reports, operational-reports, inventory-reports
│   ├── users/                     ← + components/user-card, user-invite-modal, user-stats
│   ├── garage-settings/           ← + components/garage-info-form, business/operational/system/integration-settings
│   ├── dashboard/                 ← KPI cards, charts (ng2-charts), AI insights widget
│   ├── notifications/             ← Full notification page with filters
│   ├── assistant/                 ← AI Orchestrator chat panel (mounted globally in app.html)
│   │   ├── components/            ←   assistant-launcher (floating btn + composes panel),
│   │   │                              assistant-panel (slide-in card + slots),
│   │   │                              assistant-message-list, assistant-message,
│   │   │                              assistant-input, assistant-voice-controls,
│   │   │                              assistant-conversation-list, assistant-empty-state,
│   │   │                              assistant-conversation-drawer (slide-in history overlay),
│   │   │                              assistant-approval-card (action-preview body via NgComponentOutlet),
│   │   │                              assistant-action-preview/ (sms/email/create+cancel-appointment/
│   │   │                                record-payment per-tool preview components)
│   │   └── services/              ←   assistant-state, assistant-chat, assistant-context,
│   │                                  assistant-voice, assistant-tool-presenter
│   │                                  (28-tool registry mapping → friendly i18n keys + extractors;
│   │                                  see tool-presenters.ts; design spec
│   │                                  docs/superpowers/specs/2026-05-03-assistant-ui-redesign-design.md)
│   ├── profile/, auth/, subscription/, staff-management/
│   └── modules/                   ← Module marketplace (replaces subscription tiers)
├── shared/
│   ├── components/                ← sidebar, language-toggle, onboarding-tour, photo-gallery/upload,
│   │                                 upgrade-prompt, feature-lock, theme-toggle, notification-bell
│   ├── services/                  ← accessibility.service.ts, export.service.ts
│   ├── directives/, pipes/, utils/
└── assets/i18n/                   ← en.json, fr.json, ar.json
```

Repo root also has `scripts/check-i18n-parity.js` (2026-04-30) — i18n drift detector wired into `npm run i18n:check`.

## Backend
```
opauto-backend/
├── src/
│   ├── main.ts                        ← Bootstrap + CORS config
│   ├── app.module.ts                  ← Root module
│   ├── auth/                          ← JWT auth (access + refresh tokens), guards, strategies
│   ├── users/                         ← User CRUD + roles (OWNER | STAFF only — no MECHANIC)
│   ├── customers/                     ← Customer CRUD (extended with mfNumber)
│   ├── cars/                          ← Car CRUD + history
│   ├── appointments/                  ← Appointment CRUD + scheduling
│   ├── maintenance/                   ← Job workflow + assignments
│   ├── invoicing/                     ← Fiscal-grade invoicing pipeline (2026-04-30 overhaul):
│   │   ├── numbering.service.ts       ←   gapless atomic counter via prisma.$transaction
│   │   ├── tax-calculator.service.ts  ←   per-line TVA + fiscal stamp; totals are derived
│   │   ├── invoice-state.ts           ←   table-driven state machine (DRAFT→SENT→VIEWED→…→PAID)
│   │   ├── exceptions/invoice-locked.exception.ts ← HTTP 423 on post-issue line edits
│   │   ├── from-job.service.ts        ←   maintenance-job → invoice line items
│   │   ├── pdf-renderer.service.ts    ←   pdfkit + LRU cache, QR for public link
│   │   ├── delivery.service.ts        ←   Resend email + wa.me WhatsApp + DeliveryLog
│   │   ├── quotes.{controller,service}.ts        ← devis flow (DRAFT→SENT→APPROVED/REJECTED)
│   │   ├── credit-notes.{controller,service}.ts  ← avoir flow + restock toggle
│   │   └── payments.controller.ts     ←   split out for role-scoped payment recording
│   ├── services-catalog/              ← (2026-04-30) ServiceCatalog CRUD (code, label, defaults)
│   ├── inventory/                     ← Parts + stock management
│   ├── employees/                     ← Employee CRUD + schedules
│   ├── approvals/                     ← Approval workflows
│   ├── reports/                       ← Analytics + report generation
│   │   ├── ar-aging.service.ts        ← (2026-04-30) days-overdue buckets, JSON + CSV
│   │   ├── customer-statement.service.ts ← (2026-04-30) chronological events + running balance
│   │   ├── z-report.service.ts        ← (2026-04-30) daily HT/TVA/TTC + payment-method aggregation
│   │   └── accountant-export.service.ts ← (2026-04-30) Tunisian-accountant CSV column set
│   ├── public/                        ← (2026-04-30) token-gated public PDF route
│   │   ├── public.module.ts
│   │   ├── invoice-public.controller.ts
│   │   └── invoice-token.service.ts   ← signs JWTs with INVOICE_TOKEN_SECRET (falls back to JWT_SECRET)
│   ├── notifications/                 ← In-app + WhatsApp (simulated)
│   ├── modules/                       ← Module marketplace + subscriptions
│   ├── ai/                            ← AI proxy + assistant orchestrator
│   ├── assistant/                     ← AI Orchestrator (chat, tools, skills, agents)
│   ├── email/                         ← Resend driver + mock + factory provider
│   ├── garage-settings/               ← Garage configuration (extended: mfNumber, rib, bankName, logoUrl,
│   │                                     defaultPaymentTermsDays, numberingPrefix, numberingResetPolicy,
│   │                                     numberingDigitCount, defaultTvaRate, fiscalStampEnabled,
│   │                                     discountAuditThresholdPct)
│   └── common/                        ← Decorators, filters, interceptors, pipes, DTOs
├── prisma/                            ← PostgreSQL schema + migrations + seed data
│                                        New models (2026-04-30): Quote, QuoteLineItem, CreditNote,
│                                        CreditNoteLineItem, InvoiceCounter, ServiceCatalog,
│                                        DiscountAuditLog, DeliveryLog. New enums: NumberingResetPolicy,
│                                        QuoteStatus, CreditNoteStatus, CounterKind, DeliveryChannel,
│                                        DeliveryStatus. InvoiceStatus extended with VIEWED.
└── test/                              ← e2e tests
```

## Roles & Access
- **Owner** (email login): full access to all modules
- **Staff** (username login): dashboard, appointments, cars, customers, maintenance, profile, **invoicing** (2026-04-30 — quotes, invoices, credit notes, payments; cannot delete invoices)
- **Owner-only** (ownerGuard): inventory, reports, employees, users, settings, approvals, subscription, `DELETE /invoices/:id`
- **UserRole enum**: `OWNER | STAFF` only (no MECHANIC)

## Key Patterns
- Frontend services → HttpClient to NestJS backend (mock fallback for offline dev)
- Per-module freemium pricing replaces subscription tiers
- Translations: `TranslationService` + `assets/i18n/{en,fr,ar}.json`
- Styles: `/src/styles/` — global classes only, no component-level custom CSS
- Auth: JWT (access + refresh tokens), bcrypt password hashing
- Database: PostgreSQL + Prisma ORM
- Validation: class-validator + class-transformer for DTOs
