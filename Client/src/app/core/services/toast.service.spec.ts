import { TestBed } from '@angular/core/testing';
import { MAX_TOASTS, TOAST_DURATION_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  let toast: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  const messages = () => toast.toasts().map((t) => t.message);

  it('thông báo thành công tự tắt', () => {
    toast.success('Đã lưu');
    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    expect(messages()).toEqual(['Đã lưu']);

    vi.advanceTimersByTime(1);
    expect(messages()).toEqual([]);
  });

  it('lỗi không tự tắt, chỉ mất khi người dùng đóng', () => {
    toast.error('Lỗi hệ thống (Mã tra cứu: abc)');
    vi.advanceTimersByTime(60_000);
    expect(messages()).toEqual(['Lỗi hệ thống (Mã tra cứu: abc)']);

    toast.remove(toast.toasts()[0].id);
    expect(messages()).toEqual([]);
  });

  it('cùng một lỗi đang hiện thì không chồng thêm', () => {
    toast.error('Không kết nối được máy chủ');
    toast.error('Không kết nối được máy chủ');
    toast.error('Lỗi khác');

    expect(messages()).toEqual(['Không kết nối được máy chủ', 'Lỗi khác']);
  });

  it('giữ tối đa số thông báo cho phép, bỏ cái cũ nhất', () => {
    for (let i = 1; i <= MAX_TOASTS + 2; i++) toast.error(`Lỗi ${i}`);

    expect(messages()).toHaveLength(MAX_TOASTS);
    expect(messages()[0]).toBe('Lỗi 3');
    expect(messages().at(-1)).toBe(`Lỗi ${MAX_TOASTS + 2}`);
  });
});
