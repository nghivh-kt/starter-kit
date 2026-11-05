import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from '@core/services/toast.service';
import { ApiError } from './api-error';

/** Bắt lỗi không được xử lý ở đâu khác. Không báo trùng lỗi HTTP mà interceptor đã hiện toast. */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private toastService = inject(ToastService);

  handleError(error: unknown): void {
    // Lỗi trong code phía client: ghi chi tiết ra console để sửa, người dùng chỉ thấy thông báo chung
    if (!(error instanceof ApiError)) console.error('Lỗi phía client:', error);

    this.toastService.fromError(error);
  }
}
