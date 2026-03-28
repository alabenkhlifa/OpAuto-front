---
description: Diagnose and fix a bug with screenshots, red/green tests, and full documentation
---

You are a senior debugger. Follow this process EXACTLY for: $ARGUMENTS

## Step 0: Setup fix folder
```bash
# Generate fix ID and create folder
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front
LAST_ID=$(ls -d fixes/FIX-* 2>/dev/null | sort -V | tail -1 | grep -oE '[0-9]+' | head -1)
NEXT_ID=$(printf "%03d" $(( ${LAST_ID:-0} + 1 )))
SLUG=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | cut -c1-40)
FIX_DIR="fixes/FIX-${NEXT_ID}-${SLUG}"
mkdir -p "$FIX_DIR"
echo "Fix directory: $FIX_DIR"
```
Save the FIX_DIR path — you'll use it throughout.

## Step 1: Reproduce & screenshot the bug
1. Check frontend is running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200`
2. Check backend is running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api`
3. If either is down, tell the user and STOP.
4. Navigate to the affected page with `mcp__chrome-devtools__navigate_page`
5. Reproduce the issue as described by the user
6. Take a screenshot: `mcp__chrome-devtools__take_screenshot` → save as `before.png` in FIX_DIR
7. Check console errors: `mcp__chrome-devtools__list_console_messages`
8. Check failed network requests: `mcp__chrome-devtools__list_network_requests`

## Step 2: Diagnose root cause
Use the project map from `docs/ARCHITECTURE.md` to go DIRECTLY to the relevant files:
- Frontend models: `src/app/core/models/`
- Frontend services: `src/app/core/services/` or `src/app/features/*/services/`
- Frontend components: `src/app/features/*/`
- Backend modules: `opauto-backend/src/{module-name}/`
- Translations: `src/assets/i18n/en.json`

Use Grep to find the specific code causing the issue. Do NOT read entire files — target the exact function or template.

Document your findings:
- **Root cause**: what's wrong and why
- **Affected files**: list with line numbers
- **Fix strategy**: what you'll change

## Step 3: Write RED tests (must fail)
Write tests that reproduce the bug BEFORE fixing it. Tests go in the standard test directories (not in the fix folder).

### Frontend unit tests
- File: alongside the affected component/service (e.g. `*.spec.ts`)
- Use Jasmine/Karma patterns matching existing tests
- Test the exact broken behavior

### Backend integration tests (if backend is involved)
- File: `opauto-backend/src/{module}/tests/` or `opauto-backend/test/`
- Use Jest + Prisma test client
- Test the exact broken endpoint/service method

### Run tests — confirm they FAIL (red)
```bash
# Frontend (run only the affected spec file)
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front && npx ng test --watch=false --include='**/affected-file.spec.ts' 2>&1 | tail -20

# Backend (if applicable)
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front/opauto-backend && npx jest --testPathPattern='affected-file' 2>&1 | tail -20
```
If tests pass at this stage, your tests don't capture the bug. Rewrite them.

## Step 4: Implement the fix
- Make minimal, targeted changes
- Follow patterns from `docs/TECHNICAL.md`
- If touching UI, follow `docs/UI-SYSTEM.md`
- Prefer editing existing files over creating new ones

## Step 5: Run tests — confirm they PASS (green)
Rerun the exact same test commands from Step 3. ALL must pass.

If any test fails, fix the implementation (NOT the tests) and rerun.

Also run the full suite to check for regressions:
```bash
# Frontend full
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front && npm run test -- --watch=false 2>&1 | tail -10

# Backend full (if backend was changed)
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front/opauto-backend && npx jest 2>&1 | tail -10
```

## Step 6: Verify the build
```bash
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front && ng build 2>&1 | tail -5
```

## Step 7: Screenshot the fix
1. Navigate to the same page as Step 1 with `mcp__chrome-devtools__navigate_page`
2. Reproduce the same scenario — it should now work correctly
3. Take a screenshot: `mcp__chrome-devtools__take_screenshot` → save as `after.png` in FIX_DIR
4. Verify no console errors: `mcp__chrome-devtools__list_console_messages`

## Step 8: Document the fix
Create `SUMMARY.md` in the fix folder:
```markdown
# FIX-{ID}: {short title}

**Date**: {today}
**Status**: Fixed
**Reported issue**: {user's description}

## Root cause
{1-2 sentences explaining why the bug happened}

## Files changed
- `path/to/file.ts` — {what was changed}
- `path/to/file.spec.ts` — {test added}

## Tests added
- {test description 1}
- {test description 2}

## Screenshots
- [Before](before.png)
- [After](after.png)
```

## Step 9: Update the fixes log
Append to `fixes/FIXES.md` (create if it doesn't exist):
```markdown
| FIX-{ID} | {date} | {one-line description} | Fixed | [details](FIX-{ID}-{slug}/SUMMARY.md) |
```

If `FIXES.md` doesn't exist yet, create it with the header:
```markdown
# Fixes Log

| ID | Date | Issue | Status | Details |
|----|------|-------|--------|---------|
```

## Step 10: Update progress
Update `docs/MVP_PROGRESS.md` if the fix relates to any tracked item.

## Step 11: Report
Tell the user:
- **Fix ID**: FIX-{ID}
- **Root cause**: 1 sentence
- **What was fixed**: files changed
- **Tests**: count of tests added, red→green confirmed
- **Build**: pass/fail
- **Screenshots**: before/after saved in FIX_DIR
