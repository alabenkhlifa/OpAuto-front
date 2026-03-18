import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip asset/translation requests and full URLs
  if (req.url.startsWith('http') || req.url.startsWith('/assets') || req.url.startsWith('assets')) {
    return next(req);
  }

  // Prepend apiUrl to API calls (relative URLs like /customers, /auth/login, etc.)
  const apiReq = req.clone({
    url: `${environment.apiUrl}${req.url.startsWith('/') ? '' : '/'}${req.url}`,
  });
  return next(apiReq);
};
