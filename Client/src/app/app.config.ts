import { ApplicationConfig, ErrorHandler, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { loadingInterceptor } from '@core/interceptors/loading.interceptor';
import { GlobalErrorHandler } from '@core/handlers/global-error.handler';
import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';

registerLocaleData(localeVi); // Đăng ký dữ liệu tiếng Việt

export const appConfig: ApplicationConfig = {
  providers: [
    // Ngôn ngữ mặc định cho DatePipe, CurrencyPipe...
    { provide: LOCALE_ID, useValue: 'vi-VN' },

    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([
        authInterceptor, // Chạy trước
        loadingInterceptor, // Chạy sau để đếm request
      ]),
    ),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
