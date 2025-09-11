# UI Design System - OpAuto Dashboard

## 🎨 **CRITICAL: Design System Enforcement**

**⚠️ BEFORE making ANY UI changes, review this document completely.**

**📋 Quick Reference**:
- Cards: `glass-card` ONLY
- Buttons: `btn-primary|secondary|tertiary|danger|success` from global system
- Badges: `badge badge-{status}` from global system  
- Text: `text-white|gray-300|gray-400` (permanent dark theme)
- NO conditional `dark:` classes, NO custom CSS

## 🌙 Dark Mode Only Design

### Theme Approach
- **Permanent dark mode** - No theme switching functionality
- Application optimized for dark backgrounds only
- All components designed with glassmorphism effects
- Apple-style modern glass effect with blur and transparency

### CSS Implementation
- **Primary Method**: Use CSS custom properties with permanent dark mode
- **Selector Pattern**: Direct CSS classes, no conditional theming
- **Text Colors**: Use permanent dark theme colors only

```css
/* Standard pattern for dark theme */
.component-class {
  background-color: rgba(51, 65, 85, 0.5);
  color: var(--color-text-primary);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

## 🔧 Global Component Systems

### 1. Button System (MANDATORY)

**CRITICAL**: All buttons MUST use standardized classes from `/src/styles/buttons.css`

#### Button Hierarchy

```html
<!-- PRIMARY ACTIONS: Add, Save, Create, Submit -->
<button class="btn-primary">
  <svg class="w-4 h-4" stroke="currentColor"><!-- icon --></svg>
  <span class="hidden lg:inline">Action Label</span>
</button>

<!-- SECONDARY ACTIONS: Clear, Cancel, Reset -->
<button class="btn-secondary">Clear Filters</button>

<!-- TERTIARY/NEUTRAL ACTIONS: Edit, View, Adjust -->
<button class="btn-tertiary">Edit</button>

<!-- DANGER ACTIONS: Delete, Remove -->
<button class="btn-danger">Delete</button>

<!-- SUCCESS/CONFIRM ACTIONS: Approve, Confirm -->
<button class="btn-success">Approve</button>

<!-- FILTER TOGGLE BUTTONS -->
<button class="btn-filter-toggle" [class.active]="hasActiveFilters()">
  <svg class="w-4 h-4"><!-- filter icon --></svg>
  <span>Filters</span>
</button>

<!-- FILTER CHIP BUTTONS -->
<button class="btn-filter-chip" [class.active]="isActive">Today</button>
```

#### Button Implementation Rules

1. **NEVER create custom button classes** - Always use the global system
2. **Button Priority Guidelines**:
   - `btn-primary`: Main call-to-action (limit 1 per screen section)
   - `btn-secondary`: Secondary actions that complement primary
   - `btn-tertiary`: Neutral actions, most common button type
   - `btn-danger`: Destructive actions only
   - `btn-success`: Confirmation of positive actions

3. **Size Modifiers**:
   - `btn-sm`: Compact buttons for dense layouts
   - `btn-lg`: Prominent buttons for key actions
   - `btn-icon`: Icon-only buttons

4. **Primary Button Standard**: Based on Car Management "Register Car" button
   - Blue gradient background with glassmorphism blur effect
   - Icon + responsive text pattern
   - Hover animations with translateY and shadow effects

### 2. Badge System (MANDATORY)

**CRITICAL**: All badges MUST use standardized classes from `/src/styles/badges.css`

#### Badge Hierarchy

```html
<!-- STATUS BADGES -->
<span class="badge badge-active">Active</span>
<span class="badge badge-completed">Completed</span>
<span class="badge badge-pending">Pending</span>
<span class="badge badge-cancelled">Cancelled</span>

<!-- PRIORITY BADGES -->
<span class="badge badge-priority-low">Low</span>
<span class="badge badge-priority-medium">Medium</span>
<span class="badge badge-priority-high">High</span>
<span class="badge badge-priority-urgent">Urgent</span>

<!-- INVENTORY BADGES -->
<span class="badge badge-in-stock">In Stock</span>
<span class="badge badge-low-stock">Low Stock</span>
<span class="badge badge-out-of-stock">Out of Stock</span>
<span class="badge badge-ordered">Ordered</span>

<!-- WITH SIZE MODIFIERS -->
<span class="badge badge-sm badge-active">Small</span>
<span class="badge badge-lg badge-success">Large</span>

<!-- WITH ICONS -->
<span class="badge badge-with-icon badge-active">
  <svg class="w-3 h-3"><!-- icon --></svg>
  <span>Active</span>
</span>
```

#### Badge Visual Standards
- **Style**: Car Management Status Legend standard
- **Shape**: `border-radius: 12px` (rounded, not pill-shaped)
- **Colors**: Light transparent background + colored text + matching border
- **No gradients**: Simple, clean appearance
- **No animations**: Static badges for clarity

#### Available Badge Types

| Badge Class | Color | Usage |
|------------|-------|-------|
| `badge-active` | Blue | Active/in-progress status |
| `badge-completed` | Green | Completed/success status |
| `badge-pending` | Amber | Waiting/pending status |
| `badge-cancelled` | Red | Cancelled/failed status |
| `badge-priority-low` | Gray | Low priority |
| `badge-priority-medium` | Amber | Medium priority |
| `badge-priority-high` | Orange | High priority |
| `badge-priority-urgent` | Red | Urgent priority |
| `badge-in-stock` | Green | Stock available |
| `badge-low-stock` | Amber | Low stock warning |
| `badge-out-of-stock` | Red | No stock available |

### 3. Dropdown/Select System (MANDATORY)

**CRITICAL**: All dropdowns MUST use standardized classes from `/src/styles/forms.css`

#### Dropdown Hierarchy

```html
<!-- STANDARD FORM SELECTS -->
<select class="form-select">
  <option value="option1">Option 1</option>
  <option value="option2">Option 2</option>
</select>

<!-- FILTER DROPDOWNS -->
<select class="filter-select" [value]="selectedValue()" (change)="onChange($event)">
  <option value="all">All Items</option>
  <option value="active">Active</option>
</select>

<!-- GENERAL DROPDOWNS -->
<select class="dropdown-select">
  <option>Choose option...</option>
</select>
```

#### Dropdown Features
- **Glassmorphism**: `backdrop-filter: blur(10px)` with rgba backgrounds
- **Cross-Device Consistency**: `appearance: none` to override browser defaults
- **Custom Arrow**: White SVG chevron that works on all devices
- **Dark Theme**: Permanent dark glassmorphism styling
- **Focus States**: Blue accent border and glow on focus
- **Error States**: Red border when `.error` class is added

### 4. Navigation Toggle Pattern (MANDATORY)

**Standard**: Based on Customers screen navigation pattern

```html
<div class="flex items-center gap-2">
  <button (click)="onViewChange('dashboard')"
          class="nav-button flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border-2 transition-all duration-300 font-medium hover:scale-105"
          [class]="currentView() === 'dashboard' ? 'nav-button-active' : 'nav-button-inactive'">
    <!-- MUST have icon -->
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="..."/>
    </svg>
    <!-- MUST have text -->
    <span class="text-sm">Dashboard</span>
  </button>
</div>
```

#### Navigation Button States
```css
/* Active state - Blue gradient */
.nav-button-active {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  border-color: var(--color-primary);
  color: white;
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
}

/* Inactive state - Glass effect */
.nav-button-inactive {
  background-color: var(--color-bg-primary);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

/* Hover state */
.nav-button-inactive:hover {
  background-color: var(--color-bg-tertiary);
  border-color: var(--color-primary);
  color: var(--color-text-primary);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
}
```

### 5. Filter Button Active States (MANDATORY)

**CRITICAL**: All filter buttons MUST show visual feedback when filters are applied

#### Implementation Pattern

```typescript
// Logic Pattern - Track active filters
hasActiveFilters = computed(() => {
  return this.searchQuery() !== '' || 
         this.selectedMake() !== 'all' || 
         this.selectedStatus() !== 'all';
});
```

```html
<!-- HTML Pattern - Dynamic class binding -->
<button class="btn-filter-toggle" [class.active]="hasActiveFilters()" (click)="toggleFilters()">
  <svg class="w-4 h-4"><!-- filter icon --></svg>
  <span>Filters</span>
</button>
```

```css
/* CSS Pattern - Visual feedback */
.btn-filter-toggle {
  background: rgba(31, 41, 55, 0.6);
  color: #d1d5db;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-filter-toggle.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(29, 78, 216, 0.8));
  border-color: rgba(59, 130, 246, 0.5);
  color: white;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}
```

### 6. Card System (MANDATORY)

#### Glass Card Pattern

```html
<!-- Standard Card -->
<div class="glass-card">
  <h3 class="text-white font-semibold">Title</h3>
  <p class="text-gray-300">Description</p>
</div>

<!-- KPI Card Pattern -->
<div class="glass-card">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm font-medium text-gray-300">Total Jobs</p>
      <p class="text-2xl font-bold text-white">{{ value || 0 }}</p>
    </div>
    <div class="text-2xl">📋</div>
  </div>
</div>
```

#### Card Features
- **Base**: `glass-card` class for all containers
- **Glassmorphism**: `backdrop-filter: blur(20px)` with dark rgba backgrounds
- **Borders**: Subtle borders with low opacity
- **Shadows**: Dark mode optimized shadow system
- **Icons**: Emoji icons (2xl size) for visual appeal in KPI cards

## 🎨 Visual Design Standards

### Color System
- **Primary**: Blue gradient (`var(--color-primary)` to `var(--color-primary-hover)`)
- **Success/Add**: Green gradient (`#059669` to `#047857`)
- **Warning**: Amber/Yellow tones
- **Danger**: Red tones
- **Neutral**: Gray scale using CSS custom properties

### Text Colors (Permanent Dark Theme)
- `text-white` - Main headings/values
- `text-gray-300` - Labels/descriptions  
- `text-gray-400` - Meta information
- NO conditional `text-gray-900 dark:text-white` patterns

### Spacing & Layout
- **Button Padding**: `px-4 py-2` standard
- **Gap Between Elements**: `gap-2` for tight spacing, `gap-4` for comfortable spacing
- **Border Radius**: `rounded-lg` (8px) for buttons and cards, `12px` for badges
- **Border Width**: `border-2` for active/focused states, `border` for default

### Animation Standards
- **Transition Duration**: `duration-300` (300ms) for most interactions
- **Hover Scale**: `hover:scale-105` for subtle interactive feedback
- **Transform Effects**: `translateY(-1px)` for pressed/active states
- **Easing**: Use `transition-all` for comprehensive smooth transitions

### Icon Standards
- **Size**: `w-4 h-4` (16x16px) for navigation buttons
- **Color**: Use `stroke="currentColor"` for theme compatibility
- **Style**: Outline style preferred for consistency
- **Contrast**: Light colors on dark backgrounds

## 🛡️ UI Verification Process (MANDATORY)

### When to Apply This Process
- Any CSS changes affecting colors, backgrounds, text, or themes
- Any HTML template modifications
- Any component styling updates
- Before claiming any UI fix is "complete"

### Verification Steps

1. **Take Dark Mode Screenshot**:
   ```javascript
   await page.goto('http://localhost:4200/[route]');
   await page.screenshot({fullPage: true, path: 'dark-mode-verification.png'});
   ```

2. **Check Text Contrast**:
   ```javascript
   const results = await page.evaluate(() => {
     const elements = document.querySelectorAll('h1, h2, h3, p, span, button, a');
     return Array.from(elements).map(el => {
       const computed = window.getComputedStyle(el);
       return {
         element: el.tagName + ' "' + el.textContent.slice(0, 20) + '"',
         backgroundColor: computed.backgroundColor,
         color: computed.color
       };
     });
   });
   ```

3. **Validate Results**:
   - All text has contrast ratio ≥ 4.5:1 (normal text) or ≥ 3:1 (large text)
   - No text is same color as background
   - All interactive elements are clearly visible
   - Screenshots show proper theme adaptation

### Enforcement Rules
- **If user reports same readability issue twice = FAILURE**
- **Never claim "fixed" without completing full verification**
- **Screenshots and contrast checks are MANDATORY evidence**

## 📋 Component Patterns

### Screen Header Pattern
```html
<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
  <div>
    <h1 class="text-2xl lg:text-3xl font-bold text-white">Screen Title</h1>
    <p class="mt-1 text-gray-300">Screen description</p>
  </div>
  
  <!-- Navigation buttons here -->
  <div class="flex flex-wrap gap-2 justify-end sm:justify-start">
    <!-- Navigation buttons -->
  </div>
</div>
```

### Filter Panel Pattern
```html
<!-- Filter toggle button with active state -->
<button class="btn-filter-toggle" [class.active]="hasActiveFilters()">
  <svg class="w-4 h-4"><!-- filter icon --></svg>
  <span>Filters</span>
</button>

<!-- Filter controls -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  <select class="filter-select">
    <option value="all">All Types</option>
  </select>
  
  <select class="filter-select">
    <option value="all">All Status</option>
  </select>
  
  <button class="btn-clear-filters">
    <svg class="w-4 h-4"><!-- clear icon --></svg>
    <span>Clear</span>
  </button>
</div>
```

## ❌ Never Do This / ✅ Always Do This

### ❌ NEVER:
- Create custom button classes: `<button class="px-4 py-2 bg-blue-600">`
- Use conditional dark mode classes: `<div class="bg-white dark:bg-gray-800">`
- Create component-specific styling: `<span class="inventory-badge">`
- Use custom select styling: `<select class="custom-dropdown">`

### ✅ ALWAYS:
- Use global button classes: `<button class="btn-primary">`
- Use permanent dark theme: `<div class="glass-card">`
- Use global badge system: `<span class="badge badge-active">`
- Use global form system: `<select class="filter-select">`

## 🎯 Success Criteria

**Every screen should look like it was designed by the same person using the same system.**
- Consistent glassmorphism effects across all components
- Unified button hierarchy and styling
- Coherent badge system with matching colors
- Standardized navigation patterns
- Permanent dark theme with proper contrast ratios