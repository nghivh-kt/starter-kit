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

  const rowMenu = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label^="Thao tác"]');
  // Menu nổi trên trang (overlay) nên nằm ngoài component, phải tìm trong document
  const menuItem = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((item) =>
      item.textContent?.includes(label),
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

    expect(button('Thêm danh mục')).toBeTruthy();
    rowMenu()!.click();
    await fixture.whenStable();
    expect(menuItem('Sửa')).toBeTruthy();
    expect(menuItem('Xoá')).toBeTruthy();
  });

  it('User thường chỉ xem, không thấy thao tác ghi', async () => {
    setup(false);
    listRequest().flush(page([CATEGORY]));
    await fixture.whenStable();

    expect(text()).toContain('Sách');
    expect(button('Thêm danh mục')).toBeUndefined();
    expect(rowMenu()).toBeNull();
  });

  it('xoá phải xác nhận, rồi gọi API và tải lại', async () => {
    setup(true);
    listRequest().flush(page([CATEGORY]));
    await fixture.whenStable();

    rowMenu()!.click();
    await fixture.whenStable();
    menuItem('Xoá')!.click();
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
    expect(text()).toContain('Danh mục');
  });

  describe('Xuất Excel', () => {
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();
    });

    const exportRequest = () => mock.expectOne((request) => request.url === '/api/categories/export');

    async function clickExport() {
      await fixture.whenStable();
      button('Xuất Excel')!.click();
    }

    it('gửi đúng bộ lọc đang xem, không gửi trang và số dòng, rồi lưu file có tên kèm ngày', async () => {
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        expect(this.download).toMatch(/^danh-muc-\d{8}\.xlsx$/);
      });
      setup(false, { page: '3', pageSize: '50', search: 'sách', sortBy: 'name', desc: 'true' });
      listRequest().flush(page([CATEGORY]));
      await clickExport();

      const request = exportRequest();
      expect(request.request.responseType).toBe('blob');
      expect(request.request.params.keys().sort()).toEqual(['desc', 'search', 'sortBy']);
      expect(request.request.params.get('search')).toBe('sách');
      request.flush(new Blob(['xlsx']));

      expect(click).toHaveBeenCalledOnce();
      click.mockRestore();
    });

    it('API báo lỗi thì hiện đúng thông báo của API, không lưu file', async () => {
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
      setup(true);
      listRequest().flush(page([CATEGORY]));
      await clickExport();

      const problem = JSON.stringify({ detail: 'Vui lòng lọc bớt dữ liệu rồi xuất lại.', code: 'BUSINESS_ERROR' });
      exportRequest().flush(new Blob([problem], { type: 'application/problem+json' }), {
        status: 400,
        statusText: 'Bad Request',
      });
      await vi.waitFor(() => expect(TestBed.inject(ToastService).toasts()).toHaveLength(1));

      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Vui lòng lọc bớt dữ liệu rồi xuất lại.');
      expect(click).not.toHaveBeenCalled();
      click.mockRestore();
    });
  });

  it('số dòng trên URL được gửi lên API, giá trị lạ về mặc định', () => {
    setup(true, { pageSize: '50' });
    const first = listRequest();
    expect(first.request.params.get('pageSize')).toBe('50');
    first.flush(page([]));
    fixture.destroy();

    setup(true, { pageSize: '7' });
    expect(listRequest().request.params.get('pageSize')).toBe('20');
  });

  it('đổi số dòng thì ghi lên URL và về trang 1', () => {
    setup(true, { page: '3' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    (
      fixture.componentInstance as unknown as { navigation: { changePageSize(size: number): void } }
    ).navigation.changePageSize(50);

    expect(navigate.mock.calls[0][1]?.queryParams).toEqual({ pageSize: 50, page: null });
    listRequest().flush(page([]));
  });

  it('điều hướng ghi trang lên URL', () => {
    setup(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    (fixture.componentInstance as unknown as { navigation: { goToPage(page: number): void } }).navigation.goToPage(2);

    expect(navigate.mock.calls[0][1]?.queryParams).toEqual({ page: 2 });
    listRequest().flush(page([]));
  });
});
