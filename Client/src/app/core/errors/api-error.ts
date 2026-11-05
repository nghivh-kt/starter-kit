import { HttpErrorResponse } from '@angular/common/http';

const FALLBACK_MESSAGES: Record<number, string> = {
  0: 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu.',
  409: 'Dữ liệu đã bị thay đổi hoặc bị trùng. Vui lòng tải lại rồi thử lại.',
  429: 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.',
};
const FALLBACK_MESSAGE = 'Đã xảy ra lỗi trong hệ thống. Vui lòng thử lại sau.';

/**
 * Lỗi từ API theo khuôn Problem Details (xem "Định dạng lỗi" trong README).
 * message là thông báo hiển thị cho người dùng. Phân nhánh theo code, không so chuỗi message.
 */
export class ApiError extends Error {
  /** true: đã hiện toast ở interceptor, component không cần báo lại. */
  notified = false;

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Lỗi theo từng field, key dạng camelCase. Dùng applyApiErrors để gán vào form. */
    readonly errors: Record<string, string[]> = {},
    readonly traceId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromResponse(response: HttpErrorResponse): ApiError {
    const body: Partial<{ detail: string; code: string; errors: Record<string, string[]>; traceId: string }> =
      response.error && typeof response.error === 'object' ? response.error : {};

    return new ApiError(
      response.status,
      body.code ?? (response.status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR'),
      body.detail ?? firstFieldError(body.errors) ?? FALLBACK_MESSAGES[response.status] ?? FALLBACK_MESSAGE,
      body.errors ?? {},
      body.traceId ?? null,
    );
  }
}

function firstFieldError(errors: Record<string, string[]> | undefined): string | undefined {
  return errors ? Object.values(errors).flat()[0] : undefined;
}
