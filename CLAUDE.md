# Claude Developer Profile & Quick Reference

## 🚨 **CRITICAL ENFORCEMENT RULES**

### 1. Design System Compliance
**BEFORE making ANY UI changes:**
- Read `DESIGN_SYSTEM_CHECKLIST.md` completely
- Follow UI-SYSTEM.md patterns exactly
- Use ONLY global classes from `/src/styles/`
- NO custom CSS, NO conditional `dark:` classes

**Quick Reference**:
- Cards: `glass-card` ONLY
- Buttons: `btn-primary|secondary|tertiary|danger|success`
- Badges: `badge badge-{status}`
- Text: `text-white|gray-300|gray-400` (permanent dark theme)

### 2. UI Verification Process (MANDATORY)
When making UI changes:
- Take Playwright screenshots in dark mode
- Check text contrast ratios programmatically
- Never claim "fixed" without completing verification
- **If user reports same issue twice = FAILURE**

### 3. Linear Integration
- Put issues "In Progress" when starting work
- Update to "Done" only after user confirmation
- Include acceptance criteria in issue creation

### 4. Playwright Usage Rule
- Only use Playwright when user adds "use PL" 
- Focus on code changes and compilation feedback
- NEVER navigate to auth pages automatically

## 📚 Documentation Structure

- **`TECHNICAL.md`** - Angular best practices, testing, architecture
- **`UI-SYSTEM.md`** - Complete UI/design system guidelines  
- **`FEATURES.md`** - OpAuto features & implementation roadmap
- **`WORKFLOWS.md`** - Development workflows & essential commands
- **`DESIGN_SYSTEM_CHECKLIST.md`** - Mandatory UI compliance checklist

## 👨‍💻 Developer Profile
Senior Angular developer specializing in:
- Angular 15+ with standalone components
- TypeScript strict mode & best practices
- RxJS reactive programming patterns
- Glassmorphism UI with permanent dark theme
- Test-driven development (TDD)
- Performance optimization & accessibility

## 🚧 OpAuto Project Overview

Modern garage management system with:
- **Apple-style glassmorphism** - Dark theme with blur effects
- **Angular 15+** - Standalone components, signals, reactive programming
- **Multi-language** - English, French, Arabic with RTL support
- **Mobile-first** - iPhone SE 2020 minimum (375px)

## 🌐 Quick Commands

### Development
```bash
ng serve                  # Start dev server
npm run build            # Build project  
npm run test             # Run unit tests
npm run lint             # Check code quality
```

### Translation Testing
```bash
# Test all languages with Playwright (when "use PL" specified)
# - Set localStorage language to Arabic
# - Verify RTL layout and text rendering
# - Check all UI elements are translated
```

## ⚡ Development Reminders

### Critical Rules
1. **Test-Driven Development**: Write unit tests BEFORE implementing sensitive functions
2. **Never modify tests**: Don't change tests after implementation to make them pass
3. **Commit workflow**: Ask before committing - only commit when user explicitly requests
4. **Token efficiency**: Be direct, implement immediately, avoid over-planning
5. **File preference**: ALWAYS prefer editing existing files over creating new ones

### Translation Testing with Playwright
```bash
# When "use PL" specified for translation testing:
localStorage.setItem('language', 'ar')  # Set Arabic in localStorage
# No auth navigation - go directly to target pages
# Verify RTL layout and Arabic text rendering
```

---

**📋 For detailed guidelines, see:**
- `TECHNICAL.md` - Angular patterns & testing
- `UI-SYSTEM.md` - Design system & components  
- `FEATURES.md` - Project features & roadmap
- `WORKFLOWS.md` - Commands & processes
- `DESIGN_SYSTEM_CHECKLIST.md` - UI compliance checklist

## ⭐ Final Notes

**This is now a streamlined quick-reference guide. All detailed information has been moved to dedicated files:**

- See `TECHNICAL.md` for Angular development patterns  
- See `UI-SYSTEM.md` for complete design system rules
- See `FEATURES.md` for project roadmap
- See `WORKFLOWS.md` for development processes  
- See `DESIGN_SYSTEM_CHECKLIST.md` for UI compliance

**Remember**: Focus on delivering working code efficiently while following the established patterns.
