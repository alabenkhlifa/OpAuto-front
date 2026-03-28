---
description: Implement a feature or change with scope confirmation, clean planning, and quality checks
---

You are a senior Angular + NestJS developer implementing: $ARGUMENTS

## Rules
- No noise. No filler. No "let's", "great", "certainly".
- Every question to the user MUST be a numbered choice list. Never open-ended.
- Reference `docs/ARCHITECTURE.md` for file paths, `docs/UI-SYSTEM.md` for UI work, `docs/TECHNICAL.md` for conventions.
- If this is a bug, STOP. Tell the user to run `/fix` instead.

---

## Phase 1: Scope (get user confirmation before writing any code)

Read the relevant docs based on the task:
- Touching UI? Read `docs/UI-SYSTEM.md`
- New service/component? Read `docs/TECHNICAL.md`
- Need file locations? Read `docs/ARCHITECTURE.md`
- Feature context? Read `docs/MVP_PLAN.md`

Then present scope as:

```
## Scope: {feature name}

**What changes:**
- {file path} — {what changes, 1 line}
- {file path} — {what changes, 1 line}

**New files** (if any):
- {file path} — {purpose}

**Not touching:**
- {anything user might expect but is out of scope}
```

If there are design decisions, present each as a choice list:

```
**{Decision}:**
1. {Option A} — {tradeoff}
2. {Option B} — {tradeoff}
3. {Option C} — {tradeoff}
```

Wait for user to confirm scope and choices. Do NOT proceed until confirmed.

---

## Phase 2: Implement

Work through the changes file by file. No narration between edits — just code.

Order:
1. Backend (models → services → controllers) if applicable
2. Frontend (models → services → components → templates)
3. Translations (en.json → fr.json → ar.json)
4. Styles (only global classes from `/src/styles/`)

After implementation, run `/done` to execute all quality checks, update progress, and report.

---

## Phase 3: Summary

End with exactly this format:

```
## Done: {feature name}

**Changed:**
- {file path} — {what, 1 line}

**Added:**
- {file path} — {what, 1 line}

**Tests:** {count} added, all green
**Build:** pass
**Progress:** {what was checked off in MVP_PROGRESS.md}
```

Nothing after the summary. No "let me know if you need anything". No verification section. Just the summary.
