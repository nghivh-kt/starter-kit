import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { finalize } from 'rxjs/operators';
import { InputComponent } from '@shared/ui/input/input.component';
import { ButtonComponent } from '@shared/ui/button/button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputComponent,
    ButtonComponent
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  // State quản lý UI
  isLoading = false;
  errorMessage: string | null = null;

  // Biến để lưu đường dẫn muốn quay lại
  returnUrl: string = ''; 

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });  

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  // Helper để check validation trong HTML cho gọn
  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  submit() {
    // 1. Nếu form invalid thì mark touched để hiện lỗi đỏ
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // 2. Reset lỗi cũ và bật loading
    this.errorMessage = null;
    this.isLoading = true;

    const { username, password } = this.form.getRawValue();

    // 3. Gọi API
    this.authService.login(username!, password!)
      .pipe(
        finalize(() => this.isLoading = false) 
      )
      .subscribe({
        next: () => {
          this.router.navigateByUrl(this.returnUrl); 
        },
        error: (err) => {
          const msg = 'Username hoặc password không đúng'; 
          this.toast.error(msg);
          this.errorMessage = msg;
        }
      });
  }
}