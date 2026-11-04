import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '@core/services/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private toastService = inject(ToastService);

  handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      // 401 đã được AuthInterceptor xử lý
      if (error.status === 401) return;

      this.toastService.error(error.error?.message || error.message || 'Lỗi Server không xác định');
      return;
    }

    // Lỗi trong code phía client: ghi chi tiết ra console để lập trình viên sửa, người dùng chỉ thấy thông báo chung
    console.error('Lỗi phía client:', error);
    this.toastService.error('Đã xảy ra lỗi ứng dụng. Vui lòng thử lại sau.');
  }
}
