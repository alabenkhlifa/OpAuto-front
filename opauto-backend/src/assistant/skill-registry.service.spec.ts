import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SkillRegistryService } from './skill-registry.service';

/**
 * Helper: instantiate the service against an arbitrary directory and run
 * the lifecycle hook so behavior matches a real Nest bootstrap.
 */
function buildWithDir(dir: string): SkillRegistryService {
  const svc = new SkillRegistryService();
  svc.setSkillsDir(dir);
  svc.onModuleInit();
  return svc;
}

describe('SkillRegistryService', () => {
  describe('default skills/ directory (real example skill)', () => {
    let service: SkillRegistryService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [SkillRegistryService],
      }).compile();
      service = module.get<SkillRegistryService>(SkillRegistryService);
      await module.init();
    });

    it('loads the example skill at module init (visible via listAll, not list)', () => {
      const allSkills = service.listAll();
      const example = allSkills.find((s) => s.name === 'example');
      expect(example).toBeDefined();
      expect(example?.description).toBe(
        'A no-op skill used for testing the loader.',
      );
    });

    it('hides skills marked `internal: true` from list() so the LLM router cannot trigger them', () => {
      // The bundled `example` skill is marked internal — it must NOT appear in
      // the router-visible list, but it IS still loadable by name and visible
      // via listAll() for tests / admin tooling.
      expect(service.list().find((s) => s.name === 'example')).toBeUndefined();
      expect(service.listAll().find((s) => s.name === 'example')).toBeDefined();
      expect(service.load('example', 'en')).not.toBeNull();
    });

    it('returns the English body for load("example", "en")', () => {
      const body = service.load('example', 'en');
      expect(body).toContain('English body of the example skill');
    });

    it('returns the Arabic body for load("example", "ar")', () => {
      const body = service.load('example', 'ar');
      expect(body).toContain('النص العربي');
    });

    it('returns null for unknown skills', () => {
      expect(service.load('nonexistent', 'en')).toBeNull();
    });

    it('exposes triggers via getDefinition', () => {
      const def = service.getDefinition('example');
      expect(def?.triggers).toEqual(['test']);
    });
  });

  describe('fixture-injected directory', () => {
    let tmpRoot: string;

    beforeEach(() => {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-registry-'));
    });

    afterEach(() => {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    function writeSkill(
      name: string,
      files: Partial<Record<'en' | 'fr' | 'ar', string>>,
    ): void {
      const dir = path.join(tmpRoot, name);
      fs.mkdirSync(dir, { recursive: true });
      for (const [locale, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, `${locale}.md`), content ?? '', 'utf8');
      }
    }

    it('falls back to en body when fr.md is missing', () => {
      writeSkill('greet', {
        en: `---\nname: greet\ndescription: Greet someone.\n---\n\nHello there.\n`,
        ar: `---\nname: greet\ndescription: Greet someone.\n---\n\nمرحبا.\n`,
      });

      const svc = buildWithDir(tmpRoot);

      expect(svc.load('greet', 'fr')).toBe('Hello there.');
      expect(svc.load('greet', 'ar')).toBe('مرحبا.');
      expect(svc.load('greet', 'en')).toBe('Hello there.');
    });

    it('falls back to en body when fr.md is empty', () => {
      writeSkill('greet', {
        en: `---\nname: greet\ndescription: Greet someone.\n---\n\nHello there.\n`,
        fr: `---\nname: greet\ndescription: Greet someone.\n---\n\n   \n`,
      });

      const svc = buildWithDir(tmpRoot);
      expect(svc.load('greet', 'fr')).toBe('Hello there.');
    });

    it('skips folders whose frontmatter name does not match the folder name', () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      writeSkill('mismatched', {
        en: `---\nname: somethingElse\ndescription: Bad config.\n---\n\nBody.\n`,
      });

      const svc = buildWithDir(tmpRoot);

      expect(svc.list()).toHaveLength(0);
      expect(svc.load('mismatched', 'en')).toBeNull();
      expect(svc.load('somethingElse', 'en')).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not match folder name'),
      );

      warnSpy.mockRestore();
    });

    it('skips folders missing en.md and warns', () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      writeSkill('only-fr', {
        fr: `---\nname: only-fr\ndescription: French only.\n---\n\nBonjour.\n`,
      });

      const svc = buildWithDir(tmpRoot);

      expect(svc.list()).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing en.md'),
      );

      warnSpy.mockRestore();
    });

    it('does not throw when the skills directory does not exist', () => {
      const missing = path.join(tmpRoot, 'does', 'not', 'exist');
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      const svc = new SkillRegistryService();
      svc.setSkillsDir(missing);
      expect(() => svc.onModuleInit()).not.toThrow();
      expect(svc.list()).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skills directory not found'),
      );

      warnSpy.mockRestore();
    });

    it('parses triggers and tools from en.md frontmatter', () => {
      writeSkill('full', {
        en: `---\nname: full\ndescription: Has everything.\ntriggers: [foo, bar]\ntools: [tool_a, tool_b]\n---\n\nFull body.\n`,
      });

      const svc = buildWithDir(tmpRoot);
      const def = svc.getDefinition('full');
      expect(def?.triggers).toEqual(['foo', 'bar']);
      expect(def?.toolWhitelist).toEqual(['tool_a', 'tool_b']);
    });

    it('reload() picks up newly added skills', () => {
      const svc = buildWithDir(tmpRoot);
      expect(svc.list()).toHaveLength(0);

      writeSkill('late', {
        en: `---\nname: late\ndescription: Added later.\n---\n\nLate body.\n`,
      });

      svc.reload();
      expect(svc.list().map((s) => s.name)).toContain('late');
      expect(svc.load('late', 'en')).toBe('Late body.');
    });
  });
});
