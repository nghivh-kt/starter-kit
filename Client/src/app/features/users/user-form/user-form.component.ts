import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { UserResponse } from '@core/api';
import { Roles } from '@core/auth/roles';
import { applyApiErrors } from '@core/errors/form-errors';
import { ToastService } from '@core/services/toast.service';
import { passwordValidators } from '@core/validators/password.validators';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CheckboxComponent } from '@shared/ui/checkbox/checkbox.component';
import { InputComponent } from '@shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '@shared/ui/select/select.component';
import { UserService } from '../user.service';

const ROLE_OPTIONS: SelectOption<string>[] = [
  { value: Roles.Admin, label: 'Quản trị' },
  { value: Roles.User, label: 'Người dùng' },
];

/**
 * Tạo mới: nhập đủ thông tin kèm mật khẩu.
 * Cập nhật: chỉ sửa họ tên, vai trò và trạng thái. Đổi mật khẩu dùng màn hình riêng (UserResetPasswordComponent).
 */
@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, InputComponent, SelectComponent, CheckboxComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form.component.html',
})
export class UserFormComponent implements OnInit {
  private users = inject(UserService);
  private toast = inject(ToastService);

  /** null: tạo mới. */
  readonly user = input<UserResponse | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly roles = ROLE_OPTIONS;
  protected readonly isEdit = computed(() => this.user() !== null);
  protected readonly isSaving = signal(false);

  // Quy tắc khớp với UserValidators của API
  protected readonly form = inject(FormBuilder).nonNullable.group({
    userName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]{3,50}$/)]],
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    password: ['', passwordValidators],
    role: [Roles.User as string, Validators.required],
    isActive: [true],
  });

  ngOnInit(): void {
    const user = this.user();
    if (!user) return;

    this.form.patchValue({
      userName: user.userName,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });

    // API không cho đổi các field này khi cập nhật. Control bị disable cũng không còn bị validate.
    this.form.controls.userName.disable();
    this.form.controls.email.disable();
    this.form.controls.password.disable();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { userName, fullName, email, password, role, isActive } = this.form.getRawValue();
    const user = this.user();

    this.isSaving.set(true);
    const save = user
      ? this.users.update(user.id, { fullName, role, isActive })
      : this.users.create({ userName, fullName, email, password, role });

    save.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: () => {
        this.toast.success(user ? 'Cập nhật thành công' : 'Thêm mới thành công');
        this.saved.emit();
      },
      error: (error: unknown) => {
        if (!applyApiErrors(this.form, error)) this.toast.fromError(error);
      },
    });
  }
}
