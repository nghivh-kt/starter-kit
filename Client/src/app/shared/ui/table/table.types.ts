import { TemplateRef } from '@angular/core';

/**
 * Cấu hình cho một cột trong bảng
 * T = Kiểu dữ liệu của dòng (ví dụ: User, Product...)
 */
export interface TableColumn<T = any> {
  /** Tên hiển thị trên Header (vd: "Full Name") */
  header: string;

  /** * Tên property trong data để lấy dữ liệu (vd: "fullName", "user.role.name") 
   * Nếu dùng template thì key này chủ yếu để sort hoặc track
   */
  key: keyof T | string;

  /** (Optional) Custom template cho nội dung cột (Avatar, Badge, Button...) */
  template?: TemplateRef<any>;

  /** (Optional) Độ rộng cột theo Tailwind (vd: 'w-20', 'w-1/4', 'min-w-[200px]') */
  width?: string;

  /** (Optional) Class CSS áp dụng cho cả Header và Cell (vd: 'text-right' cho cột tiền, 'text-center') */
  className?: string;

  /** (Optional) Có hiện mũi tên sắp xếp không? */
  sortable?: boolean;

  /** (Optional) Thêm format */
  type?: 'text' | 'date' | 'currency' | 'number';
  format?: string;
}

/**
 * Sự kiện khi thay đổi trang (Pagination)
 */
export interface PageEvent {
  /** Trang hiện tại (bắt đầu từ 1) */
  page: number;
  
  /** Số dòng trên một trang */
  pageSize: number;
}

/**
 * (Optional) Interface cho nút hành động nếu muốn config cứng thay vì dùng Template
 * Thường dùng cho các bảng đơn giản.
 */
export interface TableAction<T = any> {
  label: string;
  icon?: string;
  onClick: (item: T) => void;
  variant?: 'primary' | 'danger' | 'ghost' | 'outline';
}