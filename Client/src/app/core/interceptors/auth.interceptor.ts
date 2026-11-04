import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError, EMPTY } from 'rxjs';
import { TokenService } from '@core/services/token.service';
import { AuthResponse } from '@core/models/auth.models';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';

// Biến toàn cục (trong module scope) để quản lý hàng đợi
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  // 1. INJECT SERVICES (Bắt buộc inject ở đây)
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const toast = inject(ToastService);

  // 2. Lấy AccessToken
  const accessToken = tokenService.getAccessToken();
  const isAuthUrl = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

  // 3. Clone Request & Attach Token
  let authReq = req;
  if (accessToken && !isAuthUrl) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${accessToken}` }
    });
  }

  // 4. Handle Request Flow
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.log('🔥 Interceptor Error:', error.status, error.url);
      // Nếu gặp lỗi 401 và không phải là request Login/Refresh -> Gọi logic xử lý Refresh
      if (error.status === 401 && !isAuthUrl) {
        console.log('🔄 Detecting 401, starting Refresh Flow...');
        return handle401Error(authReq, next, authService);
      }
      // Xử lý 403 Access Denied
      else if (error.status === 403) {
        // Ưu tiên lấy message từ server trả về (ở Bước 1), nếu null thì dùng text mặc định
        const message = error.error?.message || 'Bạn không có quyền thực hiện thao tác này';
        toast.error(message);

        // 2. QUAN TRỌNG: Trả về EMPTY để ngắt luồng lỗi
        // Component sẽ không nhảy vào block 'error', nhưng vẫn chạy 'finalize'
        return EMPTY;
      }

      return throwError(() => error);
    })
  );
};

// --- Helper: Xử lý 401 & Hàng đợi ---
const handle401Error = (req: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService) => {
  // CASE A: Có người đang refresh -> Xếp hàng đợi
  if (isRefreshing) {
    return refreshTokenSubject.pipe(
      filter(token => token !== null), // Chờ tín hiệu có token mới
      take(1),
      switchMap(token => {
        return next(req.clone({
          setHeaders: { Authorization: `Bearer ${token}` }
        }));
      })
    );
  }

  // CASE B: Chưa ai refresh -> Mình làm người đầu tiên
  isRefreshing = true;
  refreshTokenSubject.next(null); // Đóng cửa hàng đợi

  return authService.refreshToken().pipe(
    switchMap((res: AuthResponse) => {
      isRefreshing = false;
      refreshTokenSubject.next(res.accessToken); // Mở cửa, bắn token mới cho hàng đợi

      return next(req.clone({
        setHeaders: { Authorization: `Bearer ${res.accessToken}` }
      }));
    }),
    catchError((err) => {
      isRefreshing = false;
      refreshTokenSubject.next(null);
      return throwError(() => err); // Logout đã được xử lý bên trong authService.refreshToken
    })
  );
};