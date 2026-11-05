import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CurrentUserResponse } from '@core/api';
import { ApiError } from '@core/errors/api-error';
import { apiErrorInterceptor } from '@core/errors/api-error.interceptor';
import { ToastService } from '@core/services/toast.service';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const USER: CurrentUserResponse = { userId: 1, userName: 'admin', fullName: 'Quản trị', roles: ['Admin'] };

const tokens = (accessToken: string) => ({
  accessToken,
  accessTokenExpiresAt: '2026-01-01T00:00:00Z',
  refreshTokenExpiresAt: '2026-01-08T00:00:00Z',
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve));

describe('Xác thực phía client', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let auth: AuthService;
  let toast: ToastService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([apiErrorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    toast = TestBed.inject(ToastService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => mock.verify());

  function login(accessToken = 'token-cu') {
    auth.login('admin', 'mat-khau').subscribe();
    mock.expectOne('/api/auth/login').flush(tokens(accessToken));
    mock.expectOne('/api/auth/me').flush(USER);
  }

  const unauthorized = { status: 401, statusText: 'Unauthorized' };

  describe('gắn token', () => {
    it('gắn token cho request tới API', () => {
      login();
      http.get('/api/categories').subscribe();
      const request = mock.expectOne('/api/categories');
      expect(request.request.headers.get('Authorization')).toBe('Bearer token-cu');
      request.flush({});
    });

    it('không gắn token cho domain khác', () => {
      login();
      http.get('https://example.com/api/data').subscribe();
      const request = mock.expectOne('https://example.com/api/data');
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    });
  });

  describe('gặp 401', () => {
    it('refresh rồi gửi lại request với token mới', async () => {
      login();
      let result: unknown;
      http.get('/api/categories').subscribe((value) => (result = value));

      mock.expectOne('/api/categories').flush({}, unauthorized);
      mock.expectOne('/api/auth/refresh').flush(tokens('token-moi'));
      await flushPromises();

      const retried = mock.expectOne('/api/categories');
      expect(retried.request.headers.get('Authorization')).toBe('Bearer token-moi');
      retried.flush({ ok: true });
      expect(result).toEqual({ ok: true });
    });

    it('nhiều request cùng lúc chỉ refresh một lần', async () => {
      login();
      const results: unknown[] = [];
      http.get('/api/a').subscribe((value) => results.push(value));
      http.get('/api/b').subscribe((value) => results.push(value));

      mock.expectOne('/api/a').flush({}, unauthorized);
      mock.expectOne('/api/b').flush({}, unauthorized);

      mock.expectOne('/api/auth/refresh').flush(tokens('token-moi'));
      await flushPromises();

      mock.expectOne('/api/a').flush('a');
      mock.expectOne('/api/b').flush('b');
      expect(results).toEqual(['a', 'b']);
    });

    it('refresh lỗi thì mọi request nhận lỗi, không treo, và về trang đăng nhập', async () => {
      login();
      const errors: unknown[] = [];
      http.get('/api/a').subscribe({ error: (error) => errors.push(error) });
      http.get('/api/b').subscribe({ error: (error) => errors.push(error) });

      mock.expectOne('/api/a').flush({}, unauthorized);
      mock.expectOne('/api/b').flush({}, unauthorized);
      mock.expectOne('/api/auth/refresh').flush({}, unauthorized);
      await flushPromises();

      expect(errors).toHaveLength(2);
      expect(errors.every((error) => error instanceof ApiError && error.status === 401)).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.accessToken()).toBeNull();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0][0]).toEqual(['/auth/login']);
      expect(toast.toasts()).toHaveLength(1);
    });

    it('vẫn 401 sau khi đã refresh thì trả lỗi, không lặp vô hạn', async () => {
      login();
      let error: unknown;
      http.get('/api/a').subscribe({ error: (e) => (error = e) });

      mock.expectOne('/api/a').flush({}, unauthorized);
      mock.expectOne('/api/auth/refresh').flush(tokens('token-moi'));
      await flushPromises();
      mock.expectOne('/api/a').flush({}, unauthorized);

      expect((error as ApiError).status).toBe(401);
    });

    it('request về muộn sau khi đã refresh xong thì gửi lại luôn, không refresh thêm', async () => {
      login();
      http.get('/api/nhanh').subscribe();
      http.get('/api/cham').subscribe();

      mock.expectOne('/api/nhanh').flush({}, unauthorized);
      mock.expectOne('/api/auth/refresh').flush(tokens('token-moi'));
      await flushPromises();
      mock.expectOne('/api/nhanh').flush({});

      mock.expectOne('/api/cham').flush({}, unauthorized);
      const retried = mock.expectOne('/api/cham');
      expect(retried.request.headers.get('Authorization')).toBe('Bearer token-moi');
      retried.flush({});
      mock.expectNone('/api/auth/refresh');
    });

    it('sai mật khẩu khi đăng nhập không kích hoạt refresh', () => {
      let error: unknown;
      auth.login('admin', 'sai').subscribe({ error: (e) => (error = e) });

      mock
        .expectOne('/api/auth/login')
        .flush({ detail: 'Sai tên đăng nhập hoặc mật khẩu', code: 'UNAUTHORIZED' }, unauthorized);

      expect((error as ApiError).message).toBe('Sai tên đăng nhập hoặc mật khẩu');
      expect(toast.toasts()).toHaveLength(0);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('mở app', () => {
    it('có cookie hợp lệ thì khôi phục phiên', async () => {
      const done = auth.initialize();
      mock.expectOne('/api/auth/refresh').flush(tokens('token-moi'));
      await flushPromises();
      mock.expectOne('/api/auth/me').flush(USER);
      await done;

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.hasRole('Admin')).toBe(true);
      expect(auth.hasRole('User')).toBe(false);
    });

    it('không có phiên thì im lặng coi như chưa đăng nhập', async () => {
      const done = auth.initialize();
      mock.expectOne('/api/auth/refresh').flush({}, unauthorized);
      await done;

      expect(auth.isAuthenticated()).toBe(false);
      expect(toast.toasts()).toHaveLength(0);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('API lỗi cũng không chặn app khởi động và không hiện toast', async () => {
      const done = auth.initialize();
      mock.expectOne('/api/auth/refresh').flush({}, { status: 500, statusText: 'Server Error' });
      await done;

      expect(auth.isAuthenticated()).toBe(false);
      expect(toast.toasts()).toHaveLength(0);
    });
  });

  describe('đăng xuất', () => {
    it('gọi API rồi xoá phiên', () => {
      login();
      auth.logout();
      expect(auth.isAuthenticated()).toBe(true);

      mock.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.accessToken()).toBeNull();
    });

    it('API lỗi vẫn xoá phiên phía client', () => {
      login();
      auth.logout();

      mock.expectOne('/api/auth/logout').error(new ProgressEvent('error'));

      expect(auth.isAuthenticated()).toBe(false);
    });
  });
});
