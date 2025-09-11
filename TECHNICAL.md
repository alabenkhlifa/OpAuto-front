# Technical Guidelines - OpAuto Angular Development

## 🏗️ Angular Best Practices

### Project Structure (Clean Architecture)
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

### Component Standards

#### Component Guidelines
- Use standalone components for Angular 15+
- Implement OnPush change detection strategy
- Use trackBy functions for *ngFor
- Keep components under 400 lines
- Single responsibility principle
- Use reactive forms over template-driven forms

#### TypeScript Standards
- Enable strict mode
- Use proper typing (avoid `any`)
- Implement interfaces for all data models
- Use enums for constants
- Leverage union types and type guards

### Service Standards

#### Service Implementation
- Use providedIn: 'root' for singleton services
- Implement proper error handling with catchError
- Use RxJS operators for data transformation
- Avoid memory leaks with takeUntil pattern

#### RxJS Best Practices
- Use async pipe in templates
- Implement proper unsubscription
- Prefer shareReplay() for HTTP calls
- Use combineLatest for multiple observables
- Implement custom operators when needed

### Performance Guidelines

#### Performance Optimization
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

## 🧪 Testing Standards

### Unit Testing Requirements

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

#### Test Quality Standards
- Maintain 80%+ code coverage
- Test components in isolation
- Mock external dependencies
- Use Page Object Model for e2e tests
- Test accessibility compliance
- Follow Test-Driven Development (TDD) for core business logic
- Test service methods, validators, guards, and interceptors thoroughly
- Use AAA pattern (Arrange, Act, Assert) in all tests

### Test Structure Template
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

## 📦 Dependency Management

### Library Selection Criteria
- **Necessity**: Only add if it provides significant value over native implementation
- **Popularity**: Must have 10k+ weekly downloads on npm
- **Maintenance**: Active maintenance with recent updates
- **Security**: No known vulnerabilities, good security track record
- **Bundle Size**: Consider impact on application size
- **TypeScript Support**: Must have proper TypeScript definitions

### Approved Libraries (Core Stack)
- **Angular**: Framework (already included)
- **RxJS**: Reactive programming (already included)
- **TailwindCSS**: Utility-first CSS with `darkMode: 'media'` strategy (already included)
- **TypeScript**: Type safety (already included)

### Libraries to Avoid Unless Absolutely Necessary
- **Date Libraries**: Use native Date API and Intl.DateTimeFormat
- **HTTP Clients**: Use Angular HttpClient
- **State Management**: Start with Angular signals, avoid NgRx until needed
- **UI Components**: Build custom components with TailwindCSS
- **Animation Libraries**: Use CSS animations and Angular Animations API
- **Validation**: Use Angular reactive forms validators
- **Utility Libraries**: Implement utilities natively

### Pre-approved Libraries (If Needed)
- **Chart.js**: For complex charts (only if required)
- **Lucide Icons**: Icon library (only if custom icons insufficient)
- **date-fns**: Only if complex date manipulation is required
- **ngx-translate**: Only if Angular i18n is insufficient

### Library Addition Process
1. **Justify the need**: Explain why native solution won't work
2. **Research alternatives**: Compare at least 3 options
3. **Security audit**: Check for vulnerabilities
4. **Bundle impact**: Measure size increase
5. **Documentation**: Update CLAUDE.md with justification

## 🌐 Translation System

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

## ⚡ Development Efficiency Principles

### Token Optimization Guidelines
- **Be Direct**: Implement requested features immediately without over-planning
- **Focus on MVP**: Build only what's needed, avoid gold-plating
- **Minimal Context**: Read only necessary files, avoid exploratory file reading
- **Batch Operations**: Group related changes together
- **Clear Communication**: Be concise, avoid lengthy explanations unless requested
- **Practical Solutions**: Choose simple, working implementations over perfect architecture

### Clean Architecture Principles
- **Separation of Concerns**: Each layer has a single responsibility
- **Dependency Inversion**: High-level modules don't depend on low-level modules
- **Domain-Driven Design**: Business logic isolated from infrastructure
- **SOLID Principles**: Applied throughout the codebase
- **Minimal Dependencies**: Prefer native solutions over external libraries
- **Trusted Libraries Only**: Use only well-established, popular libraries with strong community support