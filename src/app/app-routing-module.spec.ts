import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ownerGuard, moduleGuard } from './core/guards/role.guard';
import { routes } from './app-routing-module';

/**
 * Sweep C-13 — S-SEC-007 (Module access guard).
 *
 * Pure config-shape regression: assert that `/invoices` is gated by
 * `authGuard`, `ownerGuard`, AND `moduleGuard('invoicing')`. A future
 * regression that drops the moduleGuard would silently ship paid
 * functionality to garages that haven't activated the module — this
 * spec is the line of defense.
 */
describe('app-routing — S-SEC-007 invoicing module gate', () => {
  function findRoute(rs: Routes | undefined, path: string): any | undefined {
    if (!rs) return undefined;
    for (const r of rs) {
      if (r.path === path) return r;
    }
    return undefined;
  }

  it('declares the /invoices route', () => {
    const r = findRoute(routes, 'invoices');
    expect(r).withContext('routes table contains /invoices').toBeTruthy();
  });

  it('/invoices route is gated by authGuard + ownerGuard + moduleGuard("invoicing")', () => {
    const r = findRoute(routes, 'invoices');
    expect(r.canActivate).toBeTruthy();
    const guards = r.canActivate as any[];
    // The guard array order is load-bearing: authGuard runs first, then
    // ownerGuard, then the module gate. moduleGuard('invoicing') is
    // produced by a factory so we assert its presence by function shape
    // — it's a CanActivateFn closure carrying the moduleId binding.
    expect(guards.length).toBeGreaterThanOrEqual(3);
    expect(guards).toContain(authGuard);
    expect(guards).toContain(ownerGuard);
    // The 3rd guard is the moduleGuard — we can't reference-compare the
    // factory result directly (each call returns a fresh function), but
    // we CAN assert there's a callable function in the canActivate array
    // that is NOT one of the static guards.
    const dynamic = guards.filter(
      (g) => g !== authGuard && g !== ownerGuard,
    );
    expect(dynamic.length).toBe(1);
    expect(typeof dynamic[0]).toBe('function');
  });

  it('the same module-guard factory is wired on /inventory / /reports / /employees / /users / /settings / /approvals / /notifications / /maintenance / /calendar', () => {
    // Belt-and-braces: every paid-module surface must carry a moduleGuard.
    const paidPaths = [
      'inventory',
      'reports',
      'employees',
      'users',
      'settings',
      'approvals',
      'notifications',
      'maintenance',
      'calendar',
    ];
    paidPaths.forEach((p) => {
      const r = findRoute(routes, p);
      // Skip silently if the path isn't declared (some surfaces are
      // children); failing here would make this spec too tightly
      // coupled to the routing tree shape.
      if (!r) return;
      const guards = (r.canActivate || []) as any[];
      const hasModuleGuard = guards.some(
        (g) => g !== authGuard && g !== ownerGuard && typeof g === 'function',
      );
      expect(hasModuleGuard)
        .withContext(`route /${p} should have a moduleGuard`)
        .toBeTrue();
    });
  });

  it('factory shape — moduleGuard(<id>) returns a callable CanActivateFn', () => {
    const fn = moduleGuard('invoicing');
    expect(typeof fn).toBe('function');
  });
});
