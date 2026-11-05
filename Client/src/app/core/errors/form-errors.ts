import { AbstractControl } from '@angular/forms';
import { ApiError } from './api-error';

/**
 * Gán lỗi theo field từ API (400 + errors) vào đúng ô của form. Các control trong shared/ui hiển thị lỗi "server".
 * Lỗi tự mất khi người dùng sửa giá trị của ô đó.
 * Trả về true nếu đã gán được ít nhất một lỗi; false thì nơi gọi nên hiện thông báo chung.
 */
export function applyApiErrors(form: AbstractControl, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;

  let applied = false;
  for (const [field, messages] of Object.entries(error.errors)) {
    const control = form.get(field);
    if (control && messages.length > 0) {
      control.setErrors({ server: messages[0] });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}
