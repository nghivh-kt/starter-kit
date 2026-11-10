import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserResponse } from '@core/api';
import { apiErrorInterceptor } from '@core/errors/api-error.interceptor';
import { ToastService } from '@core/services/toast.service';
import { UserListComponent } from './user-list.component';

const USER: UserResponse = {
  id: 5,
  userName: 'nguyenvana',
  fullName: 'Nguyễn Văn A',
  email: 'a@example.com',
  role: 'User',
  isActive: false,
  createdAt: '2026-01-01T00:00:00Z',
  rowVersion: 'AAAAAAAAB9E=',
};

const page = (items: UserResponse[]) => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
});

describe('UserListComponent', () => {
  let fixture: ComponentFixture<UserListComponent>;
  let mock: HttpTestingController;

  const listRequest = (): TestRequest => mock.expectOne((request) => request.url === '/api/users');
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const rowMenu = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label^="Thao tác"]');
  // Menu nổi trên trang (overlay) nên nằm ngoài component, phải tìm trong document
  const menuItem = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((item) =>
      item.textContent?.includes(label),
    );

  function setup(inputs: Record<string, string> = {}) {
    fixture = TestBed.createComponent(UserListComponent);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    TestBed.tick();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('gửi trang, tìm kiếm và sắp xếp từ URL lên API', () => {
    setup({ page: '2', search: 'nguyen', sortBy: 'userName', desc: 'true' });

    const { params } = listRequest().request;
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('20');
    expect(params.get('search')).toBe('nguyen');
    expect(params.get('sortBy')).toBe('userName');
    expect(params.get('desc')).toBe('true');
  });

  it('hiển thị trạng thái khoá và không có nút xoá', async () => {
    setup();
    listRequest().flush(page([USER]));
    await fixture.whenStable();

    expect(text()).toContain('nguyenvana');
    expect(text()).toContain('Đã khoá');
    rowMenu()!.click();
    await fixture.whenStable();
    expect(menuItem('Sửa')).toBeTruthy();
    expect(menuItem('Xoá')).toBeUndefined();
  });

  it('nút đặt lại mật khẩu mở đúng modal cho người được chọn, Huỷ thì đóng lại', async () => {
    setup();
    listRequest().flush(page([USER]));
    await fixture.whenStable();

    rowMenu()!.click();
    await fixture.whenStable();
    menuItem('Đặt lại mật khẩu')!.click();
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('nguyenvana');

    Array.from(dialog!.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Huỷ'))!
      .click();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();
  });

  it('API lỗi thì báo một lần và không làm hỏng trang', async () => {
    setup();
    listRequest().flush({ detail: 'Lỗi hệ thống' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(TestBed.inject(ToastService).toasts()).toHaveLength(1);
    expect(text()).toContain('Người dùng');
  });
});
