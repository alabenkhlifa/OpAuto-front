# Development Workflows & Commands - OpAuto

## 📋 Essential Commands

### Development Server
```bash
ng serve                    # Start development server
npm start                   # Alternative start command
ng serve --open            # Start server and open browser
ng serve --port 4201       # Start on custom port
```

### Build & Production
```bash
npm run build              # Build for production
ng build                   # Alternative build command
ng build --watch           # Build with file watching
ng build --prod            # Production build (legacy)
```

### Testing
```bash
npm run test               # Run unit tests
ng test                    # Alternative test command
ng test --code-coverage    # Generate test coverage report
npm run e2e                # Run end-to-end tests
ng e2e                     # Alternative e2e command
```

### Code Quality
```bash
npm run lint               # Run linting
ng lint                    # Alternative lint command
ng lint --fix              # Fix linting issues automatically
```

### Translation & Internationalization
```bash
ng add @angular/localize   # Add Angular i18n support
ng generate @angular/localize:add  # Generate i18n configuration
ng build --localize       # Build with all locales
ng build --configuration=production,fr  # Build for specific locale
```

## 🔧 Development Workflow

### Daily Development Process

1. **Start Development Session**
   ```bash
   git pull origin main       # Get latest changes
   npm install               # Install dependencies if needed
   ng serve                  # Start development server
   ```

2. **Code Development**
   - Follow Angular best practices (see TECHNICAL.md)
   - Use global design system (see UI-SYSTEM.md)
   - Write tests before implementing sensitive functions
   - Test UI changes with Playwright when specified

3. **Pre-Commit Checklist**
   ```bash
   npm run lint              # Check code quality
   npm run test              # Run unit tests
   npm run build             # Verify build succeeds
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feature: implement new functionality"
   git push origin feature-branch
   ```

### Feature Development Workflow

1. **Planning Phase**
   - Review feature requirements in FEATURES.md
   - Check design system requirements in UI-SYSTEM.md
   - Plan implementation approach using TECHNICAL.md guidelines

2. **Implementation Phase**
   - Create feature branch: `git checkout -b feature/feature-name`
   - Implement using established patterns
   - Follow UI verification process for any UI changes
   - Write comprehensive tests

3. **Testing Phase**
   - Unit tests: `npm run test`
   - E2E tests: `npm run e2e`
   - Manual testing across devices
   - Playwright validation when specified with "use PL"

4. **Integration Phase**
   - Code review and approval
   - Merge to main branch
   - Deploy to staging/production

## 🧪 Testing Workflows

### Unit Testing Workflow

1. **Test-Driven Development (TDD)**
   ```bash
   # 1. Write failing test
   ng test --watch           # Run tests in watch mode
   
   # 2. Implement minimal code to pass
   # 3. Refactor while keeping tests green
   # 4. Repeat cycle
   ```

2. **Coverage Requirements**
   ```bash
   ng test --code-coverage   # Generate coverage report
   # Target: 80%+ coverage for core functions
   # Check coverage/index.html for detailed report
   ```

### End-to-End Testing Workflow

1. **E2E Test Development**
   ```bash
   ng e2e                    # Run existing e2e tests
   ng generate cypress-schematic  # Add Cypress support
   ```

2. **Playwright Testing (when "use PL" specified)**
   ```bash
   # Playwright tests for UI validation
   # - Direct navigation to target pages
   # - Element visibility checks
   # - Screenshot verification
   # - Text contrast validation
   ```

## 🎨 UI Development Workflow

### Design System Compliance

1. **Pre-Implementation Checklist**
   - Read DESIGN_SYSTEM_CHECKLIST.md
   - Review UI-SYSTEM.md for component patterns
   - Check existing implementations for consistency

2. **Implementation Process**
   ```bash
   # 1. Use global design system classes only
   # 2. Follow established patterns exactly
   # 3. Test in dark mode (permanent theme)
   # 4. Verify accessibility compliance
   ```

3. **UI Verification Process (MANDATORY)**
   ```bash
   # When "use PL" specified:
   # 1. Take dark mode screenshots
   # 2. Check text contrast programmatically
   # 3. Validate visual consistency
   # 4. Document results before claiming "fixed"
   ```

### Component Development Pattern

1. **Create Component**
   ```bash
   ng generate component feature/component-name --standalone
   ```

2. **Apply Design System**
   - Use global button classes: `btn-primary`, `btn-secondary`, etc.
   - Use global badge system: `badge badge-active`, etc.
   - Use global card system: `glass-card`
   - Follow navigation toggle patterns

3. **Test Responsiveness**
   - Desktop: 1024px+
   - Tablet: 768px-1023px
   - Mobile: 375px minimum (iPhone SE 2020)

## 🌐 Translation Workflow

### Adding New Translations

1. **Update Translation Files**
   ```bash
   # Edit translation files:
   # - src/assets/i18n/en.json
   # - src/assets/i18n/fr.json
   # - src/assets/i18n/ar.json
   ```

2. **Translation Key Convention**
   ```json
   {
     "feature.component.element": "Translation text",
     "common.save": "Save",
     "auth.login.title": "Sign In"
   }
   ```

3. **Test Translations**
   ```bash
   # Test all three languages
   # Verify RTL layout for Arabic
   # Check date/time formatting
   # Validate currency formatting (TND)
   ```

### Playwright Translation Testing
```bash
# When "use PL" specified for translation testing:
# 1. Set localStorage language to Arabic
# 2. Navigate directly to target pages
# 3. Verify text rendering and RTL layout
# 4. Check all UI elements are properly translated
```

## 🚀 Deployment Workflow

### Build Process

1. **Development Build**
   ```bash
   ng build                  # Development build
   ng serve --prod           # Test production mode locally
   ```

2. **Production Build**
   ```bash
   ng build --configuration=production  # Production optimized build
   ng build --localize      # Build with all locales
   ```

3. **Build Verification**
   ```bash
   # Check build artifacts in dist/ folder
   # Verify bundle sizes are optimized
   # Test in production mode
   ```

### Pre-Deployment Checklist

- [ ] All tests passing: `npm run test`
- [ ] Linting clean: `npm run lint`
- [ ] Build successful: `npm run build`
- [ ] E2E tests pass: `npm run e2e`
- [ ] UI verification complete (if UI changes)
- [ ] Translation testing complete (if text changes)
- [ ] Performance optimization verified

## 🔄 Git Workflow

### Branch Strategy

```bash
main                        # Production-ready code
├── feature/feature-name    # New features
├── bugfix/issue-name      # Bug fixes
├── hotfix/critical-fix    # Critical production fixes
└── chore/task-name        # Maintenance tasks
```

### Commit Message Convention

```bash
# Format: type: description
feature: add user authentication system
bugfix: fix login form validation
chore: update dependencies
docs: update API documentation
test: add unit tests for user service
ui: implement glassmorphism design system
```

### Git Commands Workflow

```bash
# Create feature branch
git checkout main
git pull origin main
git checkout -b feature/new-feature

# Development cycle
git add .
git commit -m "feature: implement new functionality"
git push origin feature/new-feature

# Update from main
git checkout main
git pull origin main
git checkout feature/new-feature
git merge main

# Complete feature
git checkout main
git merge feature/new-feature
git push origin main
git branch -d feature/new-feature
```

## 📊 Linear Integration Workflow

### Issue Management

1. **Starting Work on Linear Issue**
   - Put Linear issue "In Progress" when starting implementation
   - Reference issue ID in commit messages when relevant

2. **Completing Work**
   - Confirm with user that work is finished
   - Update Linear issue to "Done" status after user confirmation
   - Include acceptance criteria verification

### Linear Issue Lifecycle

```bash
# Issue States:
Backlog → In Progress → Review → Done

# Transition triggers:
- Start work: Move to "In Progress"
- Implementation complete: Request user confirmation
- User confirms: Move to "Done"
```

## ⚡ Performance Optimization Workflow

### Bundle Analysis

```bash
ng build --stats-json      # Generate build statistics
npx webpack-bundle-analyzer dist/stats.json  # Analyze bundle size
```

### Performance Checklist

- [ ] Lazy loading implemented for feature modules
- [ ] OnPush change detection strategy used
- [ ] Virtual scrolling for large lists
- [ ] Image optimization and lazy loading
- [ ] Tree shaking enabled
- [ ] Preloading strategies configured

## 🔧 Troubleshooting Common Issues

### Development Server Issues

```bash
# Clear cache and restart
rm -rf node_modules package-lock.json
npm install
ng serve

# Port conflicts
ng serve --port 4201

# Memory issues
node --max-old-space-size=8192 ./node_modules/@angular/cli/bin/ng serve
```

### Build Issues

```bash
# Clear Angular cache
ng cache clean

# Full clean build
rm -rf dist
ng build --configuration=production

# Check for circular dependencies
ng lint
```

### Test Issues

```bash
# Update test snapshots
ng test --update-snapshots

# Run tests with debugging
ng test --browsers=Chrome --watch

# Check test coverage
ng test --code-coverage --watch=false
```

## 📝 Code Review Workflow

### Pre-Review Checklist

- [ ] Code follows Angular best practices (TECHNICAL.md)
- [ ] UI follows design system (UI-SYSTEM.md)
- [ ] Tests written and passing
- [ ] Documentation updated if needed
- [ ] No console.log or debugging code
- [ ] Performance considerations addressed

### Review Criteria

1. **Code Quality**
   - TypeScript strict mode compliance
   - Proper error handling
   - Memory leak prevention
   - Performance optimization

2. **Design System Compliance**
   - Global component system usage
   - Consistent styling patterns
   - Accessibility requirements met
   - Mobile responsiveness verified

3. **Testing Coverage**
   - Unit tests for business logic
   - E2E tests for critical flows
   - UI verification when applicable
   - Translation testing if text changes

This workflow ensures consistent, high-quality development practices while maintaining the established design system and technical standards.