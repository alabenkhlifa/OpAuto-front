# Claude Developer Profile & Project Guidelines

## Developer Profile
I am a senior Angular developer with expertise in:
- Angular 15+ with standalone components
- TypeScript best practices
- RxJS reactive programming
- Angular Material and modern UI frameworks
- State management (NgRx, Akita)
- Testing (Jasmine, Karma, Cypress)
- Performance optimization
- Accessibility (a11y) compliance

## Angular Best Practices

### Project Structure
```
src/
├── app/
│   ├── core/                 # Singleton services, guards, interceptors
│   ├── shared/              # Reusable components, pipes, directives
│   ├── features/            # Feature modules (lazy-loaded)
│   ├── layouts/             # Layout components
│   └── assets/              # Static assets
```

### Code Standards

#### Components
- Use standalone components for Angular 15+
- Implement OnPush change detection strategy
- Use trackBy functions for *ngFor
- Keep components under 400 lines
- Single responsibility principle
- Use reactive forms over template-driven forms
- **🌙 DARK MODE ONLY**: Application uses permanent dark mode styling - no theme switching functionality
- **🚨 CRITICAL TESTING REQUIREMENT**: 
  - **MANDATORY**: Test EVERY UI change using Playwright screenshots before saying "fixed"
  - **VERIFY**: Check text visibility, backgrounds, borders, hover states in dark mode
  - **ACCOUNTABILITY**: If user reports same issue twice, you FAILED to test properly - this is unacceptable

#### 📋 MANDATORY VERIFICATION CHECKLIST (Must Complete Before Claiming "Fixed")
**EVERY UI change must pass this checklist. NO EXCEPTIONS.**

1. **🖼️ Visual Testing**:
   - [ ] Take screenshot using Playwright in dark mode
   - [ ] Verify visual appearance meets requirements

2. **🔤 Text Readability Verification**:
   - [ ] Use Playwright evaluate to check contrast ratios of ALL text elements
   - [ ] Ensure contrast ratio ≥ 4.5:1 for normal text (WCAG AA)
   - [ ] Ensure contrast ratio ≥ 3:1 for large text (WCAG AA)
   - [ ] Verify no text is invisible (same color as background)

3. **🎨 Dark Mode Visual Check**:
   - [ ] All backgrounds have proper dark styling
   - [ ] All borders are visible in dark mode
   - [ ] All interactive elements have proper hover states
   - [ ] All icons and images are visible in dark mode

4. **🔧 CSS Implementation Verification**:
   - [ ] Use CSS custom properties (--color-*) for dark mode colors
   - [ ] Permanent dark mode styling applied (no light mode variants)
   - [ ] CSS specificity is sufficient to override framework defaults
   - [ ] All glassmorphism effects work properly in dark mode

**⚠️ CRITICAL RULE: NEVER claim a UI fix is complete without completing this entire checklist.**
**If user reports the same readability issue twice, you have failed your responsibility.**

#### Services
- Use providedIn: 'root' for singleton services
- Implement proper error handling with catchError
- Use RxJS operators for data transformation
- Avoid memory leaks with takeUntil pattern

#### TypeScript
- Enable strict mode
- Use proper typing (avoid `any`)
- Implement interfaces for all data models
- Use enums for constants
- Leverage union types and type guards

#### RxJS Best Practices
- Use async pipe in templates
- Implement proper unsubscription
- Prefer shareReplay() for HTTP calls
- Use combineLatest for multiple observables
- Implement custom operators when needed

#### Performance
- Lazy load feature modules
- Use OnPush change detection
- Implement virtual scrolling for large lists
- Optimize bundle size with tree shaking
- Use preloading strategies

#### Mobile Support & Responsive Design
- **Minimum Device Support**: iPhone SE 2020 (375px width × 667px height)
- **Responsive Breakpoints**: 
  - Mobile: 375px - 767px (iPhone SE 2020 and up)
  - Tablet: 768px - 1023px 
  - Desktop: 1024px and up
- **Touch-First Design**: All interactive elements must be touch-friendly (minimum 44px tap targets)
- **Mobile Navigation**: Collapsible sidebar with mobile hamburger menu
- **Gesture Support**: Swipe gestures for navigation where appropriate
- **Performance**: Optimize for mobile networks and lower-powered devices
- **PWA Ready**: Progressive Web App capabilities for mobile installation
- **Cross-Platform Testing**: Test on iOS Safari, Chrome Mobile, and Firefox Mobile
- **⚠️ CRITICAL**: Always test text visibility and contrast in dark mode using Playwright before completing any UI changes

#### Testing
- Maintain 80%+ code coverage
- Test components in isolation
- Mock external dependencies
- Use Page Object Model for e2e tests
- Test accessibility compliance
- **CRITICAL: Write unit tests for ALL sensitive and core functions BEFORE implementation**
- **NEVER modify tests after implementation just to make them pass**
- Follow Test-Driven Development (TDD) for core business logic
- Test service methods, validators, guards, and interceptors thoroughly
- Use AAA pattern (Arrange, Act, Assert) in all tests

## Translation Requirements

### Supported Languages
- **English (en)** - Primary language
- **French (fr)** - Secondary language  
- **Arabic (ar)** - Standard Arabic language support (no dialects)

### Implementation Guidelines

#### Setup Angular i18n
```bash
ng add @angular/localize
ng generate @angular/localize:add
```

#### Translation File Structure
```
src/
├── assets/
│   └── i18n/
│       ├── en.json
│       ├── fr.json
│       └── ar.json
```

#### Translation Keys Convention
- Use hierarchical keys: `feature.component.element`
- Keep keys descriptive: `auth.login.emailLabel`
- Use snake_case for consistency
- Group by feature/component

#### Example Translation Files

**en.json:**
```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "auth": {
    "login": {
      "title": "Sign In",
      "emailLabel": "Email Address",
      "passwordLabel": "Password"
    }
  }
}
```

**fr.json:**
```json
{
  "common": {
    "save": "Enregistrer",
    "cancel": "Annuler", 
    "delete": "Supprimer"
  },
  "auth": {
    "login": {
      "title": "Se Connecter",
      "emailLabel": "Adresse Email",
      "passwordLabel": "Mot de Passe"
    }
  }
}
```

**ar.json:**
```json
{
  "common": {
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف"
  },
  "auth": {
    "login": {
      "title": "تسجيل الدخول",
      "emailLabel": "البريد الإلكتروني",
      "passwordLabel": "كلمة المرور"
    }
  }
}
```

#### Implementation Requirements
- Use Angular i18n package (@angular/localize)
- Implement language switcher component
- Store language preference in localStorage
- Support RTL layout for Arabic
- Format dates, numbers, and currencies per locale
- Translate all user-facing text
- Handle pluralization rules
- Implement lazy loading for translation files

#### Build Configuration
Configure angular.json for multiple locales:
```json
"build": {
  "configurations": {
    "en": {
      "aot": true,
      "outputPath": "dist/en/",
      "i18nFile": "src/assets/i18n/en.json",
      "i18nFormat": "json",
      "i18nLocale": "en"
    }
  }
}
```

# Project Requirements - OpAuto Garage Management System

## 🚧 MVP Architecture (Simplified)

### 🔐 Authentication
- Only 1 admin account per garage (login/logout + session)
- Secure token-based auth (JWT is a good choice)

### 📁 Backend (Spring Boot)
- REST API exposing endpoints for:
    - Car management
    - Maintenance logs
    - Appointments
    - Invoice generation
    - Approval requests
    - Notifications (optional)

### 🎨 Frontend (Angular)
- Admin dashboard with:
    - **Apple-style glassmorphism design** - Modern glass effect with blur and transparency
    - Sidebar navigation with frosted glass backdrop
    - CRUD UI for cars, jobs, appointments, invoices
    - Tables + modal forms with glass effect styling
    - Calendar view for bookings
    - **🌙 Permanent dark mode only** - No theme switching, optimized for dark backgrounds

## 🎨 UI Design System & Guidelines

### Navigation Design Standards
Based on the successful implementation in the inventory screen, all navigation elements should follow these patterns:

#### Primary Navigation Buttons
```html
<!-- Standard Navigation Button Pattern -->
<button (click)="setView('viewName')" 
        class="nav-button flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border-2 transition-all duration-300 font-medium hover:scale-105"
        [class]="currentView() === 'viewName' ? 'nav-button-active' : 'nav-button-inactive'">
  <!-- Icon (4x4 size) -->
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <!-- Relevant SVG path -->
  </svg>
  <span class="text-sm">Button Label</span>
</button>
```

#### Required CSS Classes for Navigation
```css
/* Navigation button styles */
.nav-button-active {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover)) !important;
  border-color: var(--color-primary) !important;
  color: white !important;
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
}

.nav-button-inactive {
  background-color: var(--color-bg-primary) !important;
  border-color: var(--color-border) !important;
  color: var(--color-text-secondary) !important;
}

.nav-button-inactive:hover {
  background-color: var(--color-bg-tertiary) !important;
  border-color: var(--color-primary) !important;
  color: var(--color-text-primary) !important;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
}

.nav-button-add {
  background: linear-gradient(135deg, #059669, #047857) !important;
  border-color: #059669 !important;
  color: white !important;
  box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
}

.nav-button-add:hover {
  background: linear-gradient(135deg, #047857, #065f46) !important;
  box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);
  transform: translateY(-1px);
}
```

#### Icon Library Standards
Use Heroicons or similar SVG icons with these specifications:
- **Size**: `w-4 h-4` (16x16px) for navigation buttons
- **Stroke**: Use `stroke="currentColor"` for theme compatibility
- **Style**: Outline style preferred for consistency
- **Common Icons**:
  - Dashboard: Grid/layout icon
  - Catalog/Lists: Archive/box icon
  - Users/Suppliers: Users/people icon
  - Add Actions: Plus icon
  - Settings: Cog icon

### Dark Mode Implementation Standards

#### CSS Approach
- **Primary Method**: Use CSS custom properties with class-based dark mode
- **Selector Pattern**: `::ng-deep html.dark .class-name` or `::ng-deep .dark .class-name`
- **Fallback**: Use `::ng-deep html:not(.dark) .class-name` for light mode specificity

#### List Item Background Fix Pattern
```css
/* Standard pattern for theme-aware backgrounds */
::ng-deep .list-item-class {
  background-color: rgba(248, 250, 252, 0.5) !important; /* Light mode */
}

::ng-deep html.dark .list-item-class,
::ng-deep .dark .list-item-class {
  background-color: rgba(51, 65, 85, 0.5) !important; /* Dark mode */
}
```

#### Theme-Aware Text Classes
Create reusable text color classes:
```css
.text-primary-themed { color: var(--color-text-primary); }
.text-secondary-themed { color: var(--color-text-secondary); }
.text-tertiary-themed { color: var(--color-text-tertiary); }
```

### Visual Design Principles

#### Color System
- **Primary**: Blue gradient (var(--color-primary) to var(--color-primary-hover))
- **Success/Add**: Green gradient (#059669 to #047857)
- **Warning**: Amber/Yellow tones
- **Danger**: Red tones
- **Neutral**: Gray scale using CSS custom properties

#### Spacing & Layout
- **Button Padding**: `px-4 py-2` standard
- **Gap Between Elements**: `gap-2` for tight spacing, `gap-4` for comfortable spacing
- **Border Radius**: `rounded-lg` (8px) for buttons and cards
- **Border Width**: `border-2` for active/focused states, `border` for default

#### Animation Standards
- **Transition Duration**: `duration-300` (300ms) for most interactions
- **Hover Scale**: `hover:scale-105` for subtle interactive feedback
- **Transform Effects**: `translateY(-1px)` for pressed/active states
- **Easing**: Use `transition-all` for comprehensive smooth transitions

#### Glass Effects
- **Backdrop Blur**: `backdrop-blur-sm` for subtle glass effect
- **Transparency**: Use rgba() colors with 0.1-0.8 alpha values
- **Borders**: Use subtle borders with low opacity for glass separation

### Implementation Requirements

#### For Every New Screen/Component
1. **Navigation**: Implement active/inactive button states with icons
2. **Dark Mode**: Test all text elements for readability in both themes
3. **Responsive**: Ensure mobile-first responsive design
4. **Animations**: Add smooth transitions for all interactive elements
5. **Consistency**: Use established color variables and spacing patterns

#### Mandatory Testing Checklist
- [ ] All navigation buttons show clear active/inactive states
- [ ] All text is readable in dark mode
- [ ] Hover effects work smoothly on all interactive elements
- [ ] Icons are properly sized and themed
- [ ] Mobile responsiveness is maintained
- [ ] Glass effects render correctly across browsers

### Component Patterns to Follow

#### Screen Header Pattern
```html
<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
  <div>
    <h1 class="text-2xl lg:text-3xl font-bold text-primary-themed">Screen Title</h1>
    <p class="mt-1 text-secondary-themed">Screen description</p>
  </div>
  
  <!-- Navigation buttons here -->
  <div class="flex flex-wrap gap-2 justify-end sm:justify-start">
    <!-- Navigation buttons -->
  </div>
</div>
```

This design system ensures consistency across all screens and provides clear guidelines for future development.

## 🔧 Core Features (MVP - Phase 1)

### 1. **Car Registration**
- Register cars manually: license plate, make, model, year
- Link to a customer (name, phone)
- Quick access to vehicle history (past repairs, diagnostics, etc.)

### 2. **Maintenance & Repair Logs (Visita, KM, Current State)**
- Record current mileage (KM)
- Add list of tasks (e.g., change oil, fix brakes)
- Add photos (optional) of issues or completed work
- Status tracking: `Waiting`, `In Progress`, `Waiting for Approval`, `Done`

### 3. **Notifications (SMS, Mail, Browser notification)**
- Browser notifications for new jobs, updates, and approvals
- SMS/Email alerts only for the garage owner (optional toggle)
- Approval request system for parts purchasing

### 4. **Appointments & Slot Management**
- Calendar or list view of appointments per day
- Garage owner manually adds appointments with:
    - Car details
    - Estimated time
    - Assigned mechanic
- Slot availability based on:
    - Number of lifts/stations
    - Active mechanics
- Optional filters: By mechanic, by service type, by car

### 5. **Garage Details Configuration**
- Set number of employees, lifts, and working hours
- Define how many cars can be handled per day
- Toggle holidays or off-days
- Employee management with roles: Admin (owner), Mechanic

## 🧾 Additional MVP Features

### 6. **Basic Invoicing**
- Simple cash-only invoice generation (print or PDF)
- Add services and part costs manually
- Final price, discount (if any), and payment confirmation
- Archive of invoices with search by customer, car, or date

### 7. **Basic Reporting**
- List of completed jobs by day/week
- Cash received today / this week
- Services most often done
- Employee work summary

### 8. **Internal Notifications & Approvals**
- Mechanic can request approval to purchase a part:
    - Part description
    - Estimated price
    - Urgency
- Garage owner receives notification (browser, email, or SMS)
- Owner approves or rejects with optional comment
- Approval history is saved in the job log

## 🚀 Future Features (Phase 2)

### AI & Advanced Features
- **AI consulting / diagnosis** - Smart diagnostic recommendations
- **Consulting for used cars** - AI-powered car evaluation for purchases
- **Parts database** - Comprehensive parts catalog with pricing
- **Wearing parts (pieces d'usure)** - Predictive maintenance for consumables

### Business Management
- **Employees management (CNSS)** - Full HR management with social security
- **Advanced Facturation** - Complex billing with tax management
- **Home Service** - Mobile garage services

### Additional Ideas (Brainstorming)
- Customer mobile app for booking appointments
- Integration with parts suppliers
- Workshop efficiency analytics
- Customer loyalty programs

## Feature Implementation Priority

### Phase 1 (MVP)
1. Authentication & User Management
2. Car Registration
3. Maintenance Logs
4. Basic Appointments
5. Garage Configuration
6. Simple Invoicing
7. Browser Notifications

### Phase 2 (Enhanced)
1. SMS/Email Notifications
2. Advanced Reporting
3. Parts Database
4. Employee Management

### Phase 3 (Advanced)
1. AI Diagnosis
2. Home Service
3. Mobile App
4. Advanced Analytics

## Clean Architecture & Testing Requirements

### 🏗️ Clean Architecture Principles
- **Separation of Concerns**: Each layer has a single responsibility
- **Dependency Inversion**: High-level modules don't depend on low-level modules
- **Domain-Driven Design**: Business logic isolated from infrastructure
- **SOLID Principles**: Applied throughout the codebase
- **Minimal Dependencies**: Prefer native solutions over external libraries
- **Trusted Libraries Only**: Use only well-established, popular libraries with strong community support

### ⚡ Development Efficiency & Token Optimization
- **Be Direct**: Implement requested features immediately without over-planning
- **Focus on MVP**: Build only what's needed, avoid gold-plating
- **Minimal Context**: Read only necessary files, avoid exploratory file reading
- **Batch Operations**: Group related changes together
- **Clear Communication**: Be concise, avoid lengthy explanations unless requested
- **Practical Solutions**: Choose simple, working implementations over perfect architecture

### 📁 Project Structure (Clean Architecture)
```
src/app/
├── core/                    # Singleton services, guards, interceptors
│   ├── services/           # Business logic services
│   ├── guards/             # Route guards
│   ├── interceptors/       # HTTP interceptors
│   └── models/             # Domain models and interfaces
├── shared/                 # Reusable components, pipes, directives
│   ├── components/         # UI components
│   ├── pipes/              # Custom pipes
│   ├── directives/         # Custom directives
│   └── utils/              # Utility functions
├── features/               # Feature modules (lazy-loaded)
│   ├── auth/
│   ├── dashboard/
│   ├── cars/
│   ├── maintenance/
│   ├── appointments/
│   ├── notifications/
│   ├── garage-config/
│   ├── invoicing/
│   ├── reports/
│   └── employees/
├── layouts/                # Layout components
└── assets/                 # Static assets
```

### 🧪 Unit Testing Standards

#### Core Functions Requiring Tests (MANDATORY)
- **Authentication Service**: Login, logout, token validation
- **Theme Service**: Theme switching, persistence, system detection
- **Data Services**: CRUD operations, API calls, error handling
- **Validators**: Form validation logic, business rules
- **Guards**: Authentication, authorization checks
- **Pipes**: Data transformation logic
- **Utils**: Pure functions, calculations, formatters

#### Testing Rules (NON-NEGOTIABLE)
1. **Write tests BEFORE implementing sensitive functions**
2. **NEVER modify existing tests to make failing code pass**
3. **Each test must be independent and isolated**
4. **Mock all external dependencies (HTTP, localStorage, etc.)**
5. **Test both success and failure scenarios**
6. **Use descriptive test names that explain the behavior**

### 📦 Dependency Management Strategy

#### Library Selection Criteria
- **Necessity**: Only add if it provides significant value over native implementation
- **Popularity**: Must have 10k+ weekly downloads on npm
- **Maintenance**: Active maintenance with recent updates
- **Security**: No known vulnerabilities, good security track record
- **Bundle Size**: Consider impact on application size
- **TypeScript Support**: Must have proper TypeScript definitions

#### Approved Libraries (Core Stack)
- **Angular**: Framework (already included)
- **RxJS**: Reactive programming (already included)
- **TailwindCSS**: Utility-first CSS with `darkMode: 'media'` strategy (already included)
- **TypeScript**: Type safety (already included)

#### Libraries to Avoid Unless Absolutely Necessary
- **Date Libraries**: Use native Date API and Intl.DateTimeFormat
- **HTTP Clients**: Use Angular HttpClient
- **State Management**: Start with Angular signals, avoid NgRx until needed
- **UI Components**: Build custom components with TailwindCSS
- **Animation Libraries**: Use CSS animations and Angular Animations API
- **Validation**: Use Angular reactive forms validators
- **Utility Libraries**: Implement utilities natively

#### Pre-approved Libraries (If Needed)
- **Chart.js**: For complex charts (only if required)
- **Lucide Icons**: Icon library (only if custom icons insufficient)
- **date-fns**: Only if complex date manipulation is required
- **ngx-translate**: Only if Angular i18n is insufficient

#### Library Addition Process
1. **Justify the need**: Explain why native solution won't work
2. **Research alternatives**: Compare at least 3 options
3. **Security audit**: Check for vulnerabilities
4. **Bundle impact**: Measure size increase
5. **Documentation**: Update CLAUDE.md with justification

#### Test Structure Template
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: jasmine.SpyObj<DependencyName>;

  beforeEach(() => {
    // Arrange: Set up test environment
    const spy = jasmine.createSpyObj('DependencyName', ['method1', 'method2']);
    
    TestBed.configureTestingModule({
      providers: [
        ServiceName,
        { provide: DependencyName, useValue: spy }
      ]
    });
    
    service = TestBed.inject(ServiceName);
    mockDependency = TestBed.inject(DependencyName) as jasmine.SpyObj<DependencyName>;
  });

  describe('methodName', () => {
    it('should return expected result when given valid input', () => {
      // Arrange
      const input = 'valid-input';
      const expectedOutput = 'expected-result';
      mockDependency.method1.and.returnValue(expectedOutput);

      // Act
      const result = service.methodName(input);

      // Assert
      expect(result).toBe(expectedOutput);
      expect(mockDependency.method1).toHaveBeenCalledWith(input);
    });

    it('should handle error when dependency fails', () => {
      // Arrange
      mockDependency.method1.and.throwError('Dependency error');

      // Act & Assert
      expect(() => service.methodName('input')).toThrowError('Expected error message');
    });
  });
});
```

## Angular Feature Modules Structure
```
src/app/features/
├── auth/
├── dashboard/
├── cars/
├── maintenance/
├── appointments/
├── notifications/
├── garage-config/
├── invoicing/
├── reports/
└── employees/
```

## 🛡️ MANDATORY UI VERIFICATION PROCESS

**⚠️ CRITICAL: This process MUST be followed for ANY UI-related changes. NO EXCEPTIONS.**

### When to Apply This Process:
- Any CSS changes affecting colors, backgrounds, text, or themes
- Any HTML template modifications
- Any component styling updates
- Before claiming any UI fix is "complete"

### Step-by-Step Verification Process:

1. **🌙 Take Dark Mode Screenshot**:
   ```javascript
   // Navigate to the page (already in permanent dark mode)
   await page.goto('http://localhost:4200/[route]');
   // Take full page screenshot - application is permanently dark
   await page.screenshot({fullPage: true, path: 'dark-mode-verification.png'});
   ```

2. **🔍 Check Text Contrast Programmatically**:
   ```javascript
   // Get contrast ratios for all text elements
   const results = await page.evaluate(() => {
     const elements = document.querySelectorAll('h1, h2, h3, p, span, button, a');
     return Array.from(elements).map(el => {
       const computed = window.getComputedStyle(el);
       return {
         element: el.tagName + ' "' + el.textContent.slice(0, 20) + '"',
         backgroundColor: computed.backgroundColor,
         color: computed.color,
         // Add contrast calculation here
       };
     });
   });
   ```

4. **✅ Validate Results**:
   - All text has contrast ratio ≥ 4.5:1 (normal text) or ≥ 3:1 (large text)
   - No text is same color as background
   - All interactive elements are clearly visible
   - Screenshots show proper theme adaptation

5. **📊 Document Results**:
   - Save both screenshots with descriptive names
   - Note any contrast ratios below standards
   - Mark todo as completed ONLY after all checks pass

### Enforcement:
- **If user reports same readability issue twice = FAILURE**
- **Never claim "fixed" without completing full verification**
- **Screenshots and contrast checks are MANDATORY evidence**

## Commands to Remember
- `npm run lint` - Run linting
- `npm run test` - Run unit tests  
- `npm run e2e` - Run end-to-end tests
- `npm run build` - Build for production
- `ng serve` - Start development server
- `ng test --code-coverage` - Generate test coverage report

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Playwright Usage Rule
Do NOT use Playwright for validation or testing unless the user explicitly adds "use PL" at the end of their prompts. Focus on code changes and rely on compilation feedback instead of browser automation for efficiency.

### Fast Playwright Validation (when "use PL" is specified):
1. **Direct Navigation** - Go straight to target page (auth is bypassed)
2. **Element Checks First** - Use `isVisible()`, `isEnabled()` instead of screenshots when possible
3. **Targeted Screenshots** - Screenshot specific elements, not full page
4. **Batch Actions** - Combine multiple checks in single tool calls
5. **No Login Flow** - Never waste time with authentication
6. **Quick Validation Examples**:
   - Button visibility: `await page.locator('button:has-text("Add Part")').isVisible()`
   - Element screenshot: `await page.locator('.header').screenshot({path: 'check.png'})`
   - Direct page check: `await page.goto('http://localhost:4200/inventory')`