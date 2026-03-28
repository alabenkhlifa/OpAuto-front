---
description: Mark a task as complete — runs all quality checks and updates progress tracking
---

Execute ALL steps IN ORDER. Do not skip any. If a step fails, fix it before proceeding.

## Step 1: Identify what was completed
Review changes: `git diff --name-only`

## Step 2: Quick checks on changed files (instant)
Run these on changed files only (from git diff):
```bash
# console.log leftovers (exclude spec/test files)
git diff --name-only | grep '\.ts$' | grep -v '\.spec\.ts$' | xargs grep -n 'console\.log' 2>/dev/null && echo 'FAIL: Remove console.log statements' || echo 'PASS: No console.log'

# Hardcoded strings in templates (look for unlocalized user-facing text)
git diff --name-only | grep '\.html$' | xargs grep -nE '>[A-Z][a-z]{3,}.*</' 2>/dev/null | grep -v '{{'  | head -10 && echo 'WARNING: Possible hardcoded strings — verify they use translation keys' || echo 'PASS: No obvious hardcoded strings'

# TODO/FIXME in changed files
git diff --name-only | xargs grep -nE 'TODO|FIXME' 2>/dev/null | head -10 && echo 'WARNING: Unfinished TODOs in changed files' || echo 'PASS: No TODOs'

# any type in changed .ts files
git diff --name-only | grep '\.ts$' | xargs grep -nE ': any[^_]|<any>' 2>/dev/null | head -10 && echo 'WARNING: Weak typing found — consider replacing any' || echo 'PASS: No any types'
```

## Step 3: Translation key sync
```bash
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front && python3 -c "
import json
en = set(json.load(open('src/assets/i18n/en.json')).keys())
fr = set(json.load(open('src/assets/i18n/fr.json')).keys())
ar = set(json.load(open('src/assets/i18n/ar.json')).keys())
missing_fr = en - fr
missing_ar = en - ar
extra_ar = ar - en
if missing_fr: print(f'FR missing: {missing_fr}')
if missing_ar: print(f'AR missing: {missing_ar}')
if extra_ar: print(f'AR extra keys: {extra_ar}')
if not missing_fr and not missing_ar and not extra_ar: print('PASS: Translation top-level keys in sync')
"
```

## Step 4: Lint
```bash
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front && ng lint 2>&1 | tail -5
```

## Step 5: Frontend build
```bash
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front && ng build 2>&1 | tail -5
```

## Step 6: Backend build
```bash
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front/opauto-backend && npx tsc --noEmit 2>&1 | tail -10
```

## Step 7: Frontend tests
```bash
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front && npm run test -- --watch=false 2>&1 | tail -10
```

## Step 8: Update docs/MVP_PROGRESS.md
- Check off completed items with `[x]`
- If the work doesn't match an existing item, add it under the correct batch and check it off
- If it's new scope, create a new batch section

## Step 9: Report
Tell the user:
- What was completed
- Quick checks: pass/warn/fail for each
- Translation sync: pass/fail
- Lint: pass/fail
- Frontend build: pass/fail
- Backend build: pass/fail
- Tests: pass/fail
- What was checked off in MVP_PROGRESS.md
