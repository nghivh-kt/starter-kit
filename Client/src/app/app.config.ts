import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeVi from '@angular/common/locales/vi';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorInterceptor } from '@core/errors/api-error.interceptor';
import { GlobalErrorHandler } from '@core/errors/global-error.handler';
import { loadingInterceptor } from '@core/http/loading.interceptor';
import { routes } from './app.routes';

registerLocaleData(localeVi);

export const appConfig: ApplicationConfig = {
  providers: [
    // Ngôn ngữ mặc định cho DatePipe, CurrencyPipe...
    { provide: LOCALE_ID, useValue: 'vi-VN' },

    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Thứ tự có ý nghĩa, response đi ngược lại danh sách này:
    // authInterceptor phải thấy HttpErrorResponse gốc để xử lý 401 trước khi apiErrorInterceptor đổi thành ApiError
    provideHttpClient(withInterceptors([loadingInterceptor, apiErrorInterceptor, authInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Khôi phục phiên trước lần điều hướng đầu tiên, để guard biết người dùng đã đăng nhập hay chưa
    provideAppInitializer(() => inject(AuthService).initialize()),
  ],
};
