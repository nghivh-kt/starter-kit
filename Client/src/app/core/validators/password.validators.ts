import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

const MIN_LENGTH = 8;
// bcrypt chỉ dùng 72 byte đầu. Đếm theo byte: chữ có dấu chiếm 2-3 byte. Khớp với PasswordRuleExtensions của API.
const MAX_BYTES = 72;

function maxUtf8Bytes(control: AbstractControl<string>): ValidationErrors | null {
  return new TextEncoder().encode(control.value ?? '').length > MAX_BYTES ? { passwordTooLong: true } : null;
}

/** Quy tắc mật khẩu mới. Chỉ để báo lỗi sớm: API vẫn kiểm tra lại. */
export const passwordValidators: ValidatorFn[] = [Validators.required, Validators.minLength(MIN_LENGTH), maxUtf8Bytes];
