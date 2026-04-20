# OpAuto — UI Design System

Read this BEFORE any UI changes. Use ONLY global classes from `/src/styles/`.

## Color Palette
- **Orange** (primary/accent): `#FF8400`
- **Vista Bleu** (secondary): `#8FA0D8`
- **Amande** (light/background): `#F9DFC6`
- **Bleu Oxford** (dark/background): `#0B0829`

## Theme
- **Permanent dark mode** — no theme switching
- Glassmorphism: blur + transparency on dark backgrounds
- Text: `text-white` (headings), `text-gray-300` (labels), `text-gray-400` (meta)
- NO conditional `dark:` classes, NO `text-gray-900 dark:text-white` patterns

---

## Component Systems

### Buttons (`/src/styles/buttons.css`)
```html
<button class="btn-primary">Main CTA</button>      <!-- limit 1 per section -->
<button class="btn-secondary">Cancel</button>       <!-- secondary actions -->
<button class="btn-tertiary">Edit</button>           <!-- neutral, most common -->
<button class="btn-danger">Delete</button>           <!-- destructive only -->
<button class="btn-success">Approve</button>         <!-- positive confirmation -->
<button class="btn-filter-toggle" [class.active]="hasActiveFilters()">Filters</button>
<button class="btn-filter-chip" [class.active]="isActive">Today</button>
```
- Sizes: `btn-sm`, `btn-lg`, `btn-icon`
- Primary pattern: icon + responsive text (`<span class="hidden lg:inline">`)
- NEVER create custom button classes or inline styles

#### AI buttons — `.btn-ai`
Every button that triggers an AI call (Refresh predictions, AI Suggest, Generate Insights, Predict Maintenance, …) must use the shared `.btn-ai` class so users recognize AI actions at a glance. Purple palette, sparkle icon, spinner during the call.

```html
<button type="button" class="btn-ai" [disabled]="loading()" (click)="run()">
  @if (loading()) {
    <span class="btn-ai__spinner"></span>
    {{ 'feature.ai.loading' | translate }}
  } @else {
    <svg style="width:1rem;height:1rem;flex-shrink:0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
    {{ 'feature.ai.run' | translate }}
  }
</button>
```

- Add `btn-ai--block` for a full-width variant (e.g. inside a form card): `<button class="btn-ai btn-ai--block">`
- Always include the spinner + translated "loading" label on the `loading()` branch; never leave an AI button with no visible pending state
- Keep the sparkle SVG; it's the shared visual cue for "this runs AI"
- NEVER style AI buttons with a custom class — if the pattern doesn't fit, extend `.btn-ai` in `buttons.css` instead of branching locally

### Badges (`/src/styles/badges.css`)
```html
<span class="badge badge-active">Active</span>
<span class="badge badge-completed">Completed</span>
<span class="badge badge-pending">Pending</span>
<span class="badge badge-cancelled">Cancelled</span>
<span class="badge badge-priority-{low|medium|high|urgent}">Priority</span>
<span class="badge badge-{in-stock|low-stock|out-of-stock|ordered}">Stock</span>
```
- Style: `border-radius: 12px`, light bg + colored text + matching border
- Sizes: `badge-sm`, `badge-lg`; with icons: `badge-with-icon`
- NO gradients, NO animations

### Cards
```html
<div class="glass-card">
  <h3 class="text-white font-semibold">Title</h3>
  <p class="text-gray-300">Description</p>
</div>
```
- Use `glass-card` for ALL containers
- `glass-modal` for modals, `glass-nav` for navigation

### KPI Cards
```html
<div class="glass-card">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm font-medium text-gray-300">Label</p>
      <p class="text-2xl font-bold text-white">{{ value }}</p>
    </div>
    <div class="text-2xl">icon</div>
  </div>
</div>
```

### Forms (`/src/styles/forms.css`)
```html
<select class="form-select">...</select>       <!-- standard form -->
<select class="filter-select">...</select>      <!-- filter dropdowns -->
<input class="glass-input" />                    <!-- text inputs -->
```
- Glassmorphism styling, `appearance: none`, custom arrow
- Focus: blue accent border + glow. Error: `.error` class adds red border

### Navigation Toggles
```html
<div class="flex items-center gap-2">
  <button (click)="onViewChange('view')"
    class="nav-button flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border-2 transition-all duration-300 font-medium hover:scale-105"
    [class]="currentView() === 'view' ? 'nav-button-active' : 'nav-button-inactive'">
    <svg class="w-4 h-4" stroke="currentColor">...</svg>
    <span class="text-sm">Label</span>
  </button>
</div>
```
- Active: `nav-button-active` (blue gradient)
- Inactive: `nav-button-inactive` (glass effect)

### Screen Header
```html
<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
  <div>
    <h1 class="text-2xl lg:text-3xl font-bold text-white">Title</h1>
    <p class="mt-1 text-gray-300">Description</p>
  </div>
  <div class="flex flex-wrap gap-2"><!-- buttons --></div>
</div>
```

---

## Spacing & Animation
- Padding: `px-4 py-2` (buttons), `gap-2` (tight), `gap-4` (comfortable)
- Radius: `rounded-lg` (buttons/cards), `12px` (badges)
- Transitions: `duration-300`, `hover:scale-105`, `translateY(-1px)`
- Icons: `w-4 h-4`, `stroke="currentColor"`, outline style

---

## Pre-Implementation Checklist
Before ANY UI change, verify:
- [ ] Cards use `glass-card` (not custom bg classes)
- [ ] Buttons from global system (not custom classes)
- [ ] Badges from global system (not component-specific)
- [ ] Text uses `text-white|gray-300|gray-400` only
- [ ] No conditional `dark:` classes
- [ ] Forms use `glass-input`, `form-select`, `filter-select`
- [ ] Navigation toggles follow exact pattern above
- [ ] Icons have proper contrast on dark backgrounds

## Verification Process
After UI changes:
1. Take screenshot via Chrome DevTools MCP
2. Check text contrast (>= 4.5:1 normal, >= 3:1 large)
3. Verify consistency with other screens
4. Never claim "fixed" without evidence

**If user reports same issue twice = FAILURE**

## Never / Always
- NEVER: custom button classes, conditional dark mode, component-specific styling, custom select styling
- ALWAYS: `btn-*` classes, `glass-card`, `badge badge-*`, `filter-select`/`form-select`
