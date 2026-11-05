import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from './auth.service';

/** Chưa đăng nhập thì về trang đăng nhập, kèm returnUrl để quay lại đúng trang sau khi đăng nhập. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() || router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};

/** Đã đăng nhập thì không vào trang đăng nhập nữa. */
export const publicGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return !auth.isAuthenticated() || router.createUrlTree(['/']);
};

/**
 * Giới hạn route theo vai trò khai báo trong data: { canActivate: [roleGuard], data: { roles: ['Admin'] } }.
 * Đây chỉ là trải nghiệm giao diện: quyền thật do API kiểm tra.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const roles: string[] = route.data['roles'] ?? [];
  if (roles.some((role) => auth.hasRole(role))) return true;

  // Không về trang đăng nhập: người dùng đã đăng nhập, chỉ là không đủ quyền
  toast.error('Bạn không có quyền truy cập trang này.');
  return router.createUrlTree(['/']);
};
