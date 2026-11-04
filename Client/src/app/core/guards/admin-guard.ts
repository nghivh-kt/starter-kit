import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('Begin Admin guard');

  if(authService.hasRole('Admin')){
    console.log('Đủ quyền Admin -> Cho qua');
    return true;
  }

  // Lưu ý: KHÔNG đá về '/auth/login' như authGuard — vì đây là lỗi "đã đăng nhập
  // nhưng không đủ quyền" (403), khác bản chất với "chưa đăng nhập" (401).
  // Đá về Login sẽ khiến user tưởng nhầm mình bị logout.
  console.log('Không đủ quyền Admin -> Đá về Dashboard');
  router.navigate(['/']);

  return false;
};
