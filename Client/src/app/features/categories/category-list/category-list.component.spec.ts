import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CategoryResponse } from '@core/api';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorInterceptor } from '@core/errors/api-error.interceptor';
import { ToastService } from '@core/services/toast.service';
import { CategoryListComponent } from './category-list.component';

const CATEGORY: CategoryResponse = {
  id: 7,
  name: 'Sách',
  description: null, // API cho phép null: bảng không được lỗi với giá trị này
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  rowVersion: 'AAAAAAAAB9E=',
};

const page = (items: CategoryResponse[]) => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
});

describe('CategoryListComponent', () => {
  let fixture: ComponentFixture<CategoryListComponent>;
  let mock: HttpTestingController;
  let isAdmin: boolean;

  function setup(admin: boolean, inputs: Record<string, string> = {}) {
    isAdmin = admin;
    fixture = TestBed.createComponent(CategoryListComponent);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    TestBed.tick();
  }

  const listRequest = (): TestRequest => mock.expectOne((request) => request.url === '/api/categories');
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const button = (label: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { hasRole: () => isAdmin } },
      ],
    });
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('gửi trang, tìm kiếm và sắp xếp từ URL lên API', () => {
    setup(true, { page: '3', search: 'sách', sortBy: 'name', desc: 'true' });

    const { params } = listRequest().request;
    expect(params.get('page')).toBe('3');
    expect(params.get('pageSize')).toBe('20');
    expect(params.get('search')).toBe('sách');
    expect(params.get('sortBy')).toBe('name');
    expect(params.get('desc')).toBe('true');
  });

  it('giá trị page sai trên URL không gây lỗi API', () => {
    setup(true, { page: 'abc' });

    expect(listRequest().request.params.get('page')).toBe('1');
  });

  it('đổi từ khoá thì huỷ request cũ', () => {
    setup(true);
    const first = listRequest();

    fixture.componentRef.setInput('search', 'mới');
    TestBed.tick();

    expect(first.cancelled).toBe(true);
    expect(listRequest().request.params.get('search')).toBe('mới');
  });

  it('hiển thị dữ liệu trả về từ API, kể cả description null', async () => {
    setup(true);
    listRequest().flush(page([CATEGORY]));
    await fixture.whenStable();

    expect(text()).toContain('Sách');
    expect(text()).toContain('Hoạt động');
  });

  it('Admin thấy các thao tác ghi', async () => {
    setup(true);
    listRequest().flush(page([CATEGORY]));
    await fixture.whenStable();

    expect(button('Thêm mới')).toBeTruthy();
    expect(button('Sửa')).toBeTruthy();
    expect(button('Xoá')).toBeTruthy();
  });

  it('User thường chỉ xem, không thấy thao tác ghi', async () => {
    setup(false);
    listRequest().flush(page([CATEGORY]));
    await fixture.whenStable();

    expect(text()).toContain('Sách');
    expect(button('Thêm mới')).toBeUndefined();
    expect(button('Sửa')).toBeUndefined();
    expect(button('Xoá')).toBeUndefined();
  });

  it('xoá phải xác nhận, rồi gọi API và tải lại', async () => {
    setup(true);
    listRequest().flush(page([CATEGORY]));
    await fixture.whenStable();

    button('Xoá')!.click();
    await fixture.whenStable();
    mock.expectNone('/api/categories/7');
    expect(text()).toContain('Bạn có chắc muốn xoá');

    const confirm = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="dialog"] button')).find(
      (b) => b.textContent?.includes('Xoá'),
    ) as HTMLButtonElement;
    confirm.click();

    const request = mock.expectOne('/api/categories/7');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    TestBed.tick();

    listRequest().flush(page([]));
    await fixture.whenStable();
    expect(text()).not.toContain('Bạn có chắc muốn xoá');
  });

  it('API lỗi thì báo một lần và không làm hỏng trang', async () => {
    setup(true);
    listRequest().flush({ detail: 'Lỗi hệ thống' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(TestBed.inject(ToastService).toasts()).toHaveLength(1);
    expect(text()).toContain('Quản lý danh mục');
  });

  it('điều hướng ghi trang lên URL', () => {
    setup(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    (fixture.componentInstance as unknown as { navigation: { goToPage(page: number): void } }).navigation.goToPage(2);

    expect(navigate.mock.calls[0][1]?.queryParams).toEqual({ page: 2 });
    listRequest().flush(page([]));
  });
});
