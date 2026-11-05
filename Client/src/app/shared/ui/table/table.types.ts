import { TemplateRef } from '@angular/core';

/**
 * Cấu hình cho một cột trong bảng
 * T = Kiểu dữ liệu của dòng
 */
export interface TableColumn<T = unknown> {
  /** Tên hiển thị trên Header */
  header: string;

  /**
   * Tên property trong data để lấy dữ liệu (vd: "fullName", "user.role.name").
   * Với cột sortable, đây cũng là giá trị sortBy gửi lên API.
   */
  key: keyof T | string;

  /** Custom template cho nội dung cột (Badge, Button...) */
  template?: TemplateRef<unknown> | null;

  /** Độ rộng cột (vd: '100px') */
  width?: string;

  /** Class CSS áp dụng cho cả Header và Cell (vd: 'text-right') */
  className?: string;

  /** Có cho sắp xếp theo cột này không */
  sortable?: boolean;

  type?: 'text' | 'date' | 'currency' | 'number';
  format?: string;
}

/** Sự kiện khi thay đổi trang */
export interface PageEvent {
  /** Trang hiện tại (bắt đầu từ 1) */
  page: number;

  /** Số dòng trên một trang */
  pageSize: number;
}
