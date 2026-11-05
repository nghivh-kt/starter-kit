import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { applyApiErrors } from '@core/errors/form-errors';
import { ToastService } from '@core/services/toast.service';
import { passwordValidators } from '@core/validators/password.validators';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { InputComponent } from '@shared/ui/input/input.component';

/** Người dùng tự đổi mật khẩu. API thu hồi mọi phiên, nên đổi xong phải đăng nhập lại. */
@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6">
      <h1 class="text-xl font-semibold text-gray-900">Đổi mật khẩu</h1>
      <p class="mt-1 text-sm text-gray-600">Sau khi đổi, bạn sẽ phải đăng nhập lại trên mọi thiết bị.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="mt-4 flex flex-col gap-3">
        <app-input label="Mật khẩu hiện tại" type="password" formControlName="currentPassword" />
        <app-input label="Mật khẩu mới" type="password" formControlName="newPassword" />

        <div class="flex justify-end">
          <app-button type="submit" [loading]="isSaving()">Đổi mật khẩu</app-button>
        </div>
      </form>
    </section>
  `,
})
export class ChangePasswordComponent {
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  protected readonly isSaving = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', passwordValidators],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.auth
      .changePassword(this.form.getRawValue())
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => this.toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại.'),
        error: (error: unknown) => {
          if (!applyApiErrors(this.form, error)) this.toast.fromError(error);
        },
      });
  }
}
