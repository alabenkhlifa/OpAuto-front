import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { map, filter, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ModuleService } from '../services/module.service';
import { TranslationService } from '../services/translation.service';
import { ModuleId } from '../models/module.model';
import { ToastService } from '../../shared/services/toast.service';

export const ownerGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const translate = inject(TranslationService);

  return authService.currentUser$.pipe(
    filter(user => user !== null),
    take(1),
    map(user => {
      if (authService.isOwner()) {
        return true;
      }
      const msg = translate.instant('auth.ownerOnly');
      toast.warning(msg && msg !== 'auth.ownerOnly' ? msg : 'Only the garage owner can access this page.');
      router.navigate(['/dashboard']);
      return false;
    })
  );
};

export const moduleGuard = (moduleId: ModuleId): CanActivateFn => {
  return (route, state) => {
    const moduleService = inject(ModuleService);
    const router = inject(Router);
    const toast = inject(ToastService);
    const translate = inject(TranslationService);

    return toObservable(moduleService.isLoaded).pipe(
      filter(loaded => loaded),
      take(1),
      map(() => {
        if (moduleService.hasModuleAccess(moduleId)) {
          return true;
        }
        const moduleName = translate.instant(`modules.names.${moduleId}`);
        const message = translate.instant('modules.activationRequired', { module: moduleName });
        toast.warning(message && message !== 'modules.activationRequired' ? message : `The ${moduleId} module needs to be activated to access this page.`);
        router.navigate(['/modules']);
        return false;
      })
    );
  };
};
