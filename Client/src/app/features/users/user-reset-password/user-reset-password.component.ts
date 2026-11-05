import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LucideKeyRound } from '@lucide/angular';
import { finalize } from 'rxjs';
import { UserResponse } from '@core/api';
import { applyApiErrors } from '@core/errors/form-errors';
import { ToastService } from '@core/services/toast.service';
import { passwordValidators } from '@core/validators/password.validators';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { InputComponent } from '@shared/ui/input/input.component';
import { UserService } from '../user.service';

/** Admin đặt lại mật khẩu cho user. API thu hồi mọi phiên của user đó. */
@Component({
  selector: 'app-user-reset-password',
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent, LucideKeyRound],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
      <p class="text-sm text-ink-muted">
        Đặt lại mật khẩu cho <strong class="font-medium text-ink">{{ user().userName }}</strong
        >. Người dùng này sẽ bị đăng xuất khỏi mọi thiết bị.
      </p>
      <app-input label="Mật khẩu mới" type="password" formControlName="newPassword" />

      <div class="flex justify-end gap-2 pt-1">
        <app-button variant="outline" (click)="cancelled.emit()">Huỷ</app-button>
        <app-button type="submit" [loading]="isSaving()">
          <svg lucideKeyRound aria-hidden="true" class="size-4"></svg>
          Đặt lại mật khẩu
        </app-button>
      </div>
    </form>
  `,
})
export class UserResetPasswordComponent {
  private users = inject(UserService);
  private toast = inject(ToastService);

  readonly user = input.required<UserResponse>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    newPassword: ['', passwordValidators],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.users
      .resetPassword(this.user().id, this.form.getRawValue().newPassword)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Đã đặt lại mật khẩu');
          this.saved.emit();
        },
        error: (error: unknown) => {
          if (!applyApiErrors(this.form, error)) this.toast.fromError(error);
        },
      });
  }
}
