import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as matter from 'gray-matter';
import { Locale, SkillDefinition, SkillDescriptor } from './types';

const LOCALES: Locale[] = ['en', 'fr', 'ar'];

/**
 * Loads markdown skill playbooks from disk.
 *
 * Layout: assistant/skills/<skill-name>/{en,fr,ar}.md
 * - en.md is the source of truth for frontmatter (name/description/triggers/tools).
 * - fr.md and ar.md contribute only their localized body.
 * - Missing locale files fall back to en at load time.
 */
@Injectable()
export class SkillRegistryService implements OnModuleInit {
  private readonly logger = new Logger(SkillRegistryService.name);
  private readonly skills = new Map<string, SkillDefinition>();

  // Resolved at construction time so tests can override via setSkillsDir()
  // before lifecycle init, while production runs use the colocated skills/
  // directory next to the compiled JS.
  private skillsDir: string = path.join(__dirname, 'skills');

  onModuleInit(): void {
    this.reload();
  }

  /**
   * Test-only seam: point the registry at a different directory before
   * onModuleInit / reload runs. Avoids polluting the DI graph with a token.
   */
  setSkillsDir(dir: string): void {
    this.skillsDir = dir;
  }

  list(): SkillDescriptor[] {
    return Array.from(this.skills.values()).map((s) => ({
      name: s.name,
      description: s.description,
    }));
  }

  load(name: string, locale: Locale): string | null {
    const skill = this.skills.get(name);
    if (!skill) {
      return null;
    }
    const body = skill.bodyByLocale[locale];
    if (body && body.trim().length > 0) {
      return body;
    }
    return skill.bodyByLocale.en ?? null;
  }

  getDefinition(name: string): SkillDefinition | null {
    return this.skills.get(name) ?? null;
  }

  reload(): void {
    this.skills.clear();

    if (!fs.existsSync(this.skillsDir)) {
      this.logger.warn(
        `Skills directory not found at ${this.skillsDir}; skill registry is empty.`,
      );
      return;
    }

    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillName = entry.name;
      const dir = path.join(this.skillsDir, skillName);

      const enPath = path.join(dir, 'en.md');
      if (!fs.existsSync(enPath)) {
        this.logger.warn(
          `Skill "${skillName}" is missing en.md; skipping.`,
        );
        continue;
      }

      const enRaw = fs.readFileSync(enPath, 'utf8');
      const enParsed = matter(enRaw);
      const enData = enParsed.data as {
        name?: unknown;
        description?: unknown;
        triggers?: unknown;
        tools?: unknown;
      };

      if (typeof enData.name !== 'string' || enData.name.length === 0) {
        this.logger.warn(
          `Skill "${skillName}/en.md" is missing a string "name" frontmatter field; skipping.`,
        );
        continue;
      }
      if (enData.name !== skillName) {
        this.logger.warn(
          `Skill "${skillName}" frontmatter name "${enData.name}" does not match folder name; skipping.`,
        );
        continue;
      }
      if (typeof enData.description !== 'string' || enData.description.length === 0) {
        this.logger.warn(
          `Skill "${skillName}/en.md" is missing a string "description" frontmatter field; skipping.`,
        );
        continue;
      }

      const triggers = Array.isArray(enData.triggers)
        ? (enData.triggers.filter((t) => typeof t === 'string') as string[])
        : undefined;
      const toolWhitelist = Array.isArray(enData.tools)
        ? (enData.tools.filter((t) => typeof t === 'string') as string[])
        : undefined;

      const bodyByLocale: Record<Locale, string> = {
        en: enParsed.content.trim(),
        fr: '',
        ar: '',
      };

      for (const locale of LOCALES) {
        if (locale === 'en') continue;
        const localePath = path.join(dir, `${locale}.md`);
        if (!fs.existsSync(localePath)) continue;
        const raw = fs.readFileSync(localePath, 'utf8');
        const parsed = matter(raw);
        bodyByLocale[locale] = parsed.content.trim();
      }

      this.skills.set(skillName, {
        name: skillName,
        description: enData.description,
        triggers,
        toolWhitelist,
        bodyByLocale,
      });
    }

    this.logger.log(
      `Loaded ${this.skills.size} skill(s) from ${this.skillsDir}.`,
    );
  }
}
