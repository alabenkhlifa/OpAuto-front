import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { map, filter, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ModuleService } from '../services/module.service';
import { ModuleId } from '../models/module.model';

export const ownerGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    map(user => {
      if (user && authService.isOwner()) {
        return true;
      } else {
        router.navigate(['/dashboard']);
        return false;
      }
    })
  );
};

export const moduleGuard = (moduleId: ModuleId): CanActivateFn => {
  return (route, state) => {
    const moduleService = inject(ModuleService);
    const router = inject(Router);

    // Wait for modules to finish loading before checking access
    return toObservable(moduleService.isLoaded).pipe(
      filter(loaded => loaded),
      take(1),
      map(() => {
        if (moduleService.hasModuleAccess(moduleId)) {
          return true;
        }
        router.navigate(['/modules']);
        return false;
      })
    );
  };
};
