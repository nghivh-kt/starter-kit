import { HttpContext, HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { BACKGROUND_REQUEST } from '@core/http/http-context';
import { ToastService } from '@core/services/toast.service';
import { ApiError } from './api-error';
import { apiErrorInterceptor } from './api-error.interceptor';
import { applyApiErrors } from './form-errors';

describe('Lỗi từ API', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let toast: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => mock.verify());

  function request(status: number, body: object | null, context?: HttpContext): ApiError {
    let error: unknown;
    http.get('/api/x', { context }).subscribe({ error: (e) => (error = e) });
    mock.expectOne('/api/x').flush(body, { status, statusText: 'Lỗi' });
    return error as ApiError;
  }

  it('đọc detail, code, errors và traceId theo khuôn Problem Details', () => {
    const error = request(400, {
      detail: 'Dữ liệu không hợp lệ',
      code: 'VALIDATION_ERROR',
      errors: { name: ['Tên là bắt buộc.'] },
      traceId: 'abc',
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Dữ liệu không hợp lệ');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.errors).toEqual({ name: ['Tên là bắt buộc.'] });
    expect(error.traceId).toBe('abc');
  });

  describe('request tải file, body lỗi là Blob', () => {
    async function requestBlob(status: number, body: string): Promise<ApiError> {
      let error: unknown;
      http.get('/api/x', { responseType: 'blob' }).subscribe({ error: (e) => (error = e) });
      mock.expectOne('/api/x').flush(new Blob([body]), { status, statusText: 'Lỗi' });
      await vi.waitFor(() => expect(error).toBeDefined());
      return error as ApiError;
    }

    it('đọc được thông báo Problem Details bên trong Blob', async () => {
      const error = await requestBlob(400, JSON.stringify({ detail: 'Vượt giới hạn', code: 'BUSINESS_ERROR' }));

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Vượt giới hạn');
      expect(error.code).toBe('BUSINESS_ERROR');
    });

    it('Blob không phải JSON thì dùng thông báo mặc định, lỗi 5xx vẫn hiện toast', async () => {
      const error = await requestBlob(500, '<html>Bad Gateway</html>');

      expect(error.status).toBe(500);
      expect(error.notified).toBe(true);
      expect(toast.toasts()).toHaveLength(1);
    });
  });

  it('không có detail thì lấy lỗi field đầu tiên', () => {
    expect(request(400, { errors: { name: ['Tên là bắt buộc.'] } }).message).toBe('Tên là bắt buộc.');
  });

  it('response không theo khuôn thì dùng thông báo tiếng Việt theo status', () => {
    expect(request(404, null).message).toBe('Không tìm thấy dữ liệu.');
  });

  it('mất mạng có thông báo và mã riêng', () => {
    let error: unknown;
    http.get('/api/x').subscribe({ error: (e) => (error = e) });
    mock.expectOne('/api/x').error(new ProgressEvent('error'));

    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect(toast.toasts()[0].message).toContain('Không kết nối được máy chủ');
  });

  it.each([403, 429, 500])('tự hiện toast với lỗi %i và đánh dấu đã báo', (status) => {
    const error = request(status, { detail: 'Thông báo từ API' });

    expect(toast.toasts()[0].message).toContain('Thông báo từ API');
    expect(error.notified).toBe(true);
  });

  it.each([400, 404, 409])('không tự hiện toast với lỗi %i, để component quyết định', (status) => {
    const error = request(status, { detail: 'Thông báo từ API' });

    expect(toast.toasts()).toHaveLength(0);
    expect(error.notified).toBe(false);
  });

  it('lỗi 5xx kèm mã tra cứu để người dùng báo lại', () => {
    request(500, { detail: 'Lỗi hệ thống', traceId: '4bf92f3577b34da6' });

    expect(toast.toasts()[0].message).toContain('4bf92f3577b34da6');
  });

  it('request chạy ngầm không hiện toast', () => {
    request(500, { detail: 'Lỗi hệ thống' }, new HttpContext().set(BACKGROUND_REQUEST, true));

    expect(toast.toasts()).toHaveLength(0);
  });

  describe('toast.fromError', () => {
    it('không báo trùng lỗi đã được interceptor báo', () => {
      const error = request(500, { detail: 'Lỗi hệ thống' });
      toast.fromError(error);

      expect(toast.toasts()).toHaveLength(1);
    });

    it('báo lỗi mà interceptor để lại cho component', () => {
      toast.fromError(request(409, { detail: 'Bị trùng' }));

      expect(toast.toasts()[0].message).toBe('Bị trùng');
    });

    it('bỏ qua 401 vì phiên hết hạn đã được xử lý', () => {
      toast.fromError(request(401, { detail: 'Hết hạn' }));

      expect(toast.toasts()).toHaveLength(0);
    });
  });

  describe('applyApiErrors', () => {
    const form = () => new FormGroup({ name: new FormControl('abc'), description: new FormControl('') });

    it('gán lỗi vào đúng ô và hiện ngay', () => {
      const group = form();
      const applied = applyApiErrors(group, new ApiError(400, 'VALIDATION_ERROR', 'x', { name: ['Tên đã tồn tại.'] }));

      expect(applied).toBe(true);
      expect(group.controls.name.errors).toEqual({ server: 'Tên đã tồn tại.' });
      expect(group.controls.name.touched).toBe(true);
      expect(group.controls.description.errors).toBeNull();
    });

    it('lỗi tự mất khi người dùng sửa giá trị', () => {
      const group = form();
      applyApiErrors(group, new ApiError(400, 'VALIDATION_ERROR', 'x', { name: ['Tên đã tồn tại.'] }));
      group.controls.name.setValue('khác');

      expect(group.controls.name.errors).toBeNull();
    });

    it('không có ô tương ứng thì báo cho nơi gọi hiện thông báo chung', () => {
      expect(applyApiErrors(form(), new ApiError(400, 'X', 'x', { other: ['Lỗi'] }))).toBe(false);
      expect(applyApiErrors(form(), new Error('khác'))).toBe(false);
    });
  });
});
