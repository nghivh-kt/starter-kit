import {
  Component,
  computed,
  input,
  model, // ✨ NEW: Dùng model cho two-way binding
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TableColumn, PageEvent } from './table.types';
import { CheckboxComponent } from '../checkbox/checkbox.component'; // Giả sử path đúng
import { ButtonComponent } from '../button/button.component'; // Giả sử path đúng

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule, FormsModule, CheckboxComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table.component.html',
})
export class TableComponent<T = any> {
  Math = Math;

  // --- DATA INPUTS ---
  data = input<T[]>([]); // Dữ liệu hiển thị
  columns = input.required<TableColumn<T>[]>();

  // --- MODEL (THAY ĐỔI LỚN NHẤT) ---
  // Vừa là Input nhận vào, vừa là Output bắn ra.
  // Dùng cú pháp [(selection)]="selectedRows" ở component cha
  selection = model<T[]>([]);

  // --- CONFIG INPUTS ---
  loading = input(false);
  selectable = input(false);
  searchable = input(false);
  activeItem = model<T | null>(null);

  scrollHeight = input<string>('');

  // --- PAGINATION CONFIG ---
  pagination = input(false);
  serverSide = input(false); // ✨ True = Server paging, False = Client paging
  totalRecords = input(0); // Dùng cho Server Side
  page = input(1);
  pageSize = input(10);

  // --- OUTPUT EVENTS ---
  sortChange = output<{ key: string; direction: 'asc' | 'desc' }>();
  pageChange = output<PageEvent>();
  rowClick = output<T>();
  search = output<string>();

  // --- INTERNAL STATE ---
  sortKey = signal<string>('');
  sortDir = signal<'asc' | 'desc'>('asc');

  // --- COMPUTED LOGIC ---

  // 1. Chuyển đổi Selection Model (Array) -> Set (để tra cứu O(1) trên UI)
  selectedSet = computed(() => new Set(this.selection()));
  selectedCount = computed(() => this.selection().length);

  // 2. Logic Sắp xếp (Client-side)
  sortedData = computed(() => {
    const rawData = this.data();
    const key = this.sortKey();
    const dir = this.sortDir();

    // Nếu là Server-side hoặc chưa chọn cột sort -> Trả về data gốc
    if (this.serverSide() || !key) return rawData;

    // Clone mảng để sort (tránh mutate data gốc)
    return [...rawData].sort((a, b) => {
      const valueA = this.getCellValue(a, key);
      const valueB = this.getCellValue(b, key);

      // Xử lý null/undefined
      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return 1;
      if (valueB == null) return -1;

      // So sánh
      if (valueA < valueB) return dir === 'asc' ? -1 : 1;
      if (valueA > valueB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  });

  // 3. Tính toán tổng số dòng thực tế
  effectiveTotalRecords = computed(() => (this.serverSide() ? this.totalRecords() : this.data().length));

  // 4. Tính toán dữ liệu hiển thị (Pagination Slice)
  paginatedData = computed(() => {
    // 1. NẾU LÀ SERVER SIDE (Parent làm hết)
    // Child trả về nguyên xi những gì Parent đưa (đã sort/slice sẵn)
    if (this.serverSide()) return this.data();

    // 2. NẾU LÀ CLIENT SIDE (Child tự làm)
    // Child tự lấy data gốc -> tự sort -> tự cắt slice
    const processedData = this.sortedData();
    const start = (this.page() - 1) * this.pageSize();
    return processedData.slice(start, start + this.pageSize());
  });

  // 5. Logic Total Columns
  totalCols = computed(() => this.columns().length + (this.selectable() ? 1 : 0));

  // 6. Logic Select All State (Dựa trên data đang hiển thị)
  isAllSelected = computed(() => {
    const displayData = this.paginatedData();
    const currentSet = this.selectedSet(); // Dùng Set đã computed
    return displayData.length > 0 && displayData.every((item) => currentSet.has(item));
  });

  // 7. Logic trạng thái không xác định
  isIndeterminate = computed(() => {
    const displayData = this.paginatedData();
    if (displayData.length === 0) return false;

    const currentSet = this.selectedSet();
    const count = displayData.filter((item) => currentSet.has(item)).length;
    return count > 0 && count < displayData.length;
  });

  // --- METHODS ---

  trackByFn(index: number, item: any) {
    return item.id || index;
  }

  getCellValue(item: T, key: string | keyof T): any {
    if (typeof key === 'string' && key.includes('.')) {
      return key.split('.').reduce((obj: any, k) => obj?.[k], item);
    }
    return (item as any)[key];
  }

  // Hàm này sẽ nhận vào 1 dòng data (item) và trả về một chuỗi class CSS (string).
  rowClassFn = input<(item: any) => string | string[] | Set<string> | Record<string, any>>();

  // --- SELECTION ACTIONS (Logic mới gọn hơn) ---

  toggleSelection(item: T) {
    this.selection.update((current) => {
      // Nếu đã có -> Lọc bỏ (Bỏ chọn)
      if (current.includes(item)) {
        return current.filter((x) => x !== item); // Note: So sánh reference object
      }
      // Nếu chưa có -> Thêm vào
      return [...current, item];
    });
  }

  toggleSelectAll() {
    const displayData = this.paginatedData();
    const isAll = this.isAllSelected();

    this.selection.update((current) => {
      const currentSet = new Set(current);

      if (isAll) {
        // Bỏ chọn tất cả item đang hiển thị
        displayData.forEach((item) => currentSet.delete(item));
      } else {
        // Chọn tất cả item đang hiển thị
        displayData.forEach((item) => currentSet.add(item));
      }
      return Array.from(currentSet);
    });
  }

  isSelected(item: T): boolean {
    return this.selectedSet().has(item);
  }

  // --- OTHER ACTIONS ---

  // PAGING ACTION
  changePage(newPage: number) {
    // Emit ra ngoài để cha xử lý (gọi API hoặc đổi state page)
    this.pageChange.emit({ page: newPage, pageSize: this.pageSize() });
  }

  handleSort(col: TableColumn<T>) {
    if (!col.sortable) return;
    const newDir = this.sortKey() === col.key && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortKey.set(col.key as string);
    this.sortDir.set(newDir);
    this.sortChange.emit({ key: col.key as string, direction: newDir });
  }

  onRowClick(item: T) {
    this.activeItem.set(item);
    this.rowClick.emit(item);
  }

  onSearch(event: Event) {
    this.search.emit((event.target as HTMLInputElement).value);
  }
}
