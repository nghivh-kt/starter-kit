import { Injectable, signal } from '@angular/core';
import { ApiError } from '@core/errors/api-error';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  toasts = signal<Toast[]>([]);
  private counter = 0;

  success(message: string) {
    this.add(message, 'success');
  }
  error(message: string) {
    this.add(message, 'error');
  }
  info(message: string) {
    this.add(message, 'info');
  }
  warning(message: string) {
    this.add(message, 'warning');
  }

  /** Dùng trong nhánh error của subscribe. Bỏ qua lỗi đã được báo, và 401 vì AuthService đã xử lý phiên hết hạn. */
  fromError(error: unknown) {
    if (error instanceof ApiError) {
      if (!error.notified && error.status !== 401) this.error(error.message);
      return;
    }
    this.error('Đã xảy ra lỗi ứng dụng. Vui lòng thử lại sau.');
  }

  private add(message: string, type: ToastType) {
    const id = this.counter++;
    this.toasts.update((current) => [...current, { id, message, type }]);

    // Tự động tắt sau 3 giây
    setTimeout(() => this.remove(id), 3000);
  }

  remove(id: number) {
    this.toasts.update((current) => current.filter((t) => t.id !== id));
  }
}
