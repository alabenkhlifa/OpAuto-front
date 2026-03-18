import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

let isRefreshing = false;
const refreshDone$ = new BehaviorSubject<boolean>(false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Attach access token to outgoing requests (skip refresh endpoint — it sends refresh_token in body)
  const token = authService.getToken();
  const authReq = token && !req.url.includes('/auth/refresh')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only intercept 401s, and skip auth endpoints to avoid loops
      if (
        error.status !== 401 ||
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/register') ||
        req.url.includes('/auth/refresh')
      ) {
        return throwError(() => error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshDone$.next(false);

        return authService.refreshToken().pipe(
          switchMap(response => {
            isRefreshing = false;
            refreshDone$.next(true);

            // Retry the original request with the new access token
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${response.token}` }
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            isRefreshing = false;
            refreshDone$.next(true);

            // Refresh failed — token is truly expired, force logout
            authService.forceLogout();
            router.navigate(['/auth']);
            return throwError(() => refreshError);
          })
        );
      }

      // Another request hit 401 while we're already refreshing — wait for refresh to complete, then retry
      return refreshDone$.pipe(
        filter(done => done),
        take(1),
        switchMap(() => {
          const newToken = authService.getToken();
          const retryReq = req.clone({
            setHeaders: { Authorization: `Bearer ${newToken}` }
          });
          return next(retryReq);
        })
      );
    })
  );
};
