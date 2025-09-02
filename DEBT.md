# Technical Debt & Unresolved Issues

## UI/UX Issues

### 📱 Appointments Text Visibility
**Issue**: Text appears white in light mode on appointments screen, making it unreadable
- **Location**: `src/app/features/appointments/appointments.component.html`
- **Description**: TailwindCSS dark mode classes not working properly - text shows as white even in light mode
- **Attempted Fixes**:
  - Added `[class.dark]="themeService.isDarkMode()"` to appointments container
  - Applied global dark class binding to app container
  - Increased background opacity for better text contrast (0.25 → 0.7)
  - Updated glassmorphism styling to match dashboard
- **Status**: Unresolved
- **Priority**: High (affects usability)
- **Next Steps**: Investigate TailwindCSS dark mode configuration or add explicit CSS text color overrides

### 🎨 Auth Page Background Elements
**Issue**: Animated background droplets on login/register page show white square borders around them
- **Location**: `src/app/features/auth/auth.component.ts` lines 18-20
- **Description**: The colored animated circles (blue, purple, amber) have barely visible white square outlines
- **Attempted Fixes**: 
  - Added `border-0` class
  - Added `!important` CSS rules to remove borders, outlines, box-shadows
  - Targeted `.absolute.w-80.h-80` elements specifically
  - Added `background-clip: padding-box`
  - Removed pseudo-elements with `::before` and `::after`
- **Status**: Unresolved
- **Priority**: Low (cosmetic issue)
- **Next Steps**: Investigate TailwindCSS v4 default styling or browser-specific rendering

## Language & Localization

### 🌐 Hardcoded Text Strings  
**Issue**: Auth component contains hardcoded English text that should be localized
- **Location**: `src/app/features/auth/auth.component.ts`
- **Strings to Translate**:
  - "Select Language" (line 41 in language toggle)
  - "💡 Tip: Click the flag to cycle through languages quickly" (line 81 in language toggle)
  - All form labels and buttons in auth component
- **Status**: Identified but not implemented
- **Priority**: Medium (affects multi-language support)

## Architecture & Code Quality

### 📁 TailwindCSS v4 Configuration
**Issue**: Custom utility classes defined manually instead of using built-in TailwindCSS classes
- **Location**: `src/styles.css` lines 4-7
- **Description**: Some utility classes are redefined when they might be available in TailwindCSS v4
- **Status**: Partially cleaned up
- **Priority**: Low (maintenance concern)

---

*Last Updated: 2025-09-02*
*Maintained by: Claude Code Assistant*