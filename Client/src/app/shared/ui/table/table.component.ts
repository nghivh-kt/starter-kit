import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, model, output } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideChevronLeft,
  LucideChevronRight,
  LucideChevronsLeft,
  LucideChevronsRight,
  LucideChevronsUpDown,
  LucideDownload,
  LucideSearch,
} from '@lucide/angular';
import { ButtonComponent } from '../button/button.component';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { PAGE_SIZE_OPTIONS, pageWindow } from './list-query';
import { PageEvent, TableColumn } from './table.types';

@Component({
  selector: 'app-table',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    NgClass,
    NgTemplateOutlet,
    FormsModule,
    CheckboxComponent,
    ButtonComponent,
    LucideArrowDown,
    LucideArrowUp,
    LucideChevronLeft,
    LucideChevronRight,
    LucideChevronsLeft,
    LucideChevronsRight,
    LucideChevronsUpDown,
    LucideDownload,
    LucideSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table.component.html',
})
export class TableComponent<T = unknown> {
  protected readonly Math = Math;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly pagerButton =
    'flex size-8 items-center justify-center rounded-full bg-hover text-[13px] font-medium text-ink transition-colors hover:bg-line ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ' +
    'disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-hover';

  // --- DỮ LIỆU ---
  readonly data = input<T[]>([]);
  readonly columns = input.required<TableColumn<T>[]>();
  /** Hai chiều: [(selection)]="selectedRows" */
  readonly selection = model<T[]>([]);

  // --- CẤU HÌNH ---
  readonly loading = input(false);
  readonly selectable = input(false);
  readonly searchable = input(false);
  readonly searchPlaceholder = input('Tìm kiếm...');
  /** Giá trị ban đầu của ô tìm kiếm, ví dụ lấy từ URL */
  readonly searchValue = input('');
  readonly scrollHeight = input('');
  /** Hiện nút "Xuất Excel". Component cha gọi API khi nhận exportClick. */
  readonly exportable = input(false);
  readonly exporting = input(false);
  /** Trả về class CSS cho từng dòng */
  readonly rowClassFn = input<(item: T) => string>();

  // --- PHÂN TRANG VÀ SẮP XẾP ---
  readonly pagination = input(false);
  /** true: component cha phân trang và sắp xếp qua API. false: bảng tự làm trên dữ liệu đang có. */
  readonly serverSide = input(false);
  readonly totalRecords = input(0);
  readonly page = input(1);
  readonly pageSize = input(10);
  readonly pageSizeOptions = input(PAGE_SIZE_OPTIONS);
  readonly sortKey = model('');
  readonly sortDir = model<'asc' | 'desc'>('asc');

  // --- SỰ KIỆN ---
  readonly sortChange = output<{ key: string; direction: 'asc' | 'desc' }>();
  readonly pageChange = output<PageEvent>();
  readonly pageSizeChange = output<number>();
  readonly searchChange = output<string>();
  readonly exportClick = output<void>();

  protected readonly selectedSet = computed(() => new Set(this.selection()));
  protected readonly selectedCount = computed(() => this.selection().length);

  private readonly sortedData = computed(() => {
    const rows = this.data();
    const key = this.sortKey();
    const direction = this.sortDir() === 'asc' ? 1 : -1;

    if (this.serverSide() || !key) return rows;

    return [...rows].sort((a, b) => {
      const left = this.getCellValue(a, key);
      const right = this.getCellValue(b, key);

      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      if (left < right) return -direction;
      if (left > right) return direction;
      return 0;
    });
  });

  // Giữ tổng số cũ trong lúc tải trang mới, để thanh phân trang không nhảy về trống rồi hiện lại
  private readonly knownTotal = linkedSignal<{ total: number; loading: boolean }, number>({
    source: () => ({ total: this.totalRecords(), loading: this.loading() }),
    computation: ({ total, loading }, previous) => (loading && previous ? previous.value : total),
  });

  protected readonly effectiveTotalRecords = computed(() =>
    this.serverSide() ? this.knownTotal() : this.data().length,
  );

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.effectiveTotalRecords() / this.pageSize())),
  );
  protected readonly visiblePages = computed(() => pageWindow(this.page(), this.totalPages()));

  protected readonly paginatedData = computed(() => {
    if (this.serverSide()) return this.data();

    const start = (this.page() - 1) * this.pageSize();
    return this.sortedData().slice(start, start + this.pageSize());
  });

  protected readonly rangeStart = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.effectiveTotalRecords()));

  protected readonly totalCols = computed(() => this.columns().length + (this.selectable() ? 1 : 0));

  protected readonly isAllSelected = computed(() => {
    const rows = this.paginatedData();
    const selected = this.selectedSet();
    return rows.length > 0 && rows.every((item) => selected.has(item));
  });

  protected readonly isIndeterminate = computed(() => {
    const rows = this.paginatedData();
    const selected = this.selectedSet();
    const count = rows.filter((item) => selected.has(item)).length;
    return count > 0 && count < rows.length;
  });

  protected trackByFn(index: number, item: T): unknown {
    return (item as { id?: unknown }).id ?? index;
  }

  // Trả về any có chủ ý: giá trị đi vào các pipe date, currency, number trong template, kiểu tuỳ theo từng cột
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getCellValue(item: T, key: keyof T | string): any {
    return String(key)
      .split('.')
      .reduce<unknown>((value, part) => (value as Record<string, unknown> | null | undefined)?.[part], item);
  }

  protected toggleSelection(item: T): void {
    this.selection.update((current) =>
      current.includes(item) ? current.filter((selected) => selected !== item) : [...current, item],
    );
  }

  protected toggleSelectAll(): void {
    const rows = this.paginatedData();
    const selectAll = !this.isAllSelected();

    this.selection.update((current) => {
      const selected = new Set(current);
      rows.forEach((item) => (selectAll ? selected.add(item) : selected.delete(item)));
      return Array.from(selected);
    });
  }

  protected isSelected(item: T): boolean {
    return this.selectedSet().has(item);
  }

  protected changePage(page: number): void {
    this.pageChange.emit({ page, pageSize: this.pageSize() });
  }

  protected onPageSizeChange(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }

  protected handleSort(column: TableColumn<T>): void {
    if (!column.sortable) return;

    const key = String(column.key);
    const direction = this.sortKey() === key && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortKey.set(key);
    this.sortDir.set(direction);
    this.sortChange.emit({ key, direction });
  }

  protected ariaSort(column: TableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable) return null;
    if (this.sortKey() !== column.key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  protected onSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }
}
