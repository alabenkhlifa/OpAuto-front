# OpAuto — Technical Conventions

## Component Standards
- Standalone components (Angular 15+)
- OnPush change detection
- `trackBy` for all `*ngFor`
- Reactive forms over template-driven
- Keep components under 400 lines
- Strict TypeScript — avoid `any`, use proper interfaces

## Service Standards
- `providedIn: 'root'` for singletons
- `catchError` for HTTP error handling
- `takeUntil` pattern for subscriptions (or async pipe)
- `shareReplay()` for shared HTTP calls

## Testing Rules
1. Write tests BEFORE implementing sensitive functions (TDD)
2. NEVER modify existing tests to make failing code pass
3. Each test independent and isolated
4. Mock all external dependencies (HTTP, localStorage)
5. Test both success and failure paths
6. AAA pattern: Arrange, Act, Assert
7. Target 80%+ code coverage

## Dependency Policy
**Core stack**: Angular, RxJS, TailwindCSS, TypeScript (already included)
**Pre-approved**: Chart.js, FullCalendar (free plugins), Lucide Icons, ngx-translate, date-fns
**Avoid unless justified**: state management (NgRx), UI component libraries, animation libraries

Adding a new library requires: justification, alternatives comparison, bundle size check.

## Translation Conventions
- Files: `src/assets/i18n/{en,fr,ar}.json`
- Key format: `feature.component.element` (e.g. `auth.login.emailLabel`)
- Languages: English (primary), French, Arabic (RTL)
- Store preference in localStorage
- All user-facing text must be translated

## Responsive Breakpoints
- Mobile: 375px–767px (iPhone SE 2020 minimum)
- Tablet: 768px–1023px
- Desktop: 1024px+
- Touch targets: minimum 44px
