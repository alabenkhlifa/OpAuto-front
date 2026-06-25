# Repository Instructions

- Batch AI-assistant live-test fixes by domain, keep each domain in its own focused conventional commit, and push/deploy the grouped fixes once after local tests pass. Avoid pushing one small production fix at a time unless the user explicitly asks for an emergency hotfix.
- After every production AI-assistant test run, update `AI_ASSISTANT_LIVE_TEST_TRACKER.md` with the tested commit, output JSON path, pass/fail IDs, and next action before starting the next fix or deployment cycle.
- When the user asks to commit and push, commit with exactly one git command and push with exactly one git command; do not run extra git/status/log commands before or after unless the user explicitly asks.
- When monitoring deployment, use the fewest practical commands and prefer one wait-and-verify command based on recent deployment timing instead of repeated polling commands.
