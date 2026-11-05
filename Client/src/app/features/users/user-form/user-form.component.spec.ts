import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserResponse } from '@core/api';
import { apiErrorInterceptor } from '@core/errors/api-error.interceptor';
import { UserFormComponent } from './user-form.component';

const LOCKED_USER: UserResponse = {
  id: 5,
  userName: 'nguyenvana',
  fullName: 'Nguyễn Văn A',
  email: 'a@example.com',
  role: 'User',
  isActive: false,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('UserFormComponent', () => {
  let fixture: ComponentFixture<UserFormComponent>;
  let mock: HttpTestingController;

  async function setup(user: UserResponse | null) {
    fixture = TestBed.createComponent(UserFormComponent);
    fixture.componentRef.setInput('user', user);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const inputs = () => Array.from(element().querySelectorAll('input'));
  const submit = () => element().querySelector('form')!.dispatchEvent(new Event('submit'));

  function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()],
    });
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('sửa tài khoản đang khoá không tự mở khoá, không gửi mật khẩu', async () => {
    await setup(LOCKED_USER);
    submit();

    const request = mock.expectOne('/api/users/5');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ fullName: 'Nguyễn Văn A', role: 'User', isActive: false });
    request.flush(LOCKED_USER);
  });

  it('khi sửa không có ô mật khẩu, tên đăng nhập và email bị khoá', async () => {
    await setup(LOCKED_USER);

    expect(element().querySelector('input[type="password"]')).toBeNull();
    expect((inputs()[0] as HTMLInputElement).disabled).toBe(true);
    expect((element().querySelector('input[type="email"]') as HTMLInputElement).disabled).toBe(true);
  });

  it('tạo mới gửi đủ email và mật khẩu', async () => {
    await setup(null);
    const [userName, fullName, email, password] = inputs();
    type(userName, 'nguyenvanb');
    type(fullName, 'Nguyễn Văn B');
    type(email, 'b@example.com');
    type(password, 'Mat-khau-1');
    submit();

    const request = mock.expectOne('/api/users');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      userName: 'nguyenvanb',
      fullName: 'Nguyễn Văn B',
      email: 'b@example.com',
      password: 'Mat-khau-1',
      role: 'User',
    });
    request.flush({ ...LOCKED_USER, isActive: true });
  });

  it.each([
    ['ngắn hơn 8 ký tự', 'Ab-1234', 'ít nhất 8'],
    ['dài hơn 72 byte do chữ có dấu', 'ệ'.repeat(30), '72 byte'],
  ])('từ chối mật khẩu %s, không gọi API', async (_case, value, message) => {
    await setup(null);
    const [userName, fullName, email, password] = inputs();
    type(userName, 'nguyenvanb');
    type(fullName, 'Nguyễn Văn B');
    type(email, 'b@example.com');
    type(password, value);
    submit();
    await fixture.whenStable();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(message);
  });
});
