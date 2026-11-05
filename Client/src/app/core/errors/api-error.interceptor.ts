import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { BACKGROUND_REQUEST } from '@core/http/http-context';
import { ToastService } from '@core/services/toast.service';
import { ApiError } from './api-error';

/**
 * Đổi HttpErrorResponse thành ApiError, và tự hiện toast với các lỗi mà component không xử lý riêng được:
 * mất mạng, không có quyền, vượt giới hạn và lỗi hệ thống. Lỗi 400, 404, 409 để component quyết định.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      const apiError = ApiError.fromResponse(error);

      if (!req.context.get(BACKGROUND_REQUEST) && shouldNotify(apiError.status)) {
        // Kèm traceId với lỗi 5xx: người dùng báo mã này để tra đúng dòng log phía server
        const reference = apiError.status >= 500 && apiError.traceId ? ` (Mã tra cứu: ${apiError.traceId})` : '';
        toast.error(`${apiError.message}${reference}`);
        apiError.notified = true;
      }

      return throwError(() => apiError);
    }),
  );
};

function shouldNotify(status: number): boolean {
  return status === 0 || status === 403 || status === 429 || status >= 500;
}
