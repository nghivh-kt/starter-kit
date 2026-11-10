import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserResponse } from '@core/api';
import { apiErrorInterceptor } from '@core/errors/api-error.interceptor';
import { ToastService } from '@core/services/toast.service';
import { UserResetPasswordComponent } from './user-reset-password.component';

const USER: UserResponse = {
  id: 5,
  userName: 'nguyenvana',
  fullName: 'Nguyễn Văn A',
  email: 'a@example.com',
  role: 'User',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  rowVersion: 'AAAAAAAAB9E=',
};

describe('UserResetPasswordComponent', () => {
  let fixture: ComponentFixture<UserResetPasswordComponent>;
  let mock: HttpTestingController;
  let savedCount: number;

  const URL = '/api/users/5/reset-password';
  const element = () => fixture.nativeElement as HTMLElement;
  const submit = () => element().querySelector('form')!.dispatchEvent(new Event('submit'));

  function typePassword(value: string) {
    const input = element().querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()],
    });
    mock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserResetPasswordComponent);
    fixture.componentRef.setInput('user', USER);
    savedCount = 0;
    fixture.componentInstance.saved.subscribe(() => savedCount++);
    await fixture.whenStable();
  });

  afterEach(() => mock.verify());

  it('cho biết đang đặt lại mật khẩu của ai', () => {
    expect(element().textContent).toContain('nguyenvana');
  });

  it('mật khẩu quá ngắn thì không gọi API', async () => {
    typePassword('ngan');
    submit();
    await fixture.whenStable();

    mock.expectNone(URL);
    expect(element().textContent).toContain('ít nhất 8 ký tự');
    expect(savedCount).toBe(0);
  });

  it('thành công thì gửi đúng API, báo thành công và đóng lại', () => {
    typePassword('Mat-khau-moi');
    submit();

    const request = mock.expectOne(URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ newPassword: 'Mat-khau-moi' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(savedCount).toBe(1);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Đã đặt lại mật khẩu');
  });

  it('lỗi từ API thì giữ form để nhập lại', async () => {
    typePassword('Mat-khau-moi');
    submit();

    mock
      .expectOne(URL)
      .flush(
        { detail: 'Không hợp lệ', errors: { newPassword: ['Mật khẩu quá yếu'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(element().textContent).toContain('Mật khẩu quá yếu');
    expect(savedCount).toBe(0);
  });
});
