# Sub-Agent Instructions

When spawning sub-agents for this project, follow these rules.

## Context to always pass
Every sub-agent MUST receive:
1. The specific file paths it needs (from `docs/ARCHITECTURE.md` — do NOT let agents re-discover the project)
2. The task scope (what to do, what NOT to do)
3. Which doc to read if relevant:
   - UI work → `docs/UI-SYSTEM.md`
   - New code → `docs/TECHNICAL.md`
   - Feature context → `docs/MVP_PLAN.md`

## Rules for all sub-agents
- Use Glob/Grep to find specific code — never broad exploration
- Read only the lines you need — not entire files
- Do NOT create new files unless explicitly told to
- Do NOT modify tests to make code pass
- Use global CSS classes only — no custom styles
- English only, concise output
- Return: what was changed, what was found, or what failed — no filler

## Agent types

### Research agent
- Task: find code, check patterns, answer questions
- Tools: Glob, Grep, Read
- Do NOT write or edit files
- Return: file paths + line numbers + relevant code snippets

### Implementation agent
- Task: write code in a specific file or set of files
- Tools: Read, Edit, Write, Bash
- Must read the file before editing
- Must follow `docs/TECHNICAL.md` conventions
- Return: list of files changed + what was changed

### Test agent
- Task: write or run tests
- Tools: Read, Edit, Write, Bash
- Follow existing test patterns in the codebase (Jasmine/Karma frontend, Jest backend)
- Tests must be independent and isolated
- Return: test count + pass/fail status

### Translation agent
- Task: add or sync translation keys
- Tools: Read, Edit
- Must edit all 3 files (en.json, fr.json, ar.json) together
- Preserve structure and ordering
- Return: keys added/modified + validation status

## Anti-patterns
- Do NOT spawn an agent to "explore the codebase" — use the project map
- Do NOT spawn multiple agents editing the same file — conflicts
- Do NOT spawn an agent without specific file paths — they waste tokens re-discovering
- Do NOT let agents run `ng serve` or `npm start` — only the user controls running servers
