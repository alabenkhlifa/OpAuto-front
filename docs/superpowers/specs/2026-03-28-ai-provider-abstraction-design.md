# AI Provider Abstraction Layer — Design Spec

## Context

OpAuto's MVP includes 4 AI features (Smart Scheduling, Analytics Narrator, Predictive Maintenance, Customer Churn Prediction) that all need a frontend service layer to communicate with the backend AI proxy. The backend already handles provider selection (Claude → OpenAI → Mock fallback) and exposes 3 endpoints (`/ai/chat`, `/ai/diagnose`, `/ai/estimate`). This spec defines the frontend abstraction that wraps those endpoints and pre-defines interfaces for the 4 upcoming features.

## Decision: Backend-Delegating Service

**Chosen approach:** A single `AiService` that delegates all AI calls to the NestJS backend.

**Why not frontend provider abstraction?** The backend already abstracts Claude/OpenAI/Mock. Duplicating that on the frontend adds complexity, risks API key exposure, and provides zero benefit.

**Why not existing-endpoints-only?** Defining the full interface now is cheap and guides future backend endpoint design. Avoids refactoring the service interface when each new feature lands.

## Files

| File | Location | Purpose |
|------|----------|---------|
| AI models | `src/app/core/models/ai.model.ts` | All request/response interfaces + error type |
| AI service | `src/app/core/services/ai.service.ts` | Injectable service with 7 methods + reactive state |

No new folders — follows existing flat structure.

## Models

### Chat
- **Request:** messages (array of role + content), optional context string
- **Response:** message string, provider name

### Diagnose
- **Request:** symptoms (required), optional carMake, carModel, carYear
- **Response:** diagnosis string, recommendations array, urgency level, provider

### Estimate
- **Request:** serviceType (required), optional carMake, carModel, description
- **Response:** cost range (min/max numbers), estimatedHours, breakdown array, provider

### Smart Schedule (future)
- **Request:** appointmentType, optional preferredDate, mechanicId, estimatedDuration
- **Response:** suggestedSlots array (start, end, mechanicId, mechanicName, score 0-1, reason string), provider

### Analytics Insights (future)
- **Request:** period (week/month/quarter), optional metrics map (string→number)
- **Response:** insights string array, highlights array (label, trend up/down/stable, detail), provider

### Predictive Maintenance (future)
- **Request:** carId, currentMileage
- **Response:** predictions array (service name, predictedDate, confidence 0-1, urgency low/medium/high, reason), provider

### Customer Churn (future)
- **Request:** optional customerId (null = analyze all customers)
- **Response:** predictions array (customerId, customerName, churnRisk 0-1, riskLevel low/medium/high, factors array, suggestedAction), provider

### AiError
- **Fields:** code (PROVIDER_UNAVAILABLE | RATE_LIMITED | NOT_IMPLEMENTED | UNKNOWN), message string

## Service Design

### Dependencies
- `ApiService` via `inject()` — follows existing DI pattern

### Reactive State
- `loading` signal (boolean) — true while any AI call is in flight
- `error` signal (AiError | null) — set on failure, cleared on next call

### Methods

| Method | Endpoint | Status | Behavior |
|--------|----------|--------|----------|
| `chat(request)` | `POST /ai/chat` | Live | Sends message history, returns AI response |
| `diagnose(request)` | `POST /ai/diagnose` | Live | Sends symptoms + car info, returns diagnosis |
| `estimate(request)` | `POST /ai/estimate` | Live | Sends service type + car info, returns cost estimate |
| `suggestSchedule(request)` | `POST /ai/suggest-schedule` | Stubbed | Returns NOT_IMPLEMENTED error |
| `generateInsights(request)` | `POST /ai/insights` | Stubbed | Returns NOT_IMPLEMENTED error |
| `predictMaintenance(request)` | `POST /ai/predict-maintenance` | Stubbed | Returns NOT_IMPLEMENTED error |
| `predictChurn(request)` | `POST /ai/predict-churn` | Stubbed | Returns NOT_IMPLEMENTED error |

### Internal Helper
A generic `callAi<TReq, TRes>(endpoint, request)` method that:
1. Sets `loading` to true and clears `error`
2. Calls `ApiService.post()`
3. On success: sets `loading` to false, returns response
4. On failure: maps HTTP error to `AiError`, sets `loading` to false, sets `error` signal, re-throws

### Stubbed Methods
Future methods call the backend endpoint. If the backend returns 404 (endpoint not yet built), the error is caught and mapped to `NOT_IMPLEMENTED`. This means when the backend endpoints are added, the frontend methods become live automatically — no frontend changes needed.

## Error Handling
- HTTP 429 → `RATE_LIMITED`
- HTTP 503 or network error → `PROVIDER_UNAVAILABLE`
- HTTP 404 (endpoint not built) → `NOT_IMPLEMENTED`
- All other errors → `UNKNOWN`

## Verification
1. `ng build` passes with no errors
2. Import `AiService` in a component, call `chat()` with a test message, verify response from backend
3. Check `loading` signal toggles during the call
4. Check `error` signal populates on failure (e.g., backend offline)
5. Call a stubbed method, verify `NOT_IMPLEMENTED` error is returned
6. Run `npm run lint` — no lint errors
