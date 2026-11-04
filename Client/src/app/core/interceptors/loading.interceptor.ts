import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoadingService } from '@core/services/loading.service';
import { finalize } from 'rxjs';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Bỏ qua loading cho các request chạy ngầm (nếu cần)
  // if (req.headers.has('X-Skip-Loading')) return next(req);

  loadingService.show();

  return next(req).pipe(
    finalize(() => loadingService.hide())
  );
};