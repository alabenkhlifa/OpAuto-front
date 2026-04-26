import { Injectable, Logger } from '@nestjs/common';
import { Locale, SkillDefinition, SkillDescriptor } from './types';

/**
 * Stub. Phase 1 Subagent C loads markdown skills from disk
 * (assistant/skills/<name>/{en,fr,ar}.md) with frontmatter parsing and
 * locale fallback to en when fr/ar are missing.
 */
@Injectable()
export class SkillRegistryService {
  private readonly logger = new Logger(SkillRegistryService.name);
  private readonly skills = new Map<string, SkillDefinition>();

  list(): SkillDescriptor[] {
    return Array.from(this.skills.values()).map((s) => ({
      name: s.name,
      description: s.description,
    }));
  }

  load(name: string, locale: Locale): string | null {
    this.logger.warn(`SkillRegistryService.load(${name}, ${locale}) called on stub`);
    return null;
  }
}
