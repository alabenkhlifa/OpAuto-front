# AI Provider Abstraction Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the frontend AI service abstraction — models + service — that wraps the backend AI proxy and pre-defines interfaces for all 4 upcoming AI features.

**Architecture:** Single `AiService` delegating to NestJS backend via `ApiService.post()`. Models file defines all request/response interfaces. Service exposes `loading`/`error` signals for reactive UI. Future endpoints are stubbed (try backend, catch 404 → NOT_IMPLEMENTED).

**Tech Stack:** Angular 15+, TypeScript, RxJS, Angular Signals

**Spec:** `docs/superpowers/specs/2026-03-28-ai-provider-abstraction-design.md`

---

### Task 1: Create AI model interfaces

**Files:**
- Create: `src/app/core/models/ai.model.ts`

- [ ] **Step 1: Create the AI model file with all interfaces**

Create `src/app/core/models/ai.model.ts` with these interfaces:

**AiError** — `code` field with union type `'PROVIDER_UNAVAILABLE' | 'RATE_LIMITED' | 'NOT_IMPLEMENTED' | 'UNKNOWN'`, and `message: string`.

**Chat interfaces:**
- `AiChatMessage` — `role: 'user' | 'assistant'`, `content: string`
- `AiChatRequest` — `messages: AiChatMessage[]`, `context?: string`
- `AiChatResponse` — `message: string`, `provider: string`

**Diagnose interfaces:**
- `AiDiagnoseRequest` — `symptoms: string`, optional `carMake`, `carModel`, `carYear` (all strings)
- `AiDiagnoseResponse` — `diagnosis: string`, `recommendations: string[]`, `urgency: string`, `provider: string`

**Estimate interfaces:**
- `AiEstimateRequest` — `serviceType: string`, optional `carMake`, `carModel`, `description`
- `AiEstimateResponse` — `estimatedCost: { min: number; max: number }`, `estimatedHours: number`, `breakdown: string[]`, `provider: string`

**Schedule interfaces (future):**
- `AiScheduleSuggestion` — `start: string`, `end: string`, `mechanicId: string`, `mechanicName: string`, `score: number`, `reason: string`
- `AiScheduleRequest` — `appointmentType: string`, optional `preferredDate`, `mechanicId`, `estimatedDuration: number`
- `AiScheduleResponse` — `suggestedSlots: AiScheduleSuggestion[]`, `provider: string`

**Insights interfaces (future):**
- `AiInsightHighlight` — `label: string`, `trend: 'up' | 'down' | 'stable'`, `detail: string`
- `AiInsightsRequest` — `period: 'week' | 'month' | 'quarter'`, optional `metrics: Record<string, number>`
- `AiInsightsResponse` — `insights: string[]`, `highlights: AiInsightHighlight[]`, `provider: string`

**Maintenance prediction interfaces (future):**
- `AiMaintenancePrediction` — `service: string`, `predictedDate: string`, `confidence: number`, `urgency: 'low' | 'medium' | 'high'`, `reason: string`
- `AiMaintenancePredictionRequest` — `carId: string`, `currentMileage: number`
- `AiMaintenancePredictionResponse` — `predictions: AiMaintenancePrediction[]`, `provider: string`

**Churn prediction interfaces (future):**
- `AiChurnPrediction` — `customerId: string`, `customerName: string`, `churnRisk: number`, `riskLevel: 'low' | 'medium' | 'high'`, `factors: string[]`, `suggestedAction: string`
- `AiChurnPredictionRequest` — optional `customerId: string`
- `AiChurnPredictionResponse` — `predictions: AiChurnPrediction[]`, `provider: string`

All interfaces should be exported. Follow the pattern in `src/app/core/models/customer.model.ts` — plain exported interfaces, no decorators, no classes.

- [ ] **Step 2: Verify the models compile**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds (models are standalone types, no runtime impact)

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/ai.model.ts
git commit -m "feat: add AI model interfaces for all 7 AI features"
```

---

### Task 2: Create AiService with live endpoints

**Files:**
- Create: `src/app/core/services/ai.service.ts`

**Dependencies:**
- `ApiService` from `src/app/core/services/api.service.ts` — use `inject(ApiService)`
- All types from `src/app/core/models/ai.model.ts`
- Angular: `Injectable`, `inject`, `signal` from `@angular/core`
- RxJS: `Observable`, `throwError` from `rxjs`, `tap`, `catchError` from `rxjs/operators`
- Angular HTTP: `HttpErrorResponse` from `@angular/common/http`

- [ ] **Step 1: Create the service file with reactive state and helper**

Create `src/app/core/services/ai.service.ts`:

- Decorate with `@Injectable({ providedIn: 'root' })`
- Inject `ApiService` using `private api = inject(ApiService)`
- Declare two public signals:
  - `loading = signal(false)`
  - `error = signal<AiError | null>(null)`
- Implement a private generic helper method `callAi<TReq, TRes>(endpoint: string, request: TReq): Observable<TRes>` that:
  1. Sets `this.loading.set(true)` and `this.error.set(null)`
  2. Returns `this.api.post<TRes>(endpoint, request)` piped with:
     - `tap(() => this.loading.set(false))` on success
     - `catchError((err: HttpErrorResponse) => { ... })` that:
       - Maps HTTP status to `AiError.code`: 429 → `'RATE_LIMITED'`, 503 or status 0 (network) → `'PROVIDER_UNAVAILABLE'`, 404 → `'NOT_IMPLEMENTED'`, else → `'UNKNOWN'`
       - Builds the `AiError` object using the mapped code and `err.message` (or `err.statusText` as fallback)
       - Sets `this.loading.set(false)` and `this.error.set(aiError)`
       - Returns `throwError(() => aiError)`

- [ ] **Step 2: Add the 3 live endpoint methods**

Add these public methods to `AiService`:

- `chat(request: AiChatRequest): Observable<AiChatResponse>` — calls `this.callAi<AiChatRequest, AiChatResponse>('/ai/chat', request)`
- `diagnose(request: AiDiagnoseRequest): Observable<AiDiagnoseResponse>` — calls `this.callAi<AiDiagnoseRequest, AiDiagnoseResponse>('/ai/diagnose', request)`
- `estimate(request: AiEstimateRequest): Observable<AiEstimateResponse>` — calls `this.callAi<AiEstimateRequest, AiEstimateResponse>('/ai/estimate', request)`

- [ ] **Step 3: Add the 4 stubbed future methods**

Add these public methods — they use the same `callAi` helper (so they'll go live automatically when the backend endpoints exist):

- `suggestSchedule(request: AiScheduleRequest): Observable<AiScheduleResponse>` — calls `this.callAi('/ai/suggest-schedule', request)`
- `generateInsights(request: AiInsightsRequest): Observable<AiInsightsResponse>` — calls `this.callAi('/ai/insights', request)`
- `predictMaintenance(request: AiMaintenancePredictionRequest): Observable<AiMaintenancePredictionResponse>` — calls `this.callAi('/ai/predict-maintenance', request)`
- `predictChurn(request: AiChurnPredictionRequest): Observable<AiChurnPredictionResponse>` — calls `this.callAi('/ai/predict-churn', request)`

- [ ] **Step 4: Verify the service compiles**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/ai.service.ts
git commit -m "feat: add AiService with 7 methods, loading/error signals"
```

---

### Task 3: Verify lint and build

**Files:**
- None (verification only)

- [ ] **Step 1: Run lint**

Run: `npm run lint 2>&1 | tail -10`
Expected: No lint errors in the new files

- [ ] **Step 2: Run full build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds with no errors

- [ ] **Step 3: Fix any issues**

If lint or build fails, fix the issues in the relevant file and re-run.

---

### Task 4: Update MVP progress

**Files:**
- Modify: `docs/MVP_PROGRESS.md`

- [ ] **Step 1: Check off the AI provider abstraction item**

In `docs/MVP_PROGRESS.md`, change line under "Batch 8: AI Features (MVP)":
```
- [ ] AI provider abstraction (frontend `core/services/ai/` — interface, Claude, OpenAI, mock)
```
to:
```
- [x] AI provider abstraction (frontend `core/services/ai.service.ts` — backend-delegating service with 7 methods)
```

- [ ] **Step 2: Commit**

```bash
git add docs/MVP_PROGRESS.md
git commit -m "docs: mark AI provider abstraction as complete"
```

---

## Verification Checklist

After all tasks are complete, verify:

1. `ng build` passes with no errors
2. `npm run lint` passes with no errors
3. `src/app/core/models/ai.model.ts` exports all 17 interfaces (7 request, 7 response, 3 sub-types like AiChatMessage/AiScheduleSuggestion/etc + AiError)
4. `src/app/core/services/ai.service.ts` has 7 public methods + 2 public signals + 1 private helper
5. The service uses `inject(ApiService)` pattern (not constructor injection)
6. Error mapping covers: 429→RATE_LIMITED, 503/0→PROVIDER_UNAVAILABLE, 404→NOT_IMPLEMENTED, else→UNKNOWN
7. `docs/MVP_PROGRESS.md` shows the AI provider abstraction checked off
