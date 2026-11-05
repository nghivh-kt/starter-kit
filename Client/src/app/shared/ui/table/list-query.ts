import { inject, numberAttribute } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

export const DEFAULT_PAGE_SIZE = 20;
/** Các lựa chọn số dòng mỗi trang. Không vượt giới hạn PageSize 200 của PagedListQueryBase bên API. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
// Khớp với giới hạn của PagedListQueryBase bên API
const MAX_PAGE = 1_000_000;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Trạng thái danh sách (trang, tìm kiếm, sắp xếp) nằm trên URL: F5 hoặc gửi link vẫn giữ nguyên.
 * Component khai báo input theo tên query param, router tự truyền giá trị vào (withComponentInputBinding):
 *   readonly page = input(1, { transform: pageAttribute });
 *   readonly search = input('', { transform: textAttribute });
 */
export function pageAttribute(value: unknown): number {
  const page = Math.floor(numberAttribute(value, 1));
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

/** Giá trị ngoài danh sách cho phép (do sửa tay URL) thì về mặc định, không gửi lên API. */
export function pageSizeAttribute(value: unknown): number {
  const pageSize = numberAttribute(value, DEFAULT_PAGE_SIZE);
  return PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE;
}

/** Các số trang hiển thị: tối đa 3 số, trang hiện tại ở giữa khi có thể, sát biên thì dồn lại. */
export function pageWindow(page: number, totalPages: number, size = 3): number[] {
  const count = Math.min(size, totalPages);
  const current = Math.min(page, totalPages);
  const first = Math.max(1, Math.min(current - Math.floor(size / 2), totalPages - count + 1));
  return Array.from({ length: count }, (_, index) => first + index);
}

/** Router truyền undefined khi query param không có trên URL. */
export function textAttribute(value: string | undefined): string {
  return value ?? '';
}

export interface ListNavigation {
  goToPage(page: number): void;
  changePageSize(pageSize: number): void;
  sort(sort: { key: string; direction: 'asc' | 'desc' }): void;
  search(term: string): void;
}

/** Ghi thay đổi lên URL. Gọi trong lúc khởi tạo component. */
export function injectListNavigation(): ListNavigation {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  const searchTerm = new Subject<string>();

  const update = (queryParams: Params, replaceUrl = false) =>
    router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl });

  // Mỗi phím gõ không nên thành một request và một mục trong lịch sử trình duyệt
  searchTerm
    .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
    .subscribe((term) => update({ search: term.trim() || null, page: null }, true));

  return {
    goToPage: (page) => update({ page: page > 1 ? page : null }),
    // Về trang 1: trang đang xem có thể không còn tồn tại với số dòng mới
    changePageSize: (pageSize) => update({ pageSize: pageSize === DEFAULT_PAGE_SIZE ? null : pageSize, page: null }),
    sort: ({ key, direction }) => update({ sortBy: key, desc: direction === 'desc' ? true : null, page: null }),
    search: (term) => searchTerm.next(term),
  };
}
