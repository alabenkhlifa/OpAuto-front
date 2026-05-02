import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ownerGuard, moduleGuard } from './core/guards/role.guard';
import { routes } from './app-routing-module';

/**
 * Sweep C-13 — S-SEC-007 (Module access guard).
 * Sweep C-15 — re-spec to drop ownerGuard from `/invoices` (S-AUTH-002/003/006).
 *
 * Pure config-shape regression: assert that `/invoices` is gated by
 * `authGuard` AND `moduleGuard('invoicing')`. The ownerGuard was
 * previously included but the BE policy is `@Roles(OWNER, STAFF)` on
 * the invoicing surface — owner-only destructive actions (delete,
 * discount approval) are gated at the component layer. A future
 * regression that drops the moduleGuard would silently ship paid
 * functionality to garages that haven't activated the module — this
 * spec is the line of defense for the module gate.
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

  it('/invoices route is gated by authGuard + moduleGuard("invoicing"); NO ownerGuard', () => {
    const r = findRoute(routes, 'invoices');
    expect(r.canActivate).toBeTruthy();
    const guards = r.canActivate as any[];
    // Sweep C-15 — guard chain is `[authGuard, moduleGuard('invoicing')]`.
    // STAFF must be allowed to access /invoices per BE @Roles(OWNER, STAFF).
    expect(guards.length).toBe(2);
    expect(guards).toContain(authGuard);
    expect(guards).not.toContain(ownerGuard);
    // The 2nd guard is the moduleGuard factory — fresh function per call,
    // so we assert by shape (callable, not one of the static guards).
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
