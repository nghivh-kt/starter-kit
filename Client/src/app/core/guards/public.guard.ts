import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { TokenService } from '@core/services/token.service';

export const publicGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  console.log('Begin Public guard');

  // ❌ SAI: if (tokenService.getAccessToken()) 
  // -> Token hết hạn cũng bị đá về Dashboard -> Gây vòng lặp

  // ✅ ĐÚNG: Chỉ khi token CÒN HẠN mới đá về Dashboard
  if (tokenService.isAccessTokenValid()) {
    console.log('Token còn hạn -> Đá về Dashboard');
    router.navigate(['/']); 
    return false;
  }

  // Token không có hoặc đã hết hạn -> Cho phép ở lại trang Login
  console.log('Token hết hạn/không có -> Cho nhập Login');
  return true;
};
