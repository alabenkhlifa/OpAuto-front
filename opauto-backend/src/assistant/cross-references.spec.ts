import * as fs from 'fs';
import * as path from 'path';
import * as matter from 'gray-matter';

import { createAnalyticsAgent } from './agents/analytics-agent';
import { createCommunicationsAgent } from './agents/communications-agent';
import { createFinanceAgent } from './agents/finance-agent';
import { createGrowthAgent } from './agents/growth-agent';
import { createInventoryAgent } from './agents/inventory-agent';
import { createSchedulingAgent } from './agents/scheduling-agent';

/**
 * Cross-reference safety net (I-006 in AI_ASSISTANT_IMPROVEMENTS.md).
 *
 * The skill registry and the agent runner both reference tool names by string.
 * Renaming or removing a tool without sweeping the skills/agents would break
 * `load_skill` / `dispatch_agent` at runtime with a confusing "tool not found"
 * error inside an agent loop. This suite is the cheap CI guard: it rebuilds
 * the truth set of registered tool names from `*.tool.ts` and asserts every
 * skill/agent reference resolves.
 *
 * Implementation note — we deliberately do NOT bootstrap the Nest module here.
 * The tool registry is populated by injectable registrars whose deps cascade
 * across half the backend. Reading the source files directly keeps this suite
 * fast and dep-free.
 */

const ASSISTANT_DIR = path.join(__dirname);
const TOOLS_DIR = path.join(ASSISTANT_DIR, 'tools');
const SKILLS_DIR = path.join(ASSISTANT_DIR, 'skills');

function discoverToolNames(): Set<string> {
  const names = new Set<string>();
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.tool.ts')) {
        const src = fs.readFileSync(full, 'utf8');
        // Match the first `name: '<x>',` line in the tool definition object.
        // Tools always declare exactly one `name: '...'` and it is the tool id.
        const match = /\bname:\s*['"]([a-z][a-z0-9_]*)['"]/m.exec(src);
        if (match) {
          names.add(match[1]);
        }
      }
    }
  }
  walk(TOOLS_DIR);
  return names;
}

function discoverSkillToolDecls(): Array<{ skill: string; tools: string[] }> {
  const out: Array<{ skill: string; tools: string[] }> = [];
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const enPath = path.join(SKILLS_DIR, entry.name, 'en.md');
    if (!fs.existsSync(enPath)) continue;
    const parsed = matter(fs.readFileSync(enPath, 'utf8'));
    const tools = Array.isArray((parsed.data as { tools?: unknown }).tools)
      ? ((parsed.data as { tools: unknown[] }).tools.filter(
          (t) => typeof t === 'string',
        ) as string[])
      : [];
    out.push({ skill: entry.name, tools });
  }
  return out;
}

describe('assistant cross-references (I-006)', () => {
  const registeredTools = discoverToolNames();
  const skills = discoverSkillToolDecls();
  const agents = [
    createAnalyticsAgent(),
    createCommunicationsAgent(),
    createFinanceAgent(),
    createGrowthAgent(),
    createInventoryAgent(),
    createSchedulingAgent(),
  ];

  it('discovers a non-empty set of registered tools (sanity)', () => {
    expect(registeredTools.size).toBeGreaterThanOrEqual(20);
  });

  describe('skills', () => {
    for (const { skill, tools } of skills.length > 0 ? skills : [{ skill: '<no-skills>', tools: [] }]) {
      it(`every tool declared by skill "${skill}" exists in the registry`, () => {
        const missing = tools.filter((t) => !registeredTools.has(t));
        expect(missing).toEqual([]);
      });
    }
  });

  describe('agents', () => {
    for (const agent of agents) {
      it(`every tool whitelisted by agent "${agent.name}" exists in the registry`, () => {
        const missing = agent.toolWhitelist.filter(
          (t) => !registeredTools.has(t),
        );
        expect(missing).toEqual([]);
      });
    }
  });
});
