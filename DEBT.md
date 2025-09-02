# Technical Debt & Unresolved Issues

## UI/UX Issues

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