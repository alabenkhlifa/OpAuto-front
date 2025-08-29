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

#### Testing
- Maintain 80%+ code coverage
- Test components in isolation
- Mock external dependencies
- Use Page Object Model for e2e tests
- Test accessibility compliance

## Translation Requirements

### Supported Languages
- **English (en)** - Primary language
- **French (fr)** - Secondary language  
- **Tunisian (tn)** - Local language support

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
│       └── tn.json
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

**tn.json:**
```json
{
  "common": {
    "save": "احفظ",
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
- Support RTL layout for Tunisian
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

## Commands to Remember
- `npm run lint` - Run linting
- `npm run test` - Run unit tests  
- `npm run e2e` - Run end-to-end tests
- `npm run build` - Build for production
- `ng serve` - Start development server
- `ng test --code-coverage` - Generate test coverage report