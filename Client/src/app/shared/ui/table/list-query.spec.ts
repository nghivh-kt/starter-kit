import { pageSizeAttribute, pageWindow } from './list-query';

describe('pageWindow: các số trang hiển thị', () => {
  it.each([
    { page: 1, total: 10, expected: [1, 2, 3], note: 'trang đầu' },
    { page: 2, total: 10, expected: [1, 2, 3], note: 'gần đầu' },
    { page: 5, total: 10, expected: [4, 5, 6], note: 'ở giữa, trang hiện tại nằm giữa' },
    { page: 9, total: 10, expected: [8, 9, 10], note: 'gần cuối' },
    { page: 10, total: 10, expected: [8, 9, 10], note: 'trang cuối' },
    { page: 3, total: 3, expected: [1, 2, 3], note: 'trang cuối khi có đúng 3 trang, như hình mẫu' },
    { page: 1, total: 1, expected: [1], note: 'chỉ một trang' },
    { page: 2, total: 2, expected: [1, 2], note: 'ít hơn 3 trang' },
    { page: 99, total: 5, expected: [3, 4, 5], note: 'page trên URL vượt quá số trang' },
  ])('$note: trang $page trong $total', ({ page, total, expected }) => {
    expect(pageWindow(page, total)).toEqual(expected);
  });
});

describe('pageSizeAttribute: số dòng từ URL', () => {
  it.each([
    { value: '50', expected: 50 },
    { value: '10', expected: 10 },
    { value: undefined, expected: 20 },
    { value: 'abc', expected: 20 },
    { value: '7', expected: 20 },
    { value: '100000', expected: 20 },
  ])('$value thành $expected', ({ value, expected }) => {
    expect(pageSizeAttribute(value)).toBe(expected);
  });
});
