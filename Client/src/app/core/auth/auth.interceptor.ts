import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '@core/http/http-context';
import { AuthService } from './auth.service';

// 401 từ các endpoint này không có nghĩa là access token hết hạn, nên không refresh
const SESSION_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'].map((path) => `${API_BASE_URL}${path}`);

/** Gắn access token vào request tới API. Gặp 401 thì refresh rồi gửi lại đúng một lần. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Chỉ gắn token cho API của mình, không để token lộ sang domain khác
  if (!req.url.startsWith(`${API_BASE_URL}/`)) return next(req);

  const auth = inject(AuthService);
  const sentToken = auth.accessToken();

  return next(withToken(req, sentToken)).pipe(
    catchError((error: unknown) => {
      const canRefresh =
        error instanceof HttpErrorResponse && error.status === 401 && !SESSION_ENDPOINTS.includes(req.url);
      if (!canRefresh) return throwError(() => error);

      // Request đã gửi bằng token cũ nhưng token đã được làm mới trong lúc chờ: gửi lại luôn, không refresh thêm
      const currentToken = auth.accessToken();
      if (currentToken && currentToken !== sentToken) return next(withToken(req, currentToken));

      return auth.refresh().pipe(
        catchError(() => {
          auth.expireSession();
          return throwError(() => error);
        }),
        // Lần gửi lại nằm ngoài catchError này: nếu vẫn 401 thì trả lỗi, không lặp vô hạn
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};

function withToken<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}
