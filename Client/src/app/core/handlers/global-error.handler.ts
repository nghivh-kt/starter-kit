import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '@core/services/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  // Inject Toast để hiển thị lỗi
  private toastService = inject(ToastService);
  
  // Inject NgZone: Quan trọng! Vì ErrorHandler chạy ngoài vùng kiểm soát của Angular Zone
  // nên cần Zone để ép UI cập nhật (hiện Toast)
  private zone = inject(NgZone);

  handleError(error: any): void {
    // 1. Phân loại lỗi
    let message = '';
    let stackTrace = '';

    if (error instanceof HttpErrorResponse) {
      // --- TRƯỜNG HỢP 1: Lỗi từ API (Backend) ---
      
      // Bỏ qua lỗi 401 (Unauthorized) vì AuthInterceptor đã xử lý redirect
      if (error.status === 401) return;

      // Ưu tiên lấy message từ Backend trả về
      // (Giả sử Backend trả về: { message: "Tên đăng nhập trùng" })
      message = error.error?.message || error.message || 'Lỗi Server không xác định';
      
    } else {
      // --- TRƯỜNG HỢP 2: Lỗi Client (Code JS/TS bị sai) ---
      // Ví dụ: Đọc thuộc tính của null/undefined
      message = 'Đã xảy ra lỗi ứng dụng. Vui lòng thử lại sau.';
      stackTrace = error.stack || '';
      
      // Log lỗi chi tiết ra Console để Dev sửa
      console.error('🔥 CLIENT ERROR:', error);
    }

    // 2. Hiển thị Toast (Bọc trong zone.run để UI chắc chắn render)
    this.zone.run(() => {
      this.toastService.error(message);
    });
  }
}