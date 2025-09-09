# OpAuto Design System Enforcement Checklist

## 🎨 **MANDATORY PRE-IMPLEMENTATION CHECKLIST**
**BEFORE making ANY UI changes, Claude MUST review this checklist:**

### **1. Card/Container System** ✅❌
- [ ] Use `glass-card` for main containers (NOT custom bg classes)
- [ ] Use `glass-modal` for modals
- [ ] Use `glass-nav` for navigation elements
- [ ] NO conditional `bg-white dark:bg-gray-800` patterns
- [ ] ALL containers use glassmorphism effect

### **2. Button System** ✅❌  
**STANDARD**: Car Management "Register Car" button style (blue gradient + glassmorphism)
- [ ] `btn-primary` - Main CTA (limit 1 per section, matches "+ Register Car")
- [ ] `btn-secondary` - Secondary actions  
- [ ] `btn-tertiary` - Neutral actions (most common)
- [ ] `btn-danger` - Destructive actions only
- [ ] `btn-success` - Confirmation actions
- [ ] Primary button pattern: Icon + responsive text (`<span class="hidden lg:inline">Text</span>`)
- [ ] Style: Blue gradient background with glassmorphism blur effect
- [ ] NO custom button classes or inline styles
- [ ] ALL buttons from `/src/styles/buttons.css`

### **3. Badge System** ✅❌
**STANDARD**: Car Management Status Legend style (light background + dark text + border)
- [ ] `badge badge-active` - Active/in-progress (green)
- [ ] `badge badge-completed` - Success states (green)  
- [ ] `badge badge-pending` - Waiting states (amber)
- [ ] `badge badge-cancelled` - Failed states (red)
- [ ] `badge badge-priority-{low|medium|high|urgent}` - Priorities
- [ ] Style: `border-radius: 12px` (rounded, not pill-shaped)
- [ ] Always has border matching background color family
- [ ] NO gradients, NO animations, NO complex effects
- [ ] ALL badges from `/src/styles/badges.css`

### **4. Text Color System** ✅❌
- [ ] `text-white` - Main headings/values
- [ ] `text-gray-300` - Labels/descriptions  
- [ ] `text-gray-400` - Meta information
- [ ] NO conditional `text-gray-900 dark:text-white` patterns
- [ ] Permanent dark theme colors ONLY

### **5. Navigation Toggle Buttons** ✅❌
**STANDARD**: Customers screen navigation pattern (Dashboard/List/Analytics buttons)
- [ ] Container: `div class="flex items-center gap-2"`
- [ ] Button: `nav-button flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border-2 transition-all duration-300 font-medium hover:scale-105`
- [ ] Active state: `nav-button-active` (blue gradient)
- [ ] Inactive state: `nav-button-inactive` (glass effect)
- [ ] MUST have icon: `<svg class="w-4 h-4" stroke="currentColor">...</svg>`
- [ ] MUST have text: `<span class="text-sm">Label</span>`
- [ ] Click handler: `(click)="onViewChange('viewName')"`
- [ ] Conditional class: `[class]="currentView() === 'viewName' ? 'nav-button-active' : 'nav-button-inactive'"`
- [ ] ALL navigation toggles use this exact pattern

### **6. Form Elements** ✅❌  
- [ ] `glass-input` for input fields
- [ ] `glass-control` for select/controls
- [ ] NO custom form styling
- [ ] Consistent placeholder colors

### **7. KPI Cards System** ✅❌
**STANDARD**: Reports/Approvals KPI cards style (glassmorphism with emoji icons)
- [ ] `glass-card` - Base container (no custom backgrounds)
- [ ] Layout: `flex items-center justify-between`
- [ ] Text: `text-gray-300` (labels), `text-white` (values)
- [ ] Icons: Emoji icons (2xl size) for visual appeal
- [ ] NO complex SVG icons with colored backgrounds
- [ ] Font sizes: `text-sm` (labels), `text-2xl` (main values)
- [ ] ALL KPI cards from global styling system

### **8. Icon System** ✅❌
- [ ] Proper contrast: light colors on dark backgrounds
- [ ] Standard sizes: `w-4 h-4` (navigation), `w-5 h-5` (cards)
- [ ] `stroke="currentColor"` for theme compatibility
- [ ] NO same-color-family icon/background combinations

---

## **🚨 CRITICAL ENFORCEMENT RULES**

### **Rule #1: NO Custom Styling**
- NEVER create component-specific CSS classes
- NEVER use inline Tailwind combinations that duplicate global styles
- ALWAYS use the global design system classes

### **Rule #2: Uniform Pattern Application**
- IF one screen uses `glass-card`, ALL screens use `glass-card`  
- IF one screen uses `btn-primary`, ALL screens use the same button hierarchy
- IF one screen uses permanent dark theme, ALL screens use permanent dark theme

### **Rule #3: Design System First**
- BEFORE writing code, check existing components for patterns
- BEFORE creating styles, check `/src/styles/` for global classes
- BEFORE claiming "complete", verify consistency with other screens

---

## **⚡ CLAUDE IMPLEMENTATION PROTOCOL**

### **Step 1: Pre-Implementation Analysis**
1. Read relevant sections from `/src/styles/buttons.css` and `/src/styles/badges.css`
2. Review 2-3 existing components that follow the design system correctly
3. Identify the EXACT classes and patterns to use

### **Step 2: Implementation**
1. Apply ONLY global design system classes
2. Follow established patterns exactly (no variations)
3. Use consistent text colors, spacing, and effects

### **Step 3: Post-Implementation Verification**  
1. Verify ALL elements use global classes
2. Check visual consistency with other screens
3. Ensure permanent dark theme (no conditional styling)

---

## **📋 REFERENCE: Correct Implementations**

### **Card Pattern (CORRECT):**
```html
<div class="glass-card">
  <h3 class="text-white font-semibold">Title</h3>
  <p class="text-gray-300">Description</p>
</div>
```

### **Primary Button Pattern (CORRECT - Car Management "Register Car" Standard):**
```html
<button class="btn-primary" (click)="action()">
  <!-- Plus icon for add actions -->
  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
  </svg>
  <!-- Responsive text: hidden on mobile, visible on desktop -->
  <span class="hidden lg:inline">Add Item</span>
</button>
```
**Features**: Blue gradient + glassmorphism + icon + responsive text

### **Badge Pattern (CORRECT - Car Management Standard):**
```html
<span class="badge badge-completed">Up to Date</span>
<span class="badge badge-pending">Due Soon</span>  
<span class="badge badge-cancelled">Overdue</span>
<span class="badge badge-unknown">Unknown</span>
```
**Style**: Light background + dark text + border, `border-radius: 12px`, no gradients

### **Navigation Toggle Pattern (CORRECT - Customers Screen Standard):**  
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

### **KPI Card Pattern (CORRECT - Reports/Approvals/Maintenance Standard):**
```html
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
**Features**: Global glass-card + emoji icons + permanent dark text colors

---

## **🔧 TROUBLESHOOTING GUIDE**

**Problem**: Inconsistent styling across screens
**Solution**: Use this checklist before every UI change

**Problem**: Icons invisible on colored backgrounds  
**Solution**: Use light variants (`text-blue-200` not `text-blue-400`)

**Problem**: Buttons look different between screens
**Solution**: ALL buttons must use global system (`btn-primary`, `btn-secondary`, etc.)

**Problem**: Cards have different styling
**Solution**: ALL containers must use `glass-card` or appropriate glass class

---

**✅ SUCCESS CRITERIA**: Every screen looks like it was designed by the same person using the same system.