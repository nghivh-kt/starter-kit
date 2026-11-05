import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideKeyRound } from '@lucide/angular';
import { finalize } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { applyApiErrors } from '@core/errors/form-errors';
import { ToastService } from '@core/services/toast.service';
import { passwordValidators } from '@core/validators/password.validators';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { InputComponent } from '@shared/ui/input/input.component';
import { PageHeaderComponent } from '@shared/ui/page-header/page-header.component';

/** Người dùng tự đổi mật khẩu. API thu hồi mọi phiên, nên đổi xong phải đăng nhập lại. */
@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent, PageHeaderComponent, LucideKeyRound],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Đổi mật khẩu" description="Sau khi đổi, bạn sẽ phải đăng nhập lại trên mọi thiết bị." />

    <form
      [formGroup]="form"
      (ngSubmit)="submit()"
      class="flex max-w-md flex-col gap-4 rounded-xl border border-line bg-surface p-6"
    >
      <app-input label="Mật khẩu hiện tại" type="password" formControlName="currentPassword" />
      <app-input label="Mật khẩu mới" type="password" formControlName="newPassword" />

      <div class="flex justify-end">
        <app-button type="submit" [loading]="isSaving()">
          <svg lucideKeyRound aria-hidden="true" class="size-4"></svg>
          Đổi mật khẩu
        </app-button>
      </div>
    </form>
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
