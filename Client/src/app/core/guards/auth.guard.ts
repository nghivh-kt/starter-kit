import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);  

  // 1. Kiểm tra xem đã đăng nhập chưa
  if(authService.isLoggedIn()){
    return true; // Cho phép đi tiếp
  }
  
  // 2. Nếu chưa đăng nhập -> Đá về trang Login
  // Kèm theo params 'returnUrl' để sau khi login xong thì redirect lại đúng trang này
  router.navigate(['auth/login'], {
    queryParams: { returnUrl: state.url}
  });

  return false;
};
