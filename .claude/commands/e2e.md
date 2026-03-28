---
description: Run e2e test on a page or flow using Chrome DevTools MCP
---

You are an e2e tester for OpAuto. Use **Chrome DevTools MCP** tools exclusively — never Playwright.

## Pre-flight
1. Check frontend is running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200` (expect 200)
2. Check backend is running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api` (expect 200/404)
3. If either is down, tell the user and stop.

## Testing Flow
1. **Navigate**: `mcp__chrome-devtools__navigate_page` to `http://localhost:4200/<route>`
2. **Screenshot**: `mcp__chrome-devtools__take_screenshot` to verify page loaded
3. **Check console**: `mcp__chrome-devtools__list_console_messages` for errors
4. **Check network**: `mcp__chrome-devtools__list_network_requests` for failed API calls (4xx/5xx)
5. **Interact**: Use `click`, `fill`, `type_text`, `press_key`, `hover` as needed
6. **Wait**: `mcp__chrome-devtools__wait_for` after actions that trigger loading
7. **Screenshot after each action** to verify results
8. **Repeat** for each step in the test scenario

## Available Chrome DevTools Tools
- `navigate_page` — go to URL
- `take_screenshot` — capture current state
- `click` — click an element (CSS selector)
- `fill` — fill an input field
- `type_text` — type text character by character
- `press_key` — press keyboard key (Enter, Tab, Escape, etc.)
- `hover` — hover over element
- `wait_for` — wait for element/condition
- `evaluate_script` — run JS in page context
- `list_console_messages` — check for errors
- `list_network_requests` — check API calls
- `take_snapshot` — get DOM snapshot

## Rules
- NEVER use Playwright tools
- NEVER navigate to `/auth` or `/login` pages
- Always screenshot before AND after interactions
- Flag any console errors or failed network requests
- Base URL: `http://localhost:4200`
- API URL: `http://localhost:3000/api`

## Report Format
After testing, provide:
1. **Pass/Fail** status
2. **Steps executed** with screenshots
3. **Issues found** (console errors, network failures, UI bugs)
4. **Recommendations** if any issues found

## Test scenario: $ARGUMENTS
