import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

const IS_RETRY = new HttpContextToken<boolean>(() => false);

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);

  return next(request).pipe(
    catchError((error: unknown) => {
      const isAlreadyRetried = request.context.get(IS_RETRY);

      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isAlreadyRetried &&
        !request.url.includes('/auth/login') &&
        !request.url.includes('/auth/refresh') &&
        !request.url.includes('/auth/logout')
      ) {
        if (auth.hasRefreshToken()) {
          return from(auth.refresh()).pipe(
            switchMap((newToken) => {
              const retried = request.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
                context: request.context.set(IS_RETRY, true),
              });
              return next(retried);
            }),
            catchError((refreshErr) => {
              return throwError(() => refreshErr);
            }),
          );
        }
      }

      return throwError(() => error);
    }),
  );
};


