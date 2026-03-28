# Smart Garage — MVP Plan

## Product Vision
Smart Garage (OpAuto) is a mini-ERP for **all garage types** — not just mechanics. Academic project, 6-month timeline across 5 phases.
**Goal**: Fully functional ERP platform + academic demo, usable for real garages in Tunisia.
**Hero feature**: Calendar view for the presentation demo.

### Development Phases
1. Planning & requirements
2. Design (mockup, glassmorphism design system, DB schema)
3. Core development (free tier → paid modules, incremental)
4. AI integration (predictive maintenance, smart scheduling, narrator, churn prediction)
5. Testing & refinement

### Deployment
| Layer | Service |
|-------|---------|
| Frontend | Vercel |
| Backend | Render |
| Database | Supabase (hosted PostgreSQL) |

### Supported Specializations
Garages select multiple specializations → UI adapts job types and terminology:
- **Mechanical** — engine, transmission, brakes, suspension
- **Bodywork** — dent repair, painting, panel replacement
- **Electrical** — wiring, ECU diagnostics, sensors, battery
- **Tire & Alignment** — tire changes, balancing, wheel alignment

---

## Module System (Freemium Per-Module)

### Free Modules
| Module | Description |
|--------|-------------|
| Customers | Full CRUD, search, analytics |
| Cars | Registration, history, details |
| Basic Dashboard | KPIs, quick actions, today's overview |
| Basic Appointments | List view, create/edit/cancel |

### Paid Modules
| Module | Category |
|--------|----------|
| Calendar View | Operations |
| Maintenance & Jobs | Operations |
| Invoicing | Finance |
| Inventory | Finance |
| Employees | Team |
| Reports & Analytics | Finance |
| Approvals | Operations |
| User Management | Team |
| Advanced Settings | Core |
| AI Features | Intelligence |
| Notification Center | Core |

---

## Feature Specs

### Calendar (Hero Feature)
**Library**: FullCalendar (free plugins: daygrid, timegrid, interaction, list)
- Views: Month, Week, Day, List
- Drag-and-drop rescheduling
- Click empty slot → create appointment; click event → edit in modal
- Mechanic color-coding + filter dropdown (replaces premium resource-timeline)
- Dark theme CSS overrides for glassmorphism

### Notification System
- **Bell icon** in header with unread count + dropdown (5 most recent)
- **Full page** (`/notifications`) with category filters and bulk actions
- **Dashboard widget** showing 3 recent unread
- **Triggers**: appointment changes, approvals, low stock, job status, system
- **Simulated WhatsApp**: preview UI with phone mockup, not actually sent

### Enhanced Dashboard
- **KPI cards**: revenue, appointments, utilization %, active jobs (with trend arrows)
- **Charts** (ng2-charts): revenue trend (line), job distribution (doughnut), mechanic performance (bar)
- Dark theme chart styling with neon accents

### AI Features (Core Differentiator)
Provider-agnostic abstraction (`core/services/ai/`): Claude + OpenAI + mock fallback.
API calls routed through NestJS backend proxy (keys server-side).
- **Smart Scheduling**: "AI Suggest" button on appointment form → balance mechanic workload + bay availability → top 3 time slots
- **Analytics Narrator**: "Generate Insights" on dashboard → natural language summary bullet points
- **Predictive Maintenance**: AI predictions on car detail view → estimate upcoming services from mileage + history
- **Customer Churn Prediction**: Identify at-risk customers from visit frequency and engagement patterns

---

## Roadmap (Post-MVP)

### Short-term
| Feature | Complexity |
|---------|-----------|
| AI Diagnostic Chatbot (symptom-based LLM diagnosis) | High |
| Intelligent Invoice Generation (AI-suggested line items) | Medium |
| Work Order Copilot (AI suggestions for maintenance jobs) | Medium |
| VIN Auto-Decoding (automatic vehicle ID from VIN) | Low |
| WhatsApp & SMS Notifications (real delivery via WhatsApp Business API) | Medium |

### Long-term
| Feature | Complexity |
|---------|-----------|
| RAG Knowledge Base (NL search over repair manuals/OEM docs) | High |
| Image-Based Damage Assessment (computer vision) | High |
| Demand Forecasting (parts demand from appointments/seasonal trends) | High |
| Customer Portal (self-service for history and appointments) | Medium |
| Mobile Native App | High |

---

## Implementation Phases

```
Phase 1 (Modules) ──┬── Phase 2 (Calendar)
                     └── Phase 3 (Notifications + Dashboard)
                              ↓
              Phase 4 (Backend) → Phase 5 (AI)
```

1. **Module System** — models, service, guards, marketplace page, sidebar integration
2. **Calendar View** — FullCalendar integration, dark theme, appointment modal wiring
3. **Notifications + Dashboard** — bell component, notifications page, KPI cards, charts
4. **Backend + Integration** — NestJS scaffold, all CRUD endpoints, JWT auth, migrate frontend to HttpClient
5. **AI Features** — provider abstraction, smart scheduling, analytics narrator, predictive maintenance, churn prediction

---

## Risks
| Risk | Mitigation |
|------|------------|
| FullCalendar CSS conflicts | CSS variable overrides, scoped `::ng-deep` |
| Module migration breaks features | Keep SubscriptionService as wrapper, migrate incrementally |
| Frontend↔Backend friction | Define DTOs early, keep mock fallbacks |
| AI key exposure | Backend proxy handles all AI calls |
| Translation file growth | Batch all keys per phase |
