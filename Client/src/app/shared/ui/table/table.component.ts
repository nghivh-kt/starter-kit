import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../button/button.component';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { PageEvent, TableColumn } from './table.types';

@Component({
  selector: 'app-table',
  imports: [CommonModule, FormsModule, CheckboxComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table.component.html',
})
export class TableComponent<T = unknown> {
  protected readonly Math = Math;

  // --- DỮ LIỆU ---
  readonly data = input<T[]>([]);
  readonly columns = input.required<TableColumn<T>[]>();
  /** Hai chiều: [(selection)]="selectedRows" */
  readonly selection = model<T[]>([]);
  readonly activeItem = model<T | null>(null);

  // --- CẤU HÌNH ---
  readonly loading = input(false);
  readonly selectable = input(false);
  readonly searchable = input(false);
  /** Giá trị ban đầu của ô tìm kiếm, ví dụ lấy từ URL */
  readonly searchValue = input('');
  readonly scrollHeight = input('');
  /** Trả về class CSS cho từng dòng */
  readonly rowClassFn = input<(item: T) => string>();

  // --- PHÂN TRANG VÀ SẮP XẾP ---
  readonly pagination = input(false);
  /** true: component cha phân trang và sắp xếp qua API. false: bảng tự làm trên dữ liệu đang có. */
  readonly serverSide = input(false);
  readonly totalRecords = input(0);
  readonly page = input(1);
  readonly pageSize = input(10);
  readonly sortKey = model('');
  readonly sortDir = model<'asc' | 'desc'>('asc');

  // --- SỰ KIỆN ---
  readonly sortChange = output<{ key: string; direction: 'asc' | 'desc' }>();
  readonly pageChange = output<PageEvent>();
  readonly rowClick = output<T>();
  readonly search = output<string>();

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

  protected readonly effectiveTotalRecords = computed(() =>
    this.serverSide() ? this.totalRecords() : this.data().length,
  );

  protected readonly paginatedData = computed(() => {
    if (this.serverSide()) return this.data();

    const start = (this.page() - 1) * this.pageSize();
    return this.sortedData().slice(start, start + this.pageSize());
  });

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

  protected handleSort(column: TableColumn<T>): void {
    if (!column.sortable) return;

    const key = String(column.key);
    const direction = this.sortKey() === key && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortKey.set(key);
    this.sortDir.set(direction);
    this.sortChange.emit({ key, direction });
  }

  protected onRowClick(item: T): void {
    this.activeItem.set(item);
    this.rowClick.emit(item);
  }

  protected onSearch(event: Event): void {
    this.search.emit((event.target as HTMLInputElement).value);
  }
}
