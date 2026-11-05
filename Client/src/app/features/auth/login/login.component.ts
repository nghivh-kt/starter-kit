import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { ApiError } from '@core/errors/api-error';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { InputComponent } from '@shared/ui/input/input.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    userName: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isLoading.set(true);

    const { userName, password } = this.form.getRawValue();
    this.auth
      .login(userName, password)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl(this.returnUrl()),
        // 403, 429 và lỗi hệ thống đã có toast từ interceptor; sai mật khẩu thì hiện ngay trong form
        error: (error: unknown) => {
          if (error instanceof ApiError && !error.notified) this.errorMessage.set(error.message);
        },
      });
  }

  /** Chỉ chấp nhận đường dẫn nội bộ: returnUrl nằm trên URL nên ai cũng có thể sửa. */
  private returnUrl(): string {
    const url: string = this.route.snapshot.queryParams['returnUrl'] ?? '/';
    return url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }
}
