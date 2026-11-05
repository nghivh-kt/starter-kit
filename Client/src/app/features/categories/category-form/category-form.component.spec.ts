import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryResponse } from '@core/api';
import { apiErrorInterceptor } from '@core/errors/api-error.interceptor';
import { ToastService } from '@core/services/toast.service';
import { CategoryFormComponent } from './category-form.component';

const CATEGORY: CategoryResponse = {
  id: 7,
  name: 'Sách',
  description: null,
  isActive: false,
  createdAt: '2026-01-01T00:00:00Z',
  rowVersion: 'AAAAAAAAB9E=',
};

describe('CategoryFormComponent', () => {
  let fixture: ComponentFixture<CategoryFormComponent>;
  let mock: HttpTestingController;
  let saved: number;

  async function setup(category: CategoryResponse | null) {
    fixture = TestBed.createComponent(CategoryFormComponent);
    fixture.componentRef.setInput('category', category);
    saved = 0;
    fixture.componentInstance.saved.subscribe(() => saved++);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const nameInput = () => element().querySelector('input[type="text"]') as HTMLInputElement;
  const submit = () => element().querySelector('form')!.dispatchEvent(new Event('submit'));

  function typeName(value: string) {
    nameInput().value = value;
    nameInput().dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()],
    });
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('thiếu tên thì hiện lỗi và không gọi API', async () => {
    await setup(null);
    submit();
    await fixture.whenStable();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain('Tên danh mục là bắt buộc');
  });

  it('tạo mới gửi POST, description trống thành null', async () => {
    await setup(null);
    typeName('Sách');
    submit();

    const request = mock.expectOne('/api/categories');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Sách', description: null, isActive: true });

    request.flush(CATEGORY);
    expect(saved).toBe(1);
  });

  it('cập nhật gửi kèm rowVersion và giữ nguyên trạng thái', async () => {
    await setup(CATEGORY);
    typeName('Tên mới');
    submit();

    const request = mock.expectOne('/api/categories/7');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      name: 'Tên mới',
      description: null,
      isActive: false,
      rowVersion: CATEGORY.rowVersion,
    });
    request.flush(CATEGORY);
  });

  it('lỗi theo field từ API hiện đúng ô, không toast, form vẫn mở', async () => {
    await setup(null);
    typeName('Sách');
    submit();

    mock
      .expectOne('/api/categories')
      .flush(
        { code: 'VALIDATION_ERROR', errors: { name: ['Tên danh mục không hợp lệ.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain('Tên danh mục không hợp lệ.');
    expect(TestBed.inject(ToastService).toasts()).toHaveLength(0);
    expect(saved).toBe(0);
  });

  it('bản ghi đã bị người khác sửa: báo lỗi và đóng form để tải dữ liệu mới', async () => {
    await setup(CATEGORY);
    typeName('Tên mới');
    submit();

    mock
      .expectOne('/api/categories/7')
      .flush(
        { code: 'CONFLICT', detail: 'Danh mục đã được người khác cập nhật.' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(TestBed.inject(ToastService).toasts()[0].message).toContain('người khác cập nhật');
    expect(saved).toBe(1);
  });

  it('lỗi nghiệp vụ khi tạo mới: báo lỗi và giữ form để sửa', async () => {
    await setup(null);
    typeName('Sách');
    submit();

    mock
      .expectOne('/api/categories')
      .flush(
        { code: 'BUSINESS_ERROR', detail: "Danh mục 'Sách' đã tồn tại." },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(TestBed.inject(ToastService).toasts()[0].message).toContain('đã tồn tại');
    expect(saved).toBe(0);
  });
});
