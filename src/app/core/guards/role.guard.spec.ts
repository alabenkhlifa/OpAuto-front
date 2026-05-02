import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';

import { moduleGuard, ownerGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { ModuleService } from '../services/module.service';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../../shared/services/toast.service';
import { ModuleId } from '../models/module.model';

/**
 * Sweep C-13 — S-SEC-007 (Module access guard).
 *
 * The invoicing route in `app-routing-module.ts` is protected by
 * `moduleGuard('invoicing')`. The guard reads `ModuleService.hasModuleAccess`
 * (which is loaded once via `loadActiveModules()`); when the module is
 * NOT active, the guard:
 *   - returns `false` (route blocked)
 *   - navigates the user to `/modules`
 *   - emits a translated warning toast
 *
 * Free modules (dashboard / customers / cars / appointments) bypass the
 * gate via `FREE_MODULES`. Invoicing is a paid module — the guard is the
 * gate of record.
 */
describe('moduleGuard / ownerGuard — Sweep C-13 S-SEC-007', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let translationStub: any;
  let moduleSvc: any;
  let authSvc: any;

  function configure(opts: {
    isLoaded?: boolean;
    hasAccess?: boolean;
    isOwner?: boolean;
    currentUser?: any;
  }) {
    const isLoadedSig = signal(opts.isLoaded ?? true);
    moduleSvc = {
      // Drive `toObservable(isLoaded)` directly — the guard pipes through
      // `filter(loaded => loaded)` and `take(1)` so a true signal triggers
      // the map() lookup immediately.
      isLoaded: isLoadedSig,
      hasModuleAccess: jasmine
        .createSpy('hasModuleAccess')
        .and.returnValue(opts.hasAccess ?? true),
    };
    authSvc = {
      isOwner: jasmine.createSpy('isOwner').and.returnValue(opts.isOwner ?? true),
      // currentUser$ is consumed by ownerGuard with `filter(u => u !== null)`.
      currentUser$: of(opts.currentUser ?? { id: 'u1', email: 'owner@autotech.tn' }),
    };
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', [
      'warning',
      'error',
      'success',
    ]);
    translationStub = {
      instant: (k: string) => k,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: ModuleService, useValue: moduleSvc },
        { provide: AuthService, useValue: authSvc },
        { provide: TranslationService, useValue: translationStub },
      ],
    });
  }

  describe('moduleGuard("invoicing") — S-SEC-007', () => {
    it('allows the route when the invoicing module is active', async () => {
      configure({ hasAccess: true });
      const guard = moduleGuard('invoicing');
      const result = await firstValueFrom(
        TestBed.runInInjectionContext(() => guard({} as any, {} as any) as any),
      );
      expect(result).toBeTrue();
      expect(moduleSvc.hasModuleAccess).toHaveBeenCalledWith('invoicing');
      expect(routerSpy.navigate).not.toHaveBeenCalled();
      expect(toastSpy.warning).not.toHaveBeenCalled();
    });

    it('blocks the route when invoicing is not active and routes to /modules', async () => {
      configure({ hasAccess: false });
      const guard = moduleGuard('invoicing');
      const result = await firstValueFrom(
        TestBed.runInInjectionContext(() => guard({} as any, {} as any) as any),
      );
      expect(result).toBeFalse();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/modules']);
      // The translated activation-required toast fires (key echoed via
      // the stub); production wires `modules.activationRequired` with
      // a `{{ module }}` interpolation.
      expect(toastSpy.warning).toHaveBeenCalled();
    });

    it('does not resolve while ModuleService.isLoaded() is false', async () => {
      // Set up with isLoaded=false; the guard pipes through
      // `filter(loaded => loaded)` so it never emits while loading.
      configure({ isLoaded: false, hasAccess: true });
      const guard = moduleGuard('invoicing');
      let resolved = false;
      const sub = TestBed.runInInjectionContext(() =>
        (guard({} as any, {} as any) as any).subscribe(() => {
          resolved = true;
        }),
      );
      // Synchronous tick — `toObservable(signal)` does NOT emit immediately
      // when signal value is false (the `filter` blocks). We allow a
      // microtask to flush so this isn't sensitive to angular scheduling.
      await Promise.resolve();
      expect(resolved)
        .withContext('guard should NOT resolve while modules still loading')
        .toBeFalse();
      // Final assertion: hasModuleAccess hasn't been queried yet because
      // the filter blocked the chain.
      expect(moduleSvc.hasModuleAccess).not.toHaveBeenCalled();
      sub.unsubscribe();
    });
  });

  describe('ownerGuard — S-AUTH-004 regression', () => {
    it('allows the route when the user is OWNER', async () => {
      configure({ isOwner: true });
      const result = await firstValueFrom(
        TestBed.runInInjectionContext(() => ownerGuard({} as any, {} as any) as any),
      );
      expect(result).toBeTrue();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('blocks the route when the user is NOT owner and routes to /dashboard', async () => {
      configure({ isOwner: false });
      const result = await firstValueFrom(
        TestBed.runInInjectionContext(() => ownerGuard({} as any, {} as any) as any),
      );
      expect(result).toBeFalse();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
      expect(toastSpy.warning).toHaveBeenCalled();
    });
  });
});
