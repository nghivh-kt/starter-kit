import { Injectable, signal } from '@angular/core';
import { ApiError } from '@core/errors/api-error';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** Thông báo không phải lỗi tự tắt sau thời gian này. */
export const TOAST_DURATION_MS = 4000;
/** Số thông báo hiện cùng lúc tối đa; thêm nữa thì bỏ cái cũ nhất. */
export const MAX_TOASTS = 5;

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
    // Cùng một lỗi lặp lại (ví dụ bấm lưu nhiều lần khi mất mạng): đã đang hiện thì không chồng thêm
    if (type === 'error' && this.toasts().some((toast) => toast.type === 'error' && toast.message === message)) return;

    const id = this.counter++;
    this.toasts.update((current) => [...current, { id, message, type }].slice(-MAX_TOASTS));

    // Lỗi không tự tắt: người dùng cần thời gian đọc và chép "Mã tra cứu" để báo lỗi. Đóng bằng nút ×.
    if (type !== 'error') setTimeout(() => this.remove(id), TOAST_DURATION_MS);
  }

  remove(id: number) {
    this.toasts.update((current) => current.filter((t) => t.id !== id));
  }
}
