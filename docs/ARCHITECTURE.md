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
├── app-routing-module.ts          ← All routes (34), lazy-loaded standalone components
├── core/
│   ├── models/                    ← All interfaces/types (*.model.ts)
│   │   ├── appointment, approval, auth, customer, employee
│   │   ├── garage-settings, invoice, maintenance, onboarding
│   │   ├── part, report, subscription, user
│   ├── services/                  ← Global services (auth, customer, employee, invoice, etc.)
│   └── guards/                    ← auth.guard.ts (authGuard, guestGuard), role.guard.ts (ownerGuard, moduleGuard)
├── features/                      ← One folder per route, standalone components
│   ├── appointments/              ← + services/appointment.service.ts, components/appointment-modal
│   ├── calendar/                  ← FullCalendar (month/week/day), drag-and-drop, mechanic color-coding
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
│   ├── dashboard/                 ← KPI cards, charts (ng2-charts), AI insights widget
│   ├── notifications/             ← Full notification page with filters
│   ├── profile/, auth/, subscription/, staff-management/
│   └── modules/                   ← Module marketplace (replaces subscription tiers)
├── shared/
│   ├── components/                ← sidebar, language-toggle, onboarding-tour, photo-gallery/upload,
│   │                                 upgrade-prompt, feature-lock, theme-toggle, notification-bell
│   ├── services/                  ← accessibility.service.ts, export.service.ts
│   ├── directives/, pipes/, utils/
└── assets/i18n/                   ← en.json, fr.json, ar.json
```

## Backend
```
opauto-backend/
├── src/
│   ├── main.ts                        ← Bootstrap + CORS config
│   ├── app.module.ts                  ← Root module (16 modules)
│   ├── auth/                          ← JWT auth (access + refresh tokens), guards, strategies
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
├── prisma/                            ← PostgreSQL schema + migrations + seed data
└── test/                              ← e2e tests
```

## Roles & Access
- **Owner** (email login): full access to all modules
- **Staff** (username login): dashboard, appointments, cars, customers, maintenance, profile
- **Owner-only** (ownerGuard): inventory, invoicing, reports, employees, users, settings, approvals, subscription

## Key Patterns
- Frontend services → HttpClient to NestJS backend (mock fallback for offline dev)
- Per-module freemium pricing replaces subscription tiers
- Translations: `TranslationService` + `assets/i18n/{en,fr,ar}.json`
- Styles: `/src/styles/` — global classes only, no component-level custom CSS
- Auth: JWT (access + refresh tokens), bcrypt password hashing
- Database: PostgreSQL + Prisma ORM
- Validation: class-validator + class-transformer for DTOs
