import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { apiErrorInterceptor } from '@core/errors/api-error.interceptor';
import { ToastService } from '@core/services/toast.service';
import { ChangePasswordComponent } from './change-password.component';

describe('ChangePasswordComponent', () => {
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let mock: HttpTestingController;

  const URL = '/api/auth/change-password';
  const element = () => fixture.nativeElement as HTMLElement;
  const toasts = () => TestBed.inject(ToastService).toasts();

  function fill(currentPassword: string, newPassword: string) {
    const [current, next] = Array.from(element().querySelectorAll('input'));
    current.value = currentPassword;
    current.dispatchEvent(new Event('input'));
    next.value = newPassword;
    next.dispatchEvent(new Event('input'));
  }

  const submit = () => element().querySelector('form')!.dispatchEvent(new Event('submit'));

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    mock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ChangePasswordComponent);
    await fixture.whenStable();
  });

  afterEach(() => mock.verify());

  it('mật khẩu mới không đạt quy tắc thì không gọi API và báo ngay tại ô nhập', async () => {
    fill('Mat-khau-cu', 'ngan');
    submit();
    await fixture.whenStable();

    mock.expectNone(URL);
    expect(element().textContent).toContain('ít nhất 8 ký tự');
  });

  it('đổi thành công thì về trang đăng nhập vì API đã thu hồi mọi phiên', async () => {
    fill('Mat-khau-cu', 'Mat-khau-moi');
    submit();

    const request = mock.expectOne(URL);
    expect(request.request.body).toEqual({ currentPassword: 'Mat-khau-cu', newPassword: 'Mat-khau-moi' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/auth/login');
    expect(toasts()[0].message).toContain('Đã đổi mật khẩu');
  });

  it('sai mật khẩu hiện tại thì báo lỗi từ API và vẫn ở lại trang', async () => {
    fill('sai', 'Mat-khau-moi');
    submit();

    mock
      .expectOne(URL)
      .flush(
        { detail: 'Mật khẩu hiện tại không đúng.', code: 'BUSINESS_ERROR' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(toasts()[0].message).toBe('Mật khẩu hiện tại không đúng.');
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('lỗi theo field từ API hiện đúng tại ô nhập, không hiện toast', async () => {
    fill('Mat-khau-cu', 'Mat-khau-moi');
    submit();

    mock
      .expectOne(URL)
      .flush(
        { detail: 'Dữ liệu không hợp lệ', errors: { newPassword: ['Mật khẩu mới không được trùng mật khẩu cũ'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(element().textContent).toContain('Mật khẩu mới không được trùng mật khẩu cũ');
    expect(toasts()).toHaveLength(0);
  });
});
